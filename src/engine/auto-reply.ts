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

// Returns the highest-priority rule whose trigger matches and whose guards
// (scope, rate limit, master switch) all pass. Pure function — no I/O.
export function matchRule(input: MatchInput): MatchResult | null {
  const { message, rules, state, settings, now } = input

  if (!settings.masterEnabled || settings.globalMode === "off") return null

  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  for (const rule of sorted) {
    if (!triggerMatches(rule.trigger, message, state)) continue
    if (!scopeAllows(rule.scope, message.contactName)) continue
    if (!rateLimitAllows(rule.rateLimit, state, rule.id, now)) continue

    const rendered = renderResponse(rule.response, message.contactName)
    return { rule, rendered }
  }

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
