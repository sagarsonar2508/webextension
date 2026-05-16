// WhatsApp Web DOM Utilities
// These selectors may need updates as WhatsApp changes their DOM

// Selectors for WhatsApp Web elements
export const SELECTORS = {
  // Message input box (contenteditable div)
  messageInput: '[contenteditable="true"][data-tab="10"]',
  messageInputFallback: 'footer [contenteditable="true"]',

  // Contact/Chat header
  chatHeader: "header",
  contactName: "header span[title]",
  contactNameFallback: 'header span[dir="auto"]',

  // Chat container
  chatContainer: "#main",
  chatList: '[aria-label="Chat list"]',

  // Send button
  sendButton: '[data-icon="send"]',
  sendButtonFallback: 'footer button[aria-label*="Send"]',

  // Side panel
  sidePanel: "#side",

  // Main app container
  appContainer: "#app",

  // Conversation panel
  conversationPanel: "#main > div"
}

// Get the message input element
export function getMessageInput(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(SELECTORS.messageInput) ||
    document.querySelector<HTMLElement>(SELECTORS.messageInputFallback)
  )
}

// Strings WhatsApp renders inside `header span[title]` that aren't real
// contact names — tooltip placeholders, status-bar copy etc. Treat as empty
// so we don't store conversation state under "click here for contact info".
const HEADER_PLACEHOLDERS = [
  "click here for contact info",
  "click here for group info"
]

// Get the current contact name
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
  return ""
}

// Insert text into WhatsApp input
export function insertTextIntoInput(text: string): boolean {
  const input = getMessageInput()

  if (!input) {
    console.warn("WhatsApp Quick Replies: Input not found")
    return false
  }

  // Focus the input
  input.focus()

  // Clear existing content if any
  // input.innerHTML = ""

  // Use execCommand for React-controlled inputs
  // This is the most reliable method for WhatsApp Web
  const success = document.execCommand("insertText", false, text)

  if (!success) {
    // Fallback: dispatch input events manually
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text
    })

    input.textContent = (input.textContent || "") + text
    input.dispatchEvent(inputEvent)
  }

  // Trigger change events
  const changeEvent = new Event("change", { bubbles: true })
  input.dispatchEvent(changeEvent)

  return true
}

// Replace entire input content
export function replaceInputContent(text: string): boolean {
  const input = getMessageInput()

  if (!input) {
    return false
  }

  input.focus()

  // Select all and replace
  document.execCommand("selectAll", false)
  document.execCommand("insertText", false, text)

  return true
}

// Clear the message box, then insert `text`. Used by auto-send so the sent
// message is exactly `text` — never appended onto a stale draft or onto a
// previous auto-reply (which is what produced the "Hi Hi Hi Hi" pile-up).
export function setMessageInputText(text: string): boolean {
  const input = getMessageInput()
  if (!input) {
    console.log("[WQR/dom] setMessageInputText: input not found")
    return false
  }
  input.focus()
  // selectAll + a single delete clears reliably — it's repeated consecutive
  // deletes that WhatsApp's editor batches, not one over a full selection.
  document.execCommand("selectAll", false)
  document.execCommand("delete", false)
  const ok = document.execCommand("insertText", false, text)
  input.dispatchEvent(new Event("change", { bubbles: true }))
  return ok
}

// Get current input text
export function getCurrentInputText(): string {
  const input = getMessageInput()
  return input?.textContent || ""
}

// Click WhatsApp's Send button. Used by auto-send rules — keystroke-based
// Enter dispatch is unreliable in WhatsApp's Lexical editor (the same path
// that swallowed `delete` calls in replaceShortcut), so we click the real
// button instead.
export function sendCurrentMessage(): boolean {
  const primary = document.querySelector<HTMLElement>(SELECTORS.sendButton)
  const fallback = document.querySelector<HTMLElement>(SELECTORS.sendButtonFallback)
  const btn = primary || fallback
  if (!btn) {
    console.log("[WQR/dom] send button not found", {
      primary: SELECTORS.sendButton,
      fallback: SELECTORS.sendButtonFallback
    })
    return false
  }
  // For [data-icon="send"] we get the SVG/icon, so walk up to the clickable button.
  const clickable = btn.closest("button") || btn
  ;(clickable as HTMLElement).click()
  return true
}

// Check if we're in a chat
export function isInChat(): boolean {
  return document.querySelector(SELECTORS.chatContainer) !== null
}

// Check if WhatsApp Web is loaded
export function isWhatsAppLoaded(): boolean {
  return document.querySelector(SELECTORS.appContainer) !== null
}

// Create and observe DOM mutations
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

// Wait for element to appear
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

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

// Detect slash command in input
export function detectSlashCommand(text: string): {
  isSlashCommand: boolean
  command: string
  prefix: string
} {
  const match = text.match(/^(.*)\/(\w*)$/)

  if (match) {
    return {
      isSlashCommand: true,
      prefix: match[1],
      command: match[2]
    }
  }

  return {
    isSlashCommand: false,
    command: "",
    prefix: ""
  }
}
