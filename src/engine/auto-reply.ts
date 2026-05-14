import type {
  AutoReplyRule,
  AutoReplySettings,
  ConversationState,
  ContactScope,
  KeywordMatch,
  RateLimit,
  Response,
  Trigger
} from "~/types"
import { processTemplate, getVariableContext } from "~/utils/variables"

export interface IncomingMessage {
  id: string                // WhatsApp's data-id, used for dedup upstream
  contactId: string         // currently the contact name from chat header
  contactName: string
  text: string
  timestamp: number
}

export interface MatchInput {
  message: IncomingMessage
  rules: AutoReplyRule[]
  state: ConversationState | null
  settings: AutoReplySettings
  now: number
}

export interface MatchResult {
  rule: AutoReplyRule
  rendered: string          // response text after variable processing
}

const LOG = "[WQR/engine]"

// Returns the highest-priority rule whose trigger matches and whose guards
// (scope, rate limit, master switch) all pass. Pure function — no I/O.
export function matchRule(input: MatchInput): MatchResult | null {
  const { message, rules, state, settings, now } = input
  const enabledCount = rules.filter((r) => r.enabled).length

  if (!settings.masterEnabled || settings.globalMode === "off") {
    console.log(`${LOG} blocked: settings off`, {
      masterEnabled: settings.masterEnabled,
      globalMode: settings.globalMode
    })
    return null
  }

  if (enabledCount === 0) {
    console.log(`${LOG} blocked: no enabled rules`, { total: rules.length })
    return null
  }

  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  const checks: Array<{
    rule: string
    trigger: string
    trigOK: boolean
    scopeOK: boolean
    rateOK: boolean
  }> = []

  for (const rule of sorted) {
    const trigOK = triggerMatches(rule.trigger, message, state)
    const scopeOK = trigOK && scopeAllows(rule.scope, message.contactName)
    const rateOK = scopeOK && rateLimitAllows(rule.rateLimit, state, rule.id, now)
    checks.push({
      rule: rule.name,
      trigger: rule.trigger.kind,
      trigOK,
      scopeOK,
      rateOK
    })
    if (!trigOK || !scopeOK || !rateOK) continue

    const rendered = renderResponse(rule.response, message.contactName)
    console.log(`${LOG} match`, {
      rule: rule.name,
      mode: rule.mode,
      rendered: rendered.slice(0, 80)
    })
    return { rule, rendered }
  }

  console.log(`${LOG} no match`, {
    text: message.text.slice(0, 60),
    enabled: enabledCount,
    checks
  })
  return null
}

// ── Trigger matching ───────────────────────────────────────────────────

function triggerMatches(
  trigger: Trigger,
  message: IncomingMessage,
  state: ConversationState | null
): boolean {
  switch (trigger.kind) {
    case "keyword":
      return keywordMatches(message.text, trigger.words, trigger.match)
    case "first-message":
      // Fires only if we've never auto-replied to this contact before.
      return !state?.hasEverReplied
    case "any-message":
      return true
  }
}

function keywordMatches(
  text: string,
  words: string[],
  match: KeywordMatch
): boolean {
  if (words.length === 0) return false
  const normalized = text.toLowerCase().trim()

  switch (match) {
    case "exact":
      return words.some((w) => normalized === w.toLowerCase().trim())
    case "all":
      return words.every((w) => containsWord(normalized, w.toLowerCase().trim()))
    case "any":
      return words.some((w) => containsWord(normalized, w.toLowerCase().trim()))
  }
}

// Word-boundary match so "price" doesn't match "appreciate".
function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack)
}

// ── Scope filtering ────────────────────────────────────────────────────

function scopeAllows(scope: ContactScope, contactName: string): boolean {
  const name = contactName.toLowerCase()
  switch (scope.kind) {
    case "all":
      return true
    case "include":
      return scope.contactNames.some((n) => name.includes(n.toLowerCase()))
    case "exclude":
      return !scope.contactNames.some((n) => name.includes(n.toLowerCase()))
  }
}

// ── Rate limiting ──────────────────────────────────────────────────────
// Two guards: per-contact daily cap, and a cooldown that applies to *any*
// reply for this contact (not just the same rule). The cooldown stops two
// rules from double-firing on a single message.

function rateLimitAllows(
  limit: RateLimit,
  state: ConversationState | null,
  _ruleId: string,
  now: number
): boolean {
  if (!state) return true

  if (limit.maxPerContactPerDay > 0 && state.repliesToday >= limit.maxPerContactPerDay) {
    return false
  }
  if (limit.cooldownMinutes > 0) {
    const cooldownMs = limit.cooldownMinutes * 60 * 1000
    if (now - state.lastReplyAt < cooldownMs) return false
  }
  return true
}

// ── Response rendering ─────────────────────────────────────────────────

function renderResponse(response: Response, contactName: string): string {
  switch (response.kind) {
    case "text": {
      const ctx = getVariableContext(contactName)
      return processTemplate(response.content, ctx)
    }
  }
}
