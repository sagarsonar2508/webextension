// Incoming-message observer for WhatsApp Web.
//
// WhatsApp's React tree is heavily obfuscated and class names rotate every
// few releases, so this anchors on the historically stable signals:
//   1. `data-id` on each message bubble. Prefix is "false_" for incoming,
//      "true_" for outgoing — that's how we filter out our own messages.
//   2. `.selectable-text` / `.copyable-text` for the text content.
//   3. `#main` for the conversation pane (a stable id for years).
//
// Class-based detection (`[class*="message-in"]`) is a last-ditch fallback
// for if Meta ever drops the data-id prefix convention.
//
// Two failure modes to defend against:
//   - Chat history flood: opening a chat dumps ~50 historical messages into
//     the DOM. We snapshot all visible IDs as "seen" before reacting, and
//     re-snapshot whenever the chat header changes (= user switched chats).
//   - Mutation re-fires: WhatsApp re-renders bubbles during reactions, edits,
//     status changes etc. Dedup by data-id keeps us idempotent.

import { getContactName } from "./whatsapp-dom"
import type { IncomingMessage } from "~/engine/auto-reply"

export type IncomingHandler = (msg: IncomingMessage) => void

const SEEN_CAP = 5000      // bound the seen-set so long sessions don't leak

export function startIncomingMessageObserver(
  handler: IncomingHandler
): () => void {
  const seenIds = new Set<string>()
  let lastContact = ""

  const snapshotHistorySeen = () => {
    document.querySelectorAll<HTMLElement>("#main [data-id]").forEach((el) => {
      const id = el.getAttribute("data-id")
      if (id) seenIds.add(id)
    })
    if (seenIds.size > SEEN_CAP) {
      const recent = Array.from(seenIds).slice(-Math.floor(SEEN_CAP / 2))
      seenIds.clear()
      recent.forEach((id) => seenIds.add(id))
    }
  }

  // Initial snapshot, deferred so #main has time to render its history.
  // 800ms picked empirically; users opening a chat aren't expecting an
  // auto-reply on the first second anyway.
  setTimeout(() => {
    snapshotHistorySeen()
    lastContact = getContactName()
  }, 800)

  const observer = new MutationObserver((mutations) => {
    // Detect chat-switch by watching the header contact name. When it
    // changes, we re-snapshot — otherwise unread messages from the new
    // chat would all fire as "new" arrivals.
    const current = getContactName()
    if (current && current !== lastContact) {
      lastContact = current
      // Defer so the new chat's history finishes rendering first.
      setTimeout(snapshotHistorySeen, 300)
      return
    }

    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (!node.closest("#main")) return

        const bubbles: HTMLElement[] = []
        if (node.hasAttribute("data-id")) bubbles.push(node)
        node
          .querySelectorAll<HTMLElement>("[data-id]")
          .forEach((b) => bubbles.push(b))

        for (const bubble of bubbles) {
          const id = bubble.getAttribute("data-id")
          if (!id || seenIds.has(id)) continue
          seenIds.add(id)

          const msg = parseMessageBubble(bubble, current)
          if (msg) {
            console.log("[WQR auto-reply] incoming", msg)
            handler(msg)
          }
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  return () => observer.disconnect()
}

function parseMessageBubble(
  bubble: HTMLElement,
  contactName: string
): IncomingMessage | null {
  const id = bubble.getAttribute("data-id") || ""

  // Direction: prefer data-id prefix, fall back to ancestor class.
  let isOutgoing = id.startsWith("true_")
  let isIncoming = id.startsWith("false_")
  if (!isOutgoing && !isIncoming) {
    isOutgoing = !!bubble.closest('[class*="message-out"]')
    isIncoming = !!bubble.closest('[class*="message-in"]')
    if (!isOutgoing && !isIncoming) return null   // unknown direction → skip
  }
  if (isOutgoing) return null

  // Text extraction. .selectable-text wraps the actual rendered text;
  // .copyable-text is the outer container that also holds metadata.
  let text = ""
  const selectable = bubble.querySelector<HTMLElement>(".selectable-text")
  if (selectable) {
    text = (selectable.innerText || selectable.textContent || "").trim()
  } else {
    const copyable = bubble.querySelector<HTMLElement>(".copyable-text")
    text = (copyable?.textContent || "").trim()
  }

  if (!text) return null   // media-only / sticker / call-event → skip in v1

  const safeName = contactName || "there"
  return {
    id,
    contactId: safeName,
    contactName: safeName,
    text,
    timestamp: Date.now()
  }
}
