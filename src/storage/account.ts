import type { AccountData, Plan, UsageSnapshot } from "~/types"
import { DEFAULT_ACCOUNT } from "~/types"
import { FREE_MONTHLY_QUOTA } from "~/config"
import { fetchUsage, reportUsage, ApiError } from "~/api/client"

// Account & quota storage.
//
// The free reply cap is enforced LOCALLY (against `usage.count`) so the
// extension keeps working offline. When a token is connected, every metered
// reply is also reported to the server — the server is the cross-device
// backstop and the source of truth for the Pro plan.

const ACCOUNT_KEY = "wqr-account"
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

// ── Read / write ───────────────────────────────────────────────────────────

export async function getAccount(): Promise<AccountData> {
  const result = await chrome.storage.local.get(ACCOUNT_KEY)
  const data = (result[ACCOUNT_KEY] as AccountData | undefined) ?? DEFAULT_ACCOUNT
  return rollPeriod(data)
}

export async function setAccount(acc: AccountData): Promise<void> {
  await chrome.storage.local.set({ [ACCOUNT_KEY]: acc })
}

// Reset the local counter once the 30-day window elapses. Persists if it rolled.
function rollPeriod(acc: AccountData): AccountData {
  if (Date.now() - acc.usage.periodStart >= PERIOD_MS) {
    const rolled: AccountData = {
      ...acc,
      usage: { count: 0, periodStart: Date.now() }
    }
    void setAccount(rolled)
    return rolled
  }
  return acc
}

// ── Plan & quota helpers (pure, synchronous) ───────────────────────────────

/** Pro only counts when an account is actually connected. */
export function effectivePlan(acc: AccountData): Plan {
  return acc.token && acc.plan === "pro" ? "pro" : "free"
}

export function isOverQuota(acc: AccountData): boolean {
  return effectivePlan(acc) === "free" && acc.usage.count >= FREE_MONTHLY_QUOTA
}

export interface QuotaStatus {
  plan: Plan
  connected: boolean
  email: string | null
  used: number
  limit: number | null   // null = unlimited
  remaining: number | null
  periodStart: number
}

export function quotaStatus(acc: AccountData): QuotaStatus {
  const plan = effectivePlan(acc)
  const limit = plan === "pro" ? null : FREE_MONTHLY_QUOTA
  return {
    plan,
    connected: !!acc.token,
    email: acc.email,
    used: acc.usage.count,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - acc.usage.count),
    periodStart: acc.usage.periodStart
  }
}

// ── Metering ───────────────────────────────────────────────────────────────

/**
 * Account for one reply. Returns `allowed: false` (without incrementing) when
 * the free quota is exhausted. On success, increments the local counter and —
 * if connected — reports to the server in the background.
 */
export async function meterReply(): Promise<{
  allowed: boolean
  account: AccountData
}> {
  const acc = await getAccount()

  if (isOverQuota(acc)) {
    return { allowed: false, account: acc }
  }

  const next: AccountData = {
    ...acc,
    usage: { ...acc.usage, count: acc.usage.count + 1 }
  }
  await setAccount(next)

  if (next.token) {
    void reportUsage(next.token, 1)
      .then((snap) => applyServerSnapshot(snap))
      .catch((e) => {
        // Server says quota is gone — clamp the local counter so the next
        // local check also blocks, keeping the two sides consistent.
        if (e instanceof ApiError && e.status === 402) {
          void clampToQuota()
        }
      })
  }

  return { allowed: true, account: next }
}

// ── Connect / disconnect / sync ────────────────────────────────────────────

/** Validate a token against the API and connect the account. */
export async function connectAccount(token: string): Promise<QuotaStatus> {
  const clean = token.trim()
  if (!clean) throw new ApiError("paste your token first", 400)

  const snap = await fetchUsage(clean) // throws on bad token / network
  const acc = await getAccount()
  const next: AccountData = {
    ...acc,
    token: clean,
    email: snap.email ?? acc.email,
    plan: snap.plan,
    // Adopt the server's count so a reinstall on a paid device keeps state.
    usage: { count: Math.max(acc.usage.count, snap.used), periodStart: acc.usage.periodStart },
    serverUsed: snap.used,
    lastSyncedAt: Date.now()
  }
  await setAccount(next)
  return quotaStatus(next)
}

export async function disconnectAccount(): Promise<void> {
  const acc = await getAccount()
  await setAccount({ ...acc, token: null, email: null, plan: "free", serverUsed: null })
}

/** Re-fetch plan + usage from the server. No-op when not connected. */
export async function syncAccount(): Promise<QuotaStatus> {
  const acc = await getAccount()
  if (!acc.token) return quotaStatus(acc)
  const snap = await fetchUsage(acc.token)
  return applyServerSnapshot(snap)
}

async function applyServerSnapshot(snap: UsageSnapshot): Promise<QuotaStatus> {
  const acc = await getAccount()
  const next: AccountData = {
    ...acc,
    plan: snap.plan,
    email: snap.email ?? acc.email,
    serverUsed: snap.used,
    lastSyncedAt: Date.now()
  }
  await setAccount(next)
  return quotaStatus(next)
}

async function clampToQuota(): Promise<void> {
  const acc = await getAccount()
  await setAccount({
    ...acc,
    usage: { ...acc.usage, count: Math.max(acc.usage.count, FREE_MONTHLY_QUOTA) }
  })
}
