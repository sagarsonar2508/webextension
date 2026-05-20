// Account & plan state.
//
// The extension works fully offline — an account is optional. When connected,
// the API token links to the QuickReplies website so the dashboard reflects
// real usage and a Pro subscription lifts the free reply cap.

export type Plan = "free" | "pro"

export interface UsagePeriod {
  count: number        // metered replies in the current 30-day window
  periodStart: number  // epoch ms — start of the window
}

export interface AccountData {
  token: string | null   // API bearer token, null when not connected
  email: string | null
  plan: Plan             // last plan seen from the server; "free" until synced
  usage: UsagePeriod     // local source of truth for quota enforcement
  serverUsed: number | null   // last `used` value the server reported
  lastSyncedAt: number | null
}

export const DEFAULT_ACCOUNT: AccountData = {
  token: null,
  email: null,
  plan: "free",
  usage: { count: 0, periodStart: Date.now() },
  serverUsed: null,
  lastSyncedAt: null
}

// Snapshot returned by the website's /api/usage endpoint.
export interface UsageSnapshot {
  email?: string
  plan: Plan
  used: number
  limit: number | null      // null = unlimited
  remaining: number | null
  allowed?: boolean
}
