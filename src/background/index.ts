import type { PlasmoMessaging } from "@plasmohq/messaging"

// Background service worker for the extension
// Handles message passing between popup and content scripts

export {}

// Listen for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("WhatsApp Quick Replies installed!")
    // Could open onboarding page here
  } else if (details.reason === "update") {
    console.log("WhatsApp Quick Replies updated!")
  }
})

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_INFO") {
    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] })
    })
    return true // Keep channel open for async response
  }

  if (message.type === "OPEN_WHATSAPP") {
    // Open WhatsApp Web in new tab
    chrome.tabs.create({ url: "https://web.whatsapp.com" })
    sendResponse({ success: true })
  }

  return false
})

// Context menu for quick access (optional)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-quick-replies",
    title: "Open Quick Replies",
    contexts: ["page"],
    documentUrlPatterns: ["https://web.whatsapp.com/*"]
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-quick-replies" && tab?.id) {
    // Send message to content script to open sidebar
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" })
  }
})
