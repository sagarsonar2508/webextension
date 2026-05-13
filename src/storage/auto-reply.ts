import type {
  AutoReplyRule,
  AutoReplySettings,
  ConversationState
} from "~/types"
import { DEFAULT_AUTO_REPLY_SETTINGS } from "~/types"

const RULES_KEY = "wqr-auto-reply-rules"
const SETTINGS_KEY = "wqr-auto-reply-settings"
const STATE_KEY = "wqr-auto-reply-state"

// ── Rules ──────────────────────────────────────────────────────────────

export async function getRules(): Promise<AutoReplyRule[]> {
  const result = await chrome.storage.local.get(RULES_KEY)
  return (result[RULES_KEY] as AutoReplyRule[] | undefined) ?? []
}

export async function setRules(rules: AutoReplyRule[]): Promise<void> {
  await chrome.storage.local.set({ [RULES_KEY]: rules })
}

export async function getRuleById(id: string): Promise<AutoReplyRule | undefined> {
  const rules = await getRules()
  return rules.find((r) => r.id === id)
}

export async function addRule(
  rule: Omit<AutoReplyRule, "id" | "createdAt" | "updatedAt" | "stats">
): Promise<AutoReplyRule> {
  const rules = await getRules()
  const now = Date.now()
  const newRule: AutoReplyRule = {
    ...rule,
    id: generateRuleId(),
    stats: { triggered: 0 },
    createdAt: now,
    updatedAt: now
  }
  rules.push(newRule)
  await setRules(rules)
  return newRule
}

export async function updateRule(
  id: string,
  updates: Partial<Omit<AutoReplyRule, "id" | "createdAt">>
): Promise<AutoReplyRule | undefined> {
  const rules = await getRules()
  const idx = rules.findIndex((r) => r.id === id)
  if (idx === -1) return undefined

  rules[idx] = { ...rules[idx], ...updates, updatedAt: Date.now() }
  await setRules(rules)
  return rules[idx]
}

export async function deleteRule(id: string): Promise<boolean> {
  const rules = await getRules()
  const next = rules.filter((r) => r.id !== id)
  if (next.length === rules.length) return false
  await setRules(next)
  return true
}

export async function recordTriggered(id: string): Promise<void> {
  const rules = await getRules()
  const rule = rules.find((r) => r.id === id)
  if (!rule) return
  rule.stats.triggered++
  rule.stats.lastTriggeredAt = Date.now()
  rule.updatedAt = Date.now()
  await setRules(rules)
}

// ── Settings ───────────────────────────────────────────────────────────

export async function getAutoReplySettings(): Promise<AutoReplySettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  const data = result[SETTINGS_KEY] as AutoReplySettings | undefined
  if (!data) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_AUTO_REPLY_SETTINGS })
    return DEFAULT_AUTO_REPLY_SETTINGS
  }
  return data
}

export async function updateAutoReplySettings(
  updates: Partial<AutoReplySettings>
): Promise<AutoReplySettings> {
  const current = await getAutoReplySettings()
  const next = { ...current, ...updates }
  await chrome.storage.local.set({ [SETTINGS_KEY]: next })
  return next
}

// ── Conversation state ─────────────────────────────────────────────────
// Stored as a record keyed by contactId so a single get() returns the whole
// map. State entries auto-reset on the next local-midnight (resetAt).

type StateMap = Record<string, ConversationState>

export async function getAllConversationState(): Promise<StateMap> {
  const result = await chrome.storage.local.get(STATE_KEY)
  return (result[STATE_KEY] as StateMap | undefined) ?? {}
}

export async function getConversationState(
  contactId: string
): Promise<ConversationState | null> {
  const map = await getAllConversationState()
  const state = map[contactId]
  if (!state) return null

  // Lazy daily reset — cheaper than a cron, and the only consumers of
  // repliesToday call this anyway.
  if (Date.now() >= state.resetAt) {
    state.repliesToday = 0
    state.resetAt = nextLocalMidnight()
    map[contactId] = state
    await chrome.storage.local.set({ [STATE_KEY]: map })
  }
  return state
}

export async function recordReply(
  contactId: string,
  ruleId: string
): Promise<void> {
  const map = await getAllConversationState()
  const existing = map[contactId]
  const now = Date.now()

  const next: ConversationState = existing
    ? {
        ...existing,
        lastReplyAt: now,
        lastRuleId: ruleId,
        repliesToday: now >= existing.resetAt ? 1 : existing.repliesToday + 1,
        resetAt: now >= existing.resetAt ? nextLocalMidnight() : existing.resetAt,
        hasEverReplied: true
      }
    : {
        contactId,
        lastReplyAt: now,
        lastRuleId: ruleId,
        repliesToday: 1,
        resetAt: nextLocalMidnight(),
        hasEverReplied: true
      }

  map[contactId] = next
  await chrome.storage.local.set({ [STATE_KEY]: map })
}

// Even when the user dismisses a suggestion, mark hasEverReplied so the
// "first-message" trigger doesn't keep firing for the same contact.
export async function markContactSeen(contactId: string): Promise<void> {
  const map = await getAllConversationState()
  const existing = map[contactId]
  if (existing?.hasEverReplied) return

  map[contactId] = existing
    ? { ...existing, hasEverReplied: true }
    : {
        contactId,
        lastReplyAt: 0,
        repliesToday: 0,
        resetAt: nextLocalMidnight(),
        hasEverReplied: true
      }
  await chrome.storage.local.set({ [STATE_KEY]: map })
}

// ── Helpers ────────────────────────────────────────────────────────────

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function nextLocalMidnight(): number {
  const d = new Date()
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}
