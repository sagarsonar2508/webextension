// Auto-reply v1: suggest-mode only, keyword + first-message triggers, text replies.
// Trigger/Response are discriminated unions so v2 (menu/flow/auto-send) can add
// new `kind` variants without breaking existing rules.

export interface AutoReplyRule {
  id: string
  name: string
  enabled: boolean
  priority: number          // lower = higher priority; ties broken by createdAt

  trigger: Trigger
  response: Response

  scope: ContactScope
  rateLimit: RateLimit
  mode: ReplyMode           // per-rule; clamped by global mode in settings

  stats: { triggered: number; lastTriggeredAt?: number }
  createdAt: number
  updatedAt: number
}

export type Trigger =
  | { kind: "keyword"; words: string[]; match: KeywordMatch }
  | { kind: "first-message" }    // first incoming message ever from this contact
  | { kind: "any-message" }      // catch-all, should be lowest-priority

export type KeywordMatch = "any" | "all" | "exact"

export type Response =
  | { kind: "text"; content: string }   // supports {{name}} {{time}} {{date}} {{day}}

export type ContactScope =
  | { kind: "all" }
  | { kind: "include"; contactNames: string[] }   // case-insensitive substring match
  | { kind: "exclude"; contactNames: string[] }

export interface RateLimit {
  maxPerContactPerDay: number   // 0 = unlimited
  cooldownMinutes: number       // 0 = no cooldown
}

// v1 only ships "suggest". "auto" reserved for v2 (with humanizing typing delay).
export type ReplyMode = "suggest" | "auto"

// Per-contact runtime state. Keyed by contactId (currently the contact name —
// imperfect but stable enough for SMB use; v2 can upgrade to phone number).
export interface ConversationState {
  contactId: string
  lastReplyAt: number
  lastRuleId?: string
  repliesToday: number
  resetAt: number               // next local-midnight epoch ms
  hasEverReplied: boolean       // gates "first-message" trigger
}

export interface AutoReplySettings {
  masterEnabled: boolean
  // Global mode acts as a ceiling: if "suggest", no rule can auto-send even if
  // its own mode says "auto". v1 ignores "auto" entirely — it's a v2 feature.
  globalMode: "off" | "suggest" | "auto"
}

export const DEFAULT_AUTO_REPLY_SETTINGS: AutoReplySettings = {
  masterEnabled: false,    // off by default; user opts in after creating a rule
  globalMode: "suggest"
}
