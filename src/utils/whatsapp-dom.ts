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

// Get the current contact name
export function getContactName(): string {
  const nameElement =
    document.querySelector<HTMLElement>(SELECTORS.contactName) ||
    document.querySelector<HTMLElement>(SELECTORS.contactNameFallback)

  if (nameElement) {
    return nameElement.getAttribute("title") || nameElement.innerText || ""
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

// Get current input text
export function getCurrentInputText(): string {
  const input = getMessageInput()
  return input?.textContent || ""
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
