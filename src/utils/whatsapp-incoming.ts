// Incoming-message observer for WhatsApp Web.
//
// WhatsApp's React tree is heavily obfuscated and class names rotate every
// few releases. We anchor on the signals that have held up over the longest
// time:
//   1. `data-id` on each message bubble. Newer builds drop the legacy
//      `true_/false_` prefix, so direction is detected via multiple fallbacks
//      (see detectDirection).
//   2. `.selectable-text` / `.copyable-text` / dir-anchored span for the
//      text content (see extractText).
//   3. `#main` for the conversation pane (a stable id for years).
//
// Two failure modes to defend against:
//   - Chat history flood: opening a chat dumps ~50 historical messages into
//     the DOM. We snapshot all visible IDs as "seen" before reacting, and
//     re-snapshot whenever the chat header changes (= user switched chats).
//     After the snapshot we additionally run the handler against the most
//     recent incoming bubble — that's how unread-on-open works without
//     replaying every old message.
//   - Mutation timing: WhatsApp inserts the bubble shell first and its text
//     a tick later. We don't mark a bubble seen until it parses successfully,
//     so the next mutation (when text fills in) gets another shot.

import { getContactName } from "./whatsapp-dom"
import type { IncomingMessage } from "~/engine/auto-reply"

export type IncomingHandler = (msg: IncomingMessage) => void

const SEEN_CAP = 5000      // bound the seen-set so long sessions don't leak
const LOG = "[WQR/obs]"

export function startIncomingMessageObserver(
  handler: IncomingHandler
): () => void {
  const seenIds = new Set<string>()
  let lastContact = ""

  console.log(`${LOG} observer started`)

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

  // After snapshotting history as "seen", fire the handler for the most
  // recent incoming bubble in the open chat. The engine's rate-limit and
  // per-contact state stop a chat switch from re-firing the same reply.
  const processLatestIncoming = (contactName: string) => {
    const mainEl = document.querySelector("#main")
    const bubbles = Array.from(
      document.querySelectorAll<HTMLElement>("#main [data-id]")
    )
    const summary = { in: 0, out: 0, unknown: 0, withText: 0, noText: 0 }
    const trace: Array<Record<string, unknown>> = []

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i]
      const id = bubble.getAttribute("data-id") || ""
      const { dir, via } = detectDirection(bubble)
      const text = extractText(bubble)
      summary[dir]++
      if (text) summary.withText++
      else summary.noText++

      // Capture the first 6 bubbles walked (from newest backward) so we can
      // see exactly what's in the DOM at chat-switch time.
      if (trace.length < 6) {
        const classes = bubble.className?.toString().slice(0, 80) || ""
        const parentClasses =
          bubble.parentElement?.className?.toString().slice(0, 80) || ""
        const rect = bubble.getBoundingClientRect()
        trace.push({
          idx: i,
          id: id.slice(0, 60),
          dir,
          via,
          textLen: text.length,
          textPreview: text.slice(0, 40),
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          classes,
          parentClasses
        })
      }

      if (dir !== "in") continue
      if (!text) continue
      const safeName = contactName || "there"
      console.log(`${LOG} latest-unread → handler`, {
        id,
        contact: safeName,
        text: text.slice(0, 80),
        summary,
        trace
      })
      handler({
        id: id || `latest_${Date.now()}`,
        contactId: safeName,
        contactName: safeName,
        text,
        timestamp: Date.now()
      })
      return
    }
    console.log(`${LOG} latest-unread: no incoming bubble found`, {
      contact: contactName,
      bubblesScanned: bubbles.length,
      mainExists: !!mainEl,
      summary,
      trace
    })
  }

  // Initial snapshot, deferred so #main has time to render its history.
  setTimeout(() => {
    snapshotHistorySeen()
    lastContact = getContactName()
    console.log(`${LOG} initial snapshot done`, {
      contact: lastContact,
      seen: seenIds.size
    })
    processLatestIncoming(lastContact)
  }, 800)

  const tryProcessBubble = (bubble: HTMLElement, contactName: string) => {
    const id = bubble.getAttribute("data-id")
    if (!id) return
    if (seenIds.has(id)) return

    const { dir, via } = detectDirection(bubble)
    if (dir === "out") {
      seenIds.add(id)
      return
    }
    if (dir === "unknown") {
      // Direction unknown right now (rect may be 0 if not yet laid out).
      // Don't mark seen — wait for the next mutation tick.
      console.log(`${LOG} bubble dir=unknown (will retry)`, { id, via })
      return
    }

    const text = extractText(bubble)
    if (!text) {
      // Text hasn't rendered yet — don't mark seen, let the next mutation
      // (when the inner content fills in) take another pass.
      console.log(`${LOG} bubble no-text (will retry)`, { id, via })
      return
    }

    seenIds.add(id)
    const safeName = contactName || "there"
    console.log(`${LOG} bubble → handler`, {
      id,
      dir,
      via,
      contact: safeName,
      text: text.slice(0, 80)
    })
    handler({
      id,
      contactId: safeName,
      contactName: safeName,
      text,
      timestamp: Date.now()
    })
  }

  let addedBubbleCount = 0
  let mutationTick: ReturnType<typeof setTimeout> | null = null
  const flushMutationLog = () => {
    if (addedBubbleCount > 0) {
      console.log(`${LOG} mutation burst`, {
        bubblesSeen: addedBubbleCount,
        contact: lastContact
      })
      addedBubbleCount = 0
    }
    mutationTick = null
  }

  const observer = new MutationObserver((mutations) => {
    const current = getContactName()
    if (current && current !== lastContact) {
      console.log(`${LOG} chat switch`, { from: lastContact, to: current })
      lastContact = current
      setTimeout(() => {
        snapshotHistorySeen()
        processLatestIncoming(current)
      }, 300)
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

        addedBubbleCount += bubbles.length
        if (!mutationTick) mutationTick = setTimeout(flushMutationLog, 200)

        for (const bubble of bubbles) {
          tryProcessBubble(bubble, current)
        }
      })

      // Sub-tree changes inside an already-known bubble. This catches the
      // case where the bubble shell was added in a prior mutation (no text
      // yet, so we didn't mark seen) and the text fills in later.
      if (m.type === "childList" && m.target instanceof HTMLElement) {
        const parentBubble = m.target.closest<HTMLElement>("[data-id]")
        if (parentBubble && parentBubble.closest("#main")) {
          tryProcessBubble(parentBubble, current)
        }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  })

  return () => observer.disconnect()
}

