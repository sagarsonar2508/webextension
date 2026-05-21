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
const LOG = "[AR/obs]"

// Chat history renders a tick after the chat opens — retry the latest-unread
// scan until #main is populated before giving up.
const SCAN_RETRIES = 6
const SCAN_INTERVAL = 400  // ms between retries

export function startIncomingMessageObserver(
  handler: IncomingHandler
): () => void {
  const seenIds = new Set<string>()
  let lastContact = ""
  // While a chat-switch scan is in progress, the live bubble path is muted —
  // otherwise the history flood loading in would replay as "new" messages.
  let suppressLive = false
  // Set on cleanup so a disconnected observer's pending timeouts go silent
  // (a stale instance must never fire the handler).
  let stopped = false

  console.log(`${LOG} start (build: auto-send-off)`)

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

  // Scan the open chat for the most recent incoming bubble and fire the
  // handler for it. Retries on an interval because chat history renders
  // progressively — the bubbles aren't all in the DOM the instant a chat
  // opens. Once it finds a message (or exhausts retries) it snapshots the
  // history as "seen" and lifts the live-path suppression. The engine's
  // rate-limit and per-contact state stop this from re-firing old replies.
  const processLatestIncoming = (contactName: string, attempt = 0) => {
    // Aborted: observer disconnected, or the user switched chats again
    // while this scan was retrying.
    if (stopped || contactName !== lastContact) return

    const bubbles = Array.from(
      document.querySelectorAll<HTMLElement>("#main [data-id]")
    )
    const sum = { in: 0, out: 0, unknown: 0 }
    let found: { id: string; text: string; via: DirectionVia } | null = null
    let viaTrace = ""

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i]
      const { dir, via } = detectDirection(bubble)
      sum[dir]++
      if (found) continue
      if (i >= bubbles.length - 4) viaTrace += ` ${dir}/${via}`
      if (dir !== "in") continue
      const text = extractText(bubble)
      if (!text) continue
      found = {
        // Deterministic fallback id (not Date.now()) so the dedup downstream
        // recognises the same message across repeated scans.
        id:
          bubble.getAttribute("data-id") ||
          `synth:${contactName}:${text.slice(0, 40)}`,
        text,
        via
      }
    }

    // History likely still loading — retry quietly before giving up.
    if (!found && attempt < SCAN_RETRIES) {
      setTimeout(
        () => processLatestIncoming(contactName, attempt + 1),
        SCAN_INTERVAL
      )
      return
    }

    console.log(
      `${LOG} scan(try=${attempt}): in=${sum.in} out=${sum.out} unk=${sum.unknown} bubbles=${bubbles.length}`
    )

    // History is loaded now — mark it seen and re-enable the live path.
    snapshotHistorySeen()
    suppressLive = false

    if (!found) {
      // Geometry of the newest bubble vs #main — pinpoints direction bugs.
      const main = document.querySelector<HTMLElement>("#main")
      const last = bubbles[bubbles.length - 1]
      let geo = "n/a"
      if (main && last) {
        const m = main.getBoundingClientRect()
        const b = last.getBoundingClientRect()
        geo = `main[L${Math.round(m.left)} R${Math.round(m.right)}] bubble[L${Math.round(b.left)} R${Math.round(b.right)} w${Math.round(b.width)}]`
      }
      console.log(
        `${LOG} latest: no incoming bubble (last4:${viaTrace || " none"}) ${geo}`
      )
      return
    }
    const safeName = contactName || "there"
    console.log(
      `${LOG} latest in → handler: "${found.text.slice(0, 60)}" (via=${found.via})`
    )
    handler({
      id: found.id,
      contactId: safeName,
      contactName: safeName,
      text: found.text,
      timestamp: Date.now()
    })
  }

  // Initial scan, deferred so #main has time to start rendering.
  setTimeout(() => {
    if (stopped) return
    lastContact = getContactName()
    suppressLive = true
    console.log(`${LOG} init: contact="${lastContact}"`)
    processLatestIncoming(lastContact)
  }, 800)

  // Per-burst tally — flushed as one line so a burst is easy to read/share.
  const burst = { in: 0, out: 0, unknown: 0, notext: 0, seen: 0, supp: 0 }

  const tryProcessBubble = (bubble: HTMLElement, contactName: string) => {
    const id = bubble.getAttribute("data-id")
    if (!id) return
    // Muted during a chat-switch scan — those bubbles are old history.
    if (suppressLive) {
      burst.supp++
      return
    }
    if (seenIds.has(id)) {
      burst.seen++
      return
    }

    const { dir, via } = detectDirection(bubble)
    if (dir === "out") {
      seenIds.add(id)
      burst.out++
      return
    }
    if (dir === "unknown") {
      // Direction not resolvable yet (rect 0 / not laid out). Don't mark
      // seen — the next mutation tick takes another pass.
      burst.unknown++
      return
    }

    const text = extractText(bubble)
    if (!text) {
      // Text hasn't rendered yet — let the next mutation pass retry.
      burst.notext++
      return
    }

    seenIds.add(id)
    burst.in++
    const safeName = contactName || "there"
    console.log(
      `${LOG} bubble in → handler: "${text.slice(0, 60)}" (via=${via})`
    )
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
      console.log(
        `${LOG} mutation burst: ${addedBubbleCount} bubbles | in=${burst.in} out=${burst.out} unk=${burst.unknown} notext=${burst.notext} seen=${burst.seen} supp=${burst.supp}`
      )
      addedBubbleCount = 0
      burst.in = burst.out = burst.unknown = 0
      burst.notext = burst.seen = burst.supp = 0
    }
    mutationTick = null
  }

  const observer = new MutationObserver((mutations) => {
    const current = getContactName()
    if (current && current !== lastContact) {
      console.log(`${LOG} chat switch: "${lastContact}" → "${current}"`)
      lastContact = current
      suppressLive = true   // mute live path until the scan completes
      setTimeout(() => processLatestIncoming(current), 300)
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

  return () => {
    stopped = true
    observer.disconnect()
  }
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
type DirectionVia = "prefix" | "class" | "status" | "position" | "none"

function detectDirection(bubble: HTMLElement): {
  dir: Direction
  via: DirectionVia
} {
  const id = bubble.getAttribute("data-id") || ""
  if (id.startsWith("true_")) return { dir: "out", via: "prefix" }
  if (id.startsWith("false_")) return { dir: "in", via: "prefix" }

  if (bubble.closest('[class*="message-out"]')) return { dir: "out", via: "class" }
  if (bubble.closest('[class*="message-in"]')) return { dir: "in", via: "class" }

  // Delivery-status icon. Outgoing messages always carry a status icon —
  // pending clock, sent/delivered/read tick. Incoming messages never do.
  // `data-icon` is one of WhatsApp's most stable attributes, so this is the
  // most reliable signal and the one that stops auto-replies from looping on
  // their own sent message.
  const hasStatusIcon = Array.from(
    bubble.querySelectorAll<HTMLElement>("[data-icon]")
  ).some((el) => {
    const ic = el.getAttribute("data-icon") || ""
    return /check|dblcheck|msg-time|status-time/i.test(ic)
  })
  if (hasStatusIcon) return { dir: "out", via: "status" }

  // Position-based fallback. Incoming bubbles hug the LEFT edge of the
  // conversation pane, outgoing hug the RIGHT. Measure the bubble's gap to
  // each edge of #main — a stable, reliably full-width reference frame.
  // (The old "walk up to any wider ancestor" heuristic could latch onto a
  // narrow off-centre wrapper and misread every bubble as outgoing.)
  const main = document.querySelector<HTMLElement>("#main")
  const bubbleRect = bubble.getBoundingClientRect()
  if (!main || bubbleRect.width === 0) {
    return { dir: "unknown", via: "position" }
  }
  const mainRect = main.getBoundingClientRect()
  if (mainRect.width === 0) {
    return { dir: "unknown", via: "position" }
  }

  const gapLeft = bubbleRect.left - mainRect.left
  const gapRight = mainRect.right - bubbleRect.right
  return {
    dir: gapRight < gapLeft ? "out" : "in",
    via: "position"
  }
}

// True only if the NEWEST message bubble in the open chat is incoming (from
// the customer). Auto-send uses this as a hard guard: if the last message in
// the conversation is one of ours, no reply is sent.
export function isLastMessageIncoming(): boolean {
  const bubbles = document.querySelectorAll<HTMLElement>("#main [data-id]")
  const last = bubbles[bubbles.length - 1]
  if (!last) return false
  return detectDirection(last).dir === "in"
}

/**
 * Return the text of the most recent incoming (customer) message in the
 * open chat — or empty string if there isn't one. Used by the AI-suggest
 * button as the prompt context.
 */
export function getLastIncomingMessageText(): string {
  const bubbles = Array.from(
    document.querySelectorAll<HTMLElement>("#main [data-id]")
  ).reverse()
  for (const b of bubbles) {
    if (detectDirection(b).dir !== "in") continue
    const text = extractText(b)
    if (text) return text
  }
  return ""
}

// ── Text extraction ────────────────────────────────────────────────────

// WhatsApp renders the message timestamp as a trailing inline element inside
// the text span (a layout filler so the last line wraps around the clock).
// It bleeds into innerText/textContent as e.g. "Hi5:50 pm" — strip a trailing
// clock token so trigger matching sees the real message.
function stripTimestamp(text: string): string {
  return text.replace(/\s*\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?\s*$/i, "").trim()
}

function extractText(bubble: HTMLElement): string {
  const selectable = bubble.querySelector<HTMLElement>(".selectable-text")
  if (selectable) {
    const txt = stripTimestamp(
      (selectable.innerText || selectable.textContent || "").trim()
    )
    if (txt) return txt
  }

  const copyable = bubble.querySelector<HTMLElement>(".copyable-text")
  if (copyable) {
    const txt = stripTimestamp((copyable.textContent || "").trim())
    if (txt) return txt
  }

  const dirSpan = bubble.querySelector<HTMLElement>(
    'span[dir="ltr"], span[dir="rtl"], span[dir="auto"]'
  )
  if (dirSpan) {
    const txt = stripTimestamp(
      (dirSpan.innerText || dirSpan.textContent || "").trim()
    )
    if (txt) return txt
  }

  return ""
}
