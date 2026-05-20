import type {
  AutoReplyRule,
  AutoReplySettings,
  ConversationState,
  ContactScope,
  KeywordMatch,
  Response,
  Trigger
} from "~/types"
import { processTemplate, getVariableContext } from "~/utils/variables"
import { AUTO_SEND_ENABLED } from "~/config"

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

export interface MatchAll {
  auto: MatchResult[]          // every matching auto-mode rule (one send each)
  suggest: MatchResult | null  // highest-priority matching suggest-mode rule
}

const LOG = "[AR/engine]"

// Evaluates every enabled rule against a message.
//   - Auto-mode: ALL rules whose trigger + scope match are returned, in
//     priority order — the caller sends one message per rule. No rate-limit
//     guard; the caller's last-message check + per-message dedup prevent
//     re-fires (cooldown/daily-cap were dropped for auto-send by design).
//   - Suggest-mode: the single highest-priority match (one banner), still
//     gated by the rate limit.
// Pure function — no I/O.
export function matchRules(input: MatchInput): MatchAll {
  const { message, rules, state, settings } = input
  const empty: MatchAll = { auto: [], suggest: null }

  if (!settings.masterEnabled || settings.globalMode === "off") {
    console.log(
      `${LOG} blocked: settings off (master=${settings.masterEnabled} mode=${settings.globalMode})`
    )
    return empty
  }

  const enabled = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)

  if (enabled.length === 0) {
    console.log(`${LOG} blocked: no enabled rules (total=${rules.length})`)
    return empty
  }

  const auto: MatchResult[] = []
  let suggest: MatchResult | null = null
  const skipped: string[] = []

  for (const rule of enabled) {
    const trigOK = triggerMatches(rule.trigger, message, state)
    const scopeOK = trigOK && scopeAllows(rule.scope, message.contactName)
    if (!trigOK || !scopeOK) {
      skipped.push(`${rule.name}[trig=${+trigOK} scope=${+scopeOK}]`)
      continue
    }
    const rendered = renderResponse(rule.response, message.contactName)
    if (AUTO_SEND_ENABLED && rule.mode === "auto") {
      auto.push({ rule, rendered })
    } else if (!suggest) {
      // With auto-send disabled, an "auto" rule is treated as a suggestion.
      suggest = { rule, rendered }
    }
  }

  console.log(
    `${LOG} matched: auto=[${auto.map((m) => m.rule.name).join(",")}] ` +
      `suggest=${suggest ? suggest.rule.name : "none"}` +
      (skipped.length ? ` | skipped: ${skipped.join(" ")}` : "")
  )
  return { auto, suggest }
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

// ── Response rendering ─────────────────────────────────────────────────

function renderResponse(response: Response, contactName: string): string {
  switch (response.kind) {
    case "text": {
      const ctx = getVariableContext(contactName)
      return processTemplate(response.content, ctx)
    }
  }
}