// ── Direction detection ────────────────────────────────────────────────
//
// Tried in order of reliability/cheapness:
//   1. Legacy data-id prefix (`true_` / `false_`) — gone in newer builds
//      but harmless to check first.
//   2. Class substring on any ancestor (`message-in` / `message-out`) —
//      WhatsApp uses obfuscated class names now but if the legacy class
//      ever returns this is a free win.
//   3. Position within the row container — outgoing bubbles are right-
//      aligned, incoming are left-aligned. Stable across builds because
//      the visual layout never changes. Returns "unknown" if the row
//      hasn't been laid out yet (rect width is zero).

type Direction = "in" | "out" | "unknown"
type DirectionVia = "prefix" | "class" | "position" | "none"

function detectDirection(bubble: HTMLElement): {
  dir: Direction
  via: DirectionVia
} {
  const id = bubble.getAttribute("data-id") || ""
  if (id.startsWith("true_")) return { dir: "out", via: "prefix" }
  if (id.startsWith("false_")) return { dir: "in", via: "prefix" }

  if (bubble.closest('[class*="message-out"]')) return { dir: "out", via: "class" }
  if (bubble.closest('[class*="message-in"]')) return { dir: "in", via: "class" }

  // Position-based fallback. Walk up to find a row container (any
  // ancestor wider than the bubble itself works as the row).
  let row: HTMLElement | null =
    bubble.closest<HTMLElement>('[role="row"]') ||
    bubble.parentElement
  const bubbleRect = bubble.getBoundingClientRect()
  while (row && row !== document.body) {
    const rect = row.getBoundingClientRect()
    if (rect.width > bubbleRect.width * 1.5 && rect.width > 200) break
    row = row.parentElement
  }

  if (!row) return { dir: "unknown", via: "none" }
  const rowRect = row.getBoundingClientRect()
  if (rowRect.width === 0 || bubbleRect.width === 0) {
    return { dir: "unknown", via: "position" }
  }

  const bubbleCenter = bubbleRect.left + bubbleRect.width / 2
  const rowCenter = rowRect.left + rowRect.width / 2
  return {
    dir: bubbleCenter > rowCenter ? "out" : "in",
    via: "position"
  }
}

// ── Text extraction ────────────────────────────────────────────────────

function extractText(bubble: HTMLElement): string {
  const selectable = bubble.querySelector<HTMLElement>(".selectable-text")
  if (selectable) {
    const txt = (selectable.innerText || selectable.textContent || "").trim()
    if (txt) return txt
  }

  const copyable = bubble.querySelector<HTMLElement>(".copyable-text")
  if (copyable) {
    const txt = (copyable.textContent || "").trim()
    if (txt) return txt
  }

  const dirSpan = bubble.querySelector<HTMLElement>(
    'span[dir="ltr"], span[dir="rtl"], span[dir="auto"]'
  )
  if (dirSpan) {
    const txt = (dirSpan.innerText || dirSpan.textContent || "").trim()
    if (txt) return txt
  }

  return ""
}
