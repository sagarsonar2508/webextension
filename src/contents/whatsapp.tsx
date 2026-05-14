import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useCallback, useRef } from "react"
import {
  MessageSquare,
  X,
  Search,
  Star,
  ChevronRight
} from "lucide-react"
import type { Template } from "~/types"
import {
  getTemplates,
  getFavoriteTemplates,
  searchTemplates,
  getSettings,
  incrementUsageCount
} from "~/storage"
import {
  getMessageInput,
  getContactName,
  insertTextIntoInput,
  detectSlashCommand,
  sendCurrentMessage,
  SELECTORS
} from "~/utils/whatsapp-dom"
import { processTemplate, getVariableContext } from "~/utils/variables"
import { startIncomingMessageObserver } from "~/utils/whatsapp-incoming"
import { matchRule, type IncomingMessage, type MatchResult } from "~/engine/auto-reply"
import {
  getRules,
  getAutoReplySettings,
  getConversationState,
  recordReply,
  recordTriggered,
  markContactSeen
} from "~/storage/auto-reply"
import { Sparkles } from "lucide-react"

import "~/styles/globals.css"

// Plasmo configuration
export const config: PlasmoCSConfig = {
  matches: ["https://web.whatsapp.com/*"],
  all_frames: true
}

// Sidebar component injected into WhatsApp Web
function WhatsAppSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [favorites, setFavorites] = useState<Template[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([])
  const [showButton, setShowButton] = useState(true)

  // Load templates
  const loadTemplates = useCallback(async () => {
    const allTemplates = await getTemplates()
    const favTemplates = await getFavoriteTemplates()
    const settings = await getSettings()
    setTemplates(allTemplates)
    setFavorites(favTemplates)
    setFilteredTemplates(allTemplates)
    setShowButton(settings.showSidebar)
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Search templates
  useEffect(() => {
    if (searchQuery) {
      searchTemplates(searchQuery).then(setFilteredTemplates)
    } else {
      setFilteredTemplates(templates)
    }
  }, [searchQuery, templates])

  // Insert template into chat
  const handleInsertTemplate = useCallback(async (template: Template) => {
    const contactName = getContactName()
    const context = getVariableContext(contactName)
    const processedContent = processTemplate(template.content, context)

    const success = insertTextIntoInput(processedContent)

    if (success) {
      await incrementUsageCount(template.id)
      setIsOpen(false)
    }
  }, [])

  // Listen for messages from popup
  useEffect(() => {
    const handleMessage = async (
      message: { type: string; payload?: { content: string; templateId: string } },
      _sender: unknown,
      sendResponse: (response: { success: boolean }) => void
    ) => {
      if (message.type === "INSERT_TEMPLATE" && message.payload) {
        const contactName = getContactName()
        const context = getVariableContext(contactName)
        const processedContent = processTemplate(message.payload.content, context)
        insertTextIntoInput(processedContent)
        sendResponse({ success: true })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  if (!showButton) return null

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] w-12 h-12 bg-whatsapp-primary hover:bg-whatsapp-secondary text-white rounded-full shadow-lg flex items-center justify-center transition-all"
        title="Quick Replies"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Sidebar Panel */}
      {isOpen && (
        <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-[9998] flex flex-col">
          {/* Header */}
          <div className="bg-whatsapp-dark text-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Quick Replies</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 text-sm text-gray-900 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          {/* Favorites Section */}
          {!searchQuery && favorites.length > 0 && (
            <div className="p-3 border-b">
              <div className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
                <Star size={14} className="text-yellow-500" />
                Favorites
              </div>
              <div className="space-y-1">
                {favorites.slice(0, 3).map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleInsertTemplate(template)}
                    className="w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {template.title}
                      </span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                    <code className="text-xs text-whatsapp-secondary">
                      {template.shortcut}
                    </code>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="text-sm font-medium text-gray-700 mb-2">
              {searchQuery ? "Search Results" : "All Templates"}
            </div>
            {filteredTemplates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No templates found
              </p>
            ) : (
              <div className="space-y-1">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleInsertTemplate(template)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {template.title}
                      </span>
                      {template.isFavorite && (
                        <Star
                          size={12}
                          className="fill-yellow-400 text-yellow-400"
                        />
                      )}
                    </div>
                    <code className="text-xs text-whatsapp-secondary block mb-1">
                      {template.shortcut}
                    </code>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {template.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t bg-gray-50 text-center">
            <p className="text-xs text-gray-400">
              Type a shortcut like{" "}
              <code className="bg-gray-200 px-1 rounded">/pricing</code> in chat
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// Slash command dropdown component
//
// Why keydown (capture) instead of "input": WhatsApp Web's contenteditable
// runs inside a rich-text framework that calls stopPropagation() on input
// events, so a document-level "input" listener never fires. keydown in
// capture phase reliably runs before WhatsApp's own handlers — same
// mechanism that makes Alt+1 work in KeyboardShortcuts below.
function SlashCommandDropdown() {
  const [isVisible, setIsVisible] = useState(false)
  const [suggestions, setSuggestions] = useState<Template[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  // Refs so the document-level keydown listener (which captures state at
  // mount) can read the latest values without re-binding on every change.
  const templatesRef = useRef<Template[]>([])
  const isVisibleRef = useRef(false)
  const suggestionsRef = useRef<Template[]>([])
  const selectedIndexRef = useRef(0)
  // The actual input the user is typing in, resolved from the most recent
  // keydown's event target. Source of truth for read/replace/position —
  // never trust getMessageInput() here, its selector matches the wrong
  // contenteditable on current WhatsApp builds.
  const currentInputRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])
  useEffect(() => {
    suggestionsRef.current = suggestions
  }, [suggestions])
  useEffect(() => {
    selectedIndexRef.current = selectedIndex
  }, [selectedIndex])

  // Load templates into ref so lookup during keydown is synchronous —
  // necessary because e.preventDefault() can't survive an await.
  useEffect(() => {
    getTemplates().then((t) => {
      templatesRef.current = t
    })

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>
    ) => {
      const entry = changes["whatsapp-quick-replies"]
      const newValue = entry?.newValue as { templates?: Template[] } | undefined
      if (newValue?.templates) {
        templatesRef.current = newValue.templates
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  const replaceShortcut = useCallback(
    (input: HTMLElement, prefix: string, template: Template) => {
      const contactName = getContactName()
      const context = getVariableContext(contactName)
      const processedContent = processTemplate(template.content, context)
      input.focus()

      // Replacing the existing shortcut text in WhatsApp's Lexical-based
      // editor has to thread a narrow gap between two failure modes:
      //
      //   1. Consecutive synchronous execCommand("delete") calls get
      //      batched by Lexical -- only the first fires its beforeinput
      //      handler, the rest silently no-op. ("/pricing<Enter>" left
      //      "/pricin" behind.)
      //
      //   2. execCommand("insertText") is dropped entirely when the
      //      selection covers the editor's whole content (returns true
      //      but the DOM doesn't change). selectNodeContents trips this.
      //      Extending a selection backward via sel.modify also can't
      //      cross the invisible boundary nodes Lexical pads content
      //      with, so an N-iteration extend ends up one short and leaves
      //      the leading "/" behind ("/pricing" -> "/Hi Sonar...").
      //
      // The path that survives both: delete one character per animation
      // frame so Lexical reconciles between each, then once the shortcut
      // is gone insertText into the (no-longer-whole-content) selection.
      // ~16ms per char, visible as a quick backspace animation but
      // reliable.
      const existing = (input.textContent || "").replace(
        /[\u200B-\u200D\uFEFF]/g,
        ""
      )
      const charsToDelete = existing.length - prefix.length

      const anchorAtEnd = () => {
        const sel = window.getSelection()
        if (!sel) return
        sel.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(input)
        range.collapse(false)
        sel.addRange(range)
      }

      const deleteThenContinue = (remaining: number) => {
        if (remaining <= 0) {
          input.focus()
          const ok = document.execCommand("insertText", false, processedContent)
          console.log("[WQR slash] replace done", { ok, processedContent })
          return
        }
        input.focus()
        anchorAtEnd()
        document.execCommand("delete", false)
        requestAnimationFrame(() => deleteThenContinue(remaining - 1))
      }
      deleteThenContinue(charsToDelete)


      // Swallow rejection from chrome.storage when the extension was reloaded
      // mid-session ("Extension context invalidated") — it's noise, not a bug.
      incrementUsageCount(template.id).catch(() => {})
      setIsVisible(false)
    },
    []
  )

  const updateDropdownFromInput = useCallback(() => {
    const input = currentInputRef.current
    if (!input) {
      console.log("[WQR slash] update: no input")
      setIsVisible(false)
      return
    }

    const text = (input.textContent || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+$/, "")
    const { isSlashCommand, command } = detectSlashCommand(text)
    console.log("[WQR slash] update", { text, isSlashCommand, command })

    if (!isSlashCommand) {
      setIsVisible(false)
      return
    }

    const matches = templatesRef.current.filter((t) =>
      t.shortcut.toLowerCase().startsWith(`/${command}`.toLowerCase())
    )

    if (matches.length === 0) {
      setIsVisible(false)
      return
    }

    setSuggestions(matches.slice(0, 5))
    setSelectedIndex(0)

    const rect = input.getBoundingClientRect()
    setPosition({ x: rect.left, y: rect.top - 10 })
    setIsVisible(true)
  }, [])

  useEffect(() => {
    const LOG = "[WQR slash]"

    // Resolve the input element from the event target. WhatsApp's contenteditable
    // wraps text in nested spans, so the keydown target is often a child node, not
    // the input itself. Walking up from the target is more reliable than
    // document.activeElement, which can be the body during composition.
    const findInputFromTarget = (target: EventTarget | null): HTMLElement | null => {
      const cached = getMessageInput()
      if (target instanceof Node) {
        // If event target is inside the input, return the input.
        if (cached && cached.contains(target)) return cached
        // Otherwise walk up looking for any contenteditable ancestor.
        let node: Node | null = target
        while (node && node !== document) {
          if (
            node instanceof HTMLElement &&
            node.getAttribute("contenteditable") === "true"
          ) {
            return node
          }
          node = node.parentNode
        }
      }
      return null
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const input = findInputFromTarget(e.target)
      if (!input) return

      // Anchor all reads/writes/positioning to the element the user is
      // actually typing in for the rest of this keystroke and the
      // subsequent setTimeout(updateDropdownFromInput).
      currentInputRef.current = input

      // Lexical pads textContent with zero-width spaces and sometimes trailing
      // whitespace for cursor placement. Strip them before matching — otherwise
      // the trailing `$` anchor never matches `/pricing` and Enter falls
      // through unprocessed.
      const textBefore = (input.textContent || "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+$/, "")

      // 1) Dropdown navigation while visible
      if (isVisibleRef.current && suggestionsRef.current.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) =>
            prev < suggestionsRef.current.length - 1 ? prev + 1 : 0
          )
          return
        }
        if (e.key === "ArrowUp") {
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestionsRef.current.length - 1
          )
          return
        }
        if (e.key === "Tab") {
          const picked = suggestionsRef.current[selectedIndexRef.current]
          if (picked) {
            e.preventDefault()
            e.stopPropagation()
            const m = textBefore.match(/^(.*)\/(\w*)$/)
            replaceShortcut(input, m ? m[1] : "", picked)
          }
          return
        }
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          setIsVisible(false)
          return
        }
      }

      // 2) Auto-replace on Space or Enter when the trailing token is an
      // exact known shortcut. This is what makes /pricing<Enter> "just work".
      if (e.key === " " || e.key === "Enter") {
        const m = textBefore.match(/^(.*?)\/(\w+)$/)
        console.log(LOG, "space/enter", { textBefore, match: m })
        if (m) {
          const prefix = m[1]
          const shortcut = `/${m[2]}`
          const exact = templatesRef.current.find(
            (t) => t.shortcut.toLowerCase() === shortcut.toLowerCase()
          )
          console.log(LOG, "lookup", {
            shortcut,
            found: !!exact,
            templates: templatesRef.current.length
          })
          if (exact) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            replaceShortcut(input, prefix, exact)
            return
          }
        }
      }

      // 3) Any other key — let it through, then refresh dropdown
      // suggestions against the updated input text on the next tick.
      setTimeout(updateDropdownFromInput, 0)
    }

    // window + capture fires earlier in the dispatch chain than document.
    // If WhatsApp's own handlers stopImmediatePropagation on document, we
    // still see the event here.
    window.addEventListener("keydown", handleKeyDown, true)
    console.log(LOG, "listener installed")
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [replaceShortcut, updateDropdownFromInput])

  if (!isVisible || suggestions.length === 0) return null

  return (
    <div
      className="fixed z-[10000] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[250px]"
      style={{
        left: `${position.x}px`,
        bottom: `${window.innerHeight - position.y}px`
      }}
    >
      {suggestions.map((template, index) => {
        const input = currentInputRef.current
        const text = input?.textContent || ""
        const m = text.match(/^(.*)\/(\w*)$/)
        const prefix = m ? m[1] : ""
        return (
          <button
            key={template.id}
            onClick={() => input && replaceShortcut(input, prefix, template)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
              index === selectedIndex ? "bg-whatsapp-light" : "hover:bg-gray-50"
            }`}
          >
            <code className="text-sm text-whatsapp-secondary font-medium">
              {template.shortcut}
            </code>
            <span className="text-sm text-gray-700 truncate">
              {template.title}
            </span>
          </button>
        )
      })}
      <div className="px-3 py-1.5 border-t text-xs text-gray-400">
        <kbd className="bg-gray-100 px-1 rounded">Tab</kbd>,{" "}
        <kbd className="bg-gray-100 px-1 rounded">Space</kbd> or{" "}
        <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> to insert
      </div>
    </div>
  )
}

// Keyboard shortcuts handler
function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Alt + 1-5 for quick favorites
      if (e.altKey && e.key >= "1" && e.key <= "5") {
        const settings = await getSettings()
        if (!settings.enableKeyboardShortcuts) return

        const favorites = await getFavoriteTemplates()
        const index = parseInt(e.key) - 1

        if (favorites[index]) {
          e.preventDefault()
          const template = favorites[index]
          const contactName = getContactName()
          const context = getVariableContext(contactName)
          const processedContent = processTemplate(template.content, context)
          insertTextIntoInput(processedContent)
          await incrementUsageCount(template.id)
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return null
}

// Auto-reply suggestion banner.
//
// Subscribes to incoming-message events from the observer. For each message,
// pulls rules + per-contact state + global settings from chrome.storage and
// runs the engine. A match opens a small floating card above the WhatsApp
// input — never auto-sends, never overwrites what the user is typing. The
// user explicitly clicks Insert to drop the suggestion into the message box,
// or Dismiss to hide it.
//
// Why a banner and not a draft pre-fill: pre-filling clobbers in-progress
// typing and is hard to undo. A banner is opt-in by click, so the worst case
// is "ignored" rather than "deleted my draft".
function AutoReplySuggestion() {
  const [suggestion, setSuggestion] = useState<MatchResult | null>(null)
  const [contactName, setContactName] = useState("")
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback((markSeen: boolean) => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }
    setSuggestion((prev) => {
      // Mark this contact as "seen" so first-message trigger doesn't re-fire
      // every time they message again, even if we never inserted a reply.
      if (markSeen && prev) {
        markContactSeen(contactName).catch(() => {})
      }
      return null
    })
  }, [contactName])

  const handleInsert = useCallback(async () => {
    if (!suggestion) return
    const ok = insertTextIntoInput(suggestion.rendered)
    if (ok) {
      await recordReply(contactName, suggestion.rule.id)
      await recordTriggered(suggestion.rule.id)
    }
    dismiss(false)
  }, [suggestion, contactName, dismiss])

  useEffect(() => {
    const LOG = "[WQR/handler]"
    const handleIncoming = async (msg: IncomingMessage) => {
      const [rules, settings, state] = await Promise.all([
        getRules(),
        getAutoReplySettings(),
        getConversationState(msg.contactId)
      ])
      console.log(`${LOG} incoming`, {
        text: msg.text.slice(0, 80),
        contact: msg.contactName,
        rules: rules.length,
        enabled: rules.filter((r) => r.enabled).length,
        master: settings.masterEnabled,
        mode: settings.globalMode,
        hasState: !!state
      })

      const result = matchRule({
        message: msg,
        rules,
        state,
        settings,
        now: Date.now()
      })

      if (!result) return

      if (result.rule.mode === "auto") {
        const inserted = insertTextIntoInput(result.rendered)
        console.log(`${LOG} auto-send: insert`, { ok: inserted })
        if (!inserted) return
        setTimeout(() => {
          const sent = sendCurrentMessage()
          console.log(`${LOG} auto-send: send`, { ok: sent })
          if (!sent) return
          recordReply(msg.contactId, result.rule.id).catch(() => {})
          recordTriggered(result.rule.id).catch(() => {})
        }, 250)
        return
      }

      console.log(`${LOG} suggest banner shown`, { rule: result.rule.name })

      // Replace any in-flight suggestion (don't stack banners). Reset the
      // 30s auto-dismiss timer for the new one.
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      setContactName(msg.contactName)
      setSuggestion(result)
      dismissTimer.current = setTimeout(() => {
        markContactSeen(msg.contactId).catch(() => {})
        setSuggestion(null)
      }, 30_000)
    }

    const stop = startIncomingMessageObserver(handleIncoming)

    // Console helper for manual testing. Find the last incoming bubble in
    // the open chat, parse it, and re-run the engine — bypasses the seen-set
    // so a user can verify their rules without needing a fresh message to
    // arrive. Call `__wqrTest()` in DevTools.
    const findLastIncomingBubble = (): HTMLElement | null => {
      const bubbles = Array.from(
        document.querySelectorAll<HTMLElement>("#main [data-id]")
      ).reverse()
      for (const b of bubbles) {
        const id = b.getAttribute("data-id") || ""
        if (id.startsWith("false_")) return b
        if (
          !id.startsWith("true_") &&
          b.closest('[class*="message-in"]')
        ) {
          return b
        }
      }
      return null
    }

    ;(window as unknown as { __wqrTest: () => void }).__wqrTest = () => {
      const bubble = findLastIncomingBubble()
      if (!bubble) {
        console.log("[WQR auto-reply] __wqrTest: no incoming bubble found in #main")
        return
      }
      const id = bubble.getAttribute("data-id") || ""
      const sel = bubble.querySelector<HTMLElement>(".selectable-text")
      const text = (
        sel?.innerText ||
        bubble.querySelector<HTMLElement>(".copyable-text")?.textContent ||
        ""
      ).trim()
      const contact = getContactName() || "there"
      console.log("[WQR auto-reply] __wqrTest: replaying", { id, text, contact })
      if (!text) {
        console.log("[WQR auto-reply] __wqrTest: bubble has no text, aborting")
        return
      }
      handleIncoming({
        id: `__test_${Date.now()}`,
        contactId: contact,
        contactName: contact,
        text,
        timestamp: Date.now()
      })
    }

    return () => {
      stop()
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
      delete (window as unknown as { __wqrTest?: () => void }).__wqrTest
    }
  }, [])

  if (!suggestion) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] bg-white rounded-xl shadow-2xl border border-whatsapp-light w-[420px] max-w-[90vw]">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-whatsapp-light/30">
        <Sparkles size={14} className="text-whatsapp-secondary" />
        <span className="text-xs font-medium text-gray-700">
          Suggested reply for {contactName || "this chat"}
        </span>
        <code className="ml-auto text-[10px] text-gray-400 truncate max-w-[120px]">
          {suggestion.rule.name}
        </code>
      </div>
      <div className="px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
        {suggestion.rendered}
      </div>
      <div className="flex gap-2 px-4 py-2 border-t bg-gray-50">
        <button
          onClick={() => dismiss(true)}
          className="flex-1 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
          Dismiss
        </button>
        <button
          onClick={handleInsert}
          className="flex-1 px-3 py-1.5 text-sm text-white bg-whatsapp-primary rounded-lg hover:bg-whatsapp-secondary transition-colors">
          Insert reply
        </button>
      </div>
    </div>
  )
}

// Main content script component
export default function WhatsAppContentScript() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Wait for WhatsApp Web to load
    const checkLoaded = setInterval(() => {
      if (document.querySelector(SELECTORS.appContainer)) {
        setIsLoaded(true)
        clearInterval(checkLoaded)
      }
    }, 500)

    return () => clearInterval(checkLoaded)
  }, [])

  if (!isLoaded) return null

  return (
    <>
      <WhatsAppSidebar />
      <SlashCommandDropdown />
      <KeyboardShortcuts />
      <AutoReplySuggestion />
    </>
  )
}
