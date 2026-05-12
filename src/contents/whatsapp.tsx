import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useCallback } from "react"
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
  getCurrentInputText,
  detectSlashCommand,
  waitForElement,
  SELECTORS
} from "~/utils/whatsapp-dom"
import { processTemplate, getVariableContext } from "~/utils/variables"

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
      _sender: chrome.runtime.MessageSender,
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
              Type <code className="bg-gray-200 px-1 rounded">/shortcut</code>{" "}
              in chat
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// Slash command dropdown component
function SlashCommandDropdown() {
  const [isVisible, setIsVisible] = useState(false)
  const [suggestions, setSuggestions] = useState<Template[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let inputObserver: MutationObserver | null = null

    const setupObserver = async () => {
      // Wait for WhatsApp to load
      await waitForElement(SELECTORS.appContainer)

      const checkInput = () => {
        const input = getMessageInput()
        if (!input) return

        const text = getCurrentInputText()
        const { isSlashCommand, command } = detectSlashCommand(text)

        if (isSlashCommand && command.length >= 0) {
          // Get matching templates
          getTemplates().then((templates) => {
            const matches = templates.filter((t) =>
              t.shortcut.toLowerCase().includes(`/${command}`.toLowerCase())
            )

            if (matches.length > 0) {
              setSuggestions(matches.slice(0, 5))
              setSelectedIndex(0)

              // Position dropdown near input
              const rect = input.getBoundingClientRect()
              setPosition({
                x: rect.left,
                y: rect.top - 10
              })
              setIsVisible(true)
            } else {
              setIsVisible(false)
            }
          })
        } else {
          setIsVisible(false)
        }
      }

      // Observe input changes
      inputObserver = new MutationObserver(() => {
        checkInput()
      })

      // Monitor for input
      document.addEventListener("input", checkInput)

      return () => {
        document.removeEventListener("input", checkInput)
        inputObserver?.disconnect()
      }
    }

    setupObserver()
  }, [])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (suggestions[selectedIndex]) {
          e.preventDefault()
          insertTemplate(suggestions[selectedIndex])
        }
      } else if (e.key === "Escape") {
        setIsVisible(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, suggestions, selectedIndex])

  const insertTemplate = async (template: Template) => {
    const contactName = getContactName()
    const context = getVariableContext(contactName)
    const processedContent = processTemplate(template.content, context)

    // Replace the slash command with template content
    const input = getMessageInput()
    if (input) {
      input.focus()
      document.execCommand("selectAll", false)
      document.execCommand("insertText", false, processedContent)
    }

    await incrementUsageCount(template.id)
    setIsVisible(false)
  }

  if (!isVisible || suggestions.length === 0) return null

  return (
    <div
      className="fixed z-[10000] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[250px]"
      style={{
        left: `${position.x}px`,
        bottom: `${window.innerHeight - position.y}px`
      }}
    >
      {suggestions.map((template, index) => (
        <button
          key={template.id}
          onClick={() => insertTemplate(template)}
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
      ))}
      <div className="px-3 py-1.5 border-t text-xs text-gray-400">
        <kbd className="bg-gray-100 px-1 rounded">Tab</kbd> or{" "}
        <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> to select
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
    </>
  )
}
