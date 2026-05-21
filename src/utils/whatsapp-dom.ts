// WhatsApp Web DOM Utilities
//
// WhatsApp updates its DOM regularly — class names rotate, contenteditable
// attributes shuffle, the send icon's data-icon name changes. Every selector
// here has a chain of fallbacks: a stable structural anchor (#main, footer,
// header) followed by ever-broader attribute matches. When all fallbacks fail
// we surface a `quickreplies:dom-failure` event so the sidebar can show a
// "we're updating, sit tight" banner instead of silently doing nothing.

import { captureError } from "./telemetry"

// Selectors for WhatsApp Web elements. Ordered: most specific first.
export const SELECTORS = {
  messageInput: '[contenteditable="true"][data-tab="10"]',
  messageInputFallback: 'footer [contenteditable="true"]',
  messageInputFallback2: 'div[role="textbox"][contenteditable="true"]',

  chatHeader: "header",
  contactName: "header span[title]",
  contactNameFallback: 'header span[dir="auto"]',

  chatContainer: "#main",
  chatList: '[aria-label="Chat list"]',

  sendButton: '[data-icon="send"]',
  sendButtonFallback: 'footer button[aria-label*="Send" i]',
  sendButtonFallback2: 'footer span[data-icon*="send" i]',

  sidePanel: "#side",
  appContainer: "#app",
  conversationPanel: "#main > div"
}

// ── DOM failure signal ────────────────────────────────────────────────────
// Fires when a core selector returns null in a context where it shouldn't
// (e.g. we're in a chat but can't find the message input). The sidebar
// listens and shows a graceful banner instead of breaking silently.

const FAILURE_THROTTLE_MS = 5 * 60 * 1000 // one report per 5 min per kind
const lastReported = new Map<string, number>()

export type DomFailureKind =
  | "message_input"
  | "send_button"
  | "contact_name"
  | "chat_container"

function reportDomFailure(kind: DomFailureKind, detail?: string): void {
  const now = Date.now()
  const last = lastReported.get(kind) || 0
  if (now - last < FAILURE_THROTTLE_MS) return
  lastReported.set(kind, now)

  // Surface to the in-page UI.
  try {
    window.dispatchEvent(
      new CustomEvent("quickreplies:dom-failure", {
        detail: { kind, detail, at: now }
      })
    )
  } catch {
    /* ignore */
  }

  // Surface to Sentry so we know to ship a fix. Never includes message
  // content — just the selector that failed.
  captureError(new Error(`WhatsApp DOM selector failed: ${kind}`), {
    kind,
    detail,
    waVersion: detectWhatsAppVersion()
  })
}

// Best-effort: WhatsApp exposes its build version in a meta tag.
function detectWhatsAppVersion(): string | null {
  return (
    document
      .querySelector('meta[name="x-whatsapp-app-version"]')
      ?.getAttribute("content") ||
    document.querySelector("html")?.getAttribute("data-app-version") ||
    null
  )
}

// ── Element finders (with fallbacks) ──────────────────────────────────────

function findFirst(selectors: string[]): HTMLElement | null {
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s)
    if (el) return el
  }
  return null
}

export function getMessageInput(): HTMLElement | null {
  const el = findFirst([
    SELECTORS.messageInput,
    SELECTORS.messageInputFallback,
    SELECTORS.messageInputFallback2
  ])
  if (!el && isInChat()) {
    reportDomFailure("message_input")
  }
  return el
}

// Strings WhatsApp renders inside `header span[title]` that aren't real
// contact names — tooltip placeholders, status-bar copy etc. Treat as empty
// so we don't store conversation state under "click here for contact info".
const HEADER_PLACEHOLDERS = [
  "click here for contact info",
  "click here for group info"
]

export function getContactName(): string {
  const candidates = document.querySelectorAll<HTMLElement>(
    `${SELECTORS.contactName}, ${SELECTORS.contactNameFallback}`
  )
  for (const el of Array.from(candidates)) {
    const raw = (el.getAttribute("title") || el.innerText || "").trim()
    if (!raw) continue
    if (HEADER_PLACEHOLDERS.includes(raw.toLowerCase())) continue
    return raw
  }
  // Only report when we're actually in a chat — the contact name is
  // legitimately empty before the user opens one.
  if (isInChat() && candidates.length === 0) {
    reportDomFailure("contact_name")
  }
  return ""
}

// Insert text into WhatsApp input
export function insertTextIntoInput(text: string): boolean {
  const input = getMessageInput()
  if (!input) return false

  input.focus()
  const success = document.execCommand("insertText", false, text)
  if (!success) {
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    })
    input.textContent = (input.textContent || "") + text
    input.dispatchEvent(inputEvent)
  }
  input.dispatchEvent(new Event("change", { bubbles: true }))
  return true
}

export function replaceInputContent(text: string): boolean {
  const input = getMessageInput()
  if (!input) return false
  input.focus()
  document.execCommand("selectAll", false)
  document.execCommand("insertText", false, text)
  return true
}

// Clear the message box, then insert `text`. Used by auto-send so the sent
// message is exactly `text` — never appended onto a stale draft or onto a
// previous auto-reply (which is what produced the "Hi Hi Hi Hi" pile-up).
export function setMessageInputText(text: string): boolean {
  const input = getMessageInput()
  if (!input) return false
  input.focus()
  // selectAll + a single delete clears reliably — it's repeated consecutive
  // deletes that WhatsApp's editor batches, not one over a full selection.
  document.execCommand("selectAll", false)
  document.execCommand("delete", false)
  const ok = document.execCommand("insertText", false, text)
  input.dispatchEvent(new Event("change", { bubbles: true }))
  return ok
}

export function getCurrentInputText(): string {
  const input = getMessageInput()
  return input?.textContent || ""
}

// Click WhatsApp's Send button. Keystroke-based Enter dispatch is unreliable
// in WhatsApp's Lexical editor, so we click the real button instead.
export function sendCurrentMessage(): boolean {
  const btn = findFirst([
    SELECTORS.sendButton,
    SELECTORS.sendButtonFallback,
    SELECTORS.sendButtonFallback2
  ])
  if (!btn) {
    reportDomFailure("send_button")
    return false
  }
  // For [data-icon="send"] we get the SVG/icon, so walk up to the clickable button.
  const clickable = btn.closest("button") || btn
  ;(clickable as HTMLElement).click()
  return true
}

export function isInChat(): boolean {
  return document.querySelector(SELECTORS.chatContainer) !== null
}

export function isWhatsAppLoaded(): boolean {
  return document.querySelector(SELECTORS.appContainer) !== null
}

export function observeDOM(
  callback: (mutations: MutationRecord[]) => void,
  targetSelector?: string
): MutationObserver {
  const target = targetSelector
    ? document.querySelector(targetSelector)
    : document.body

  const observer = new MutationObserver(callback)
  if (target) {
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }
  return observer
}

export function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

export function detectSlashCommand(text: string): {
  isSlashCommand: boolean
  command: string
  prefix: string
} {
  const match = text.match(/^(.*)\/(\w*)$/)
  if (match) {
    return { isSlashCommand: true, prefix: match[1], command: match[2] }
  }
  return { isSlashCommand: false, command: "", prefix: "" }
}
