// Background service worker for the extension
// Handles message passing between popup and content scripts

import { API_BASE_URL } from "~/config"

export {}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("WhatsApp Quick Replies installed!")
  } else if (details.reason === "update") {
    console.log("WhatsApp Quick Replies updated!")
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] })
    })
    return true
  }

  if (message.type === "OPEN_WHATSAPP") {
    chrome.tabs.create({ url: "https://web.whatsapp.com" })
    sendResponse({ success: true })
  }

  // Opened from the in-page "Upgrade to Pro" toast when the free quota runs
  // out — sends the user to the website to log in / upgrade.
  if (message.type === "OPEN_UPGRADE") {
    chrome.tabs.create({ url: `${API_BASE_URL}/login` })
    sendResponse({ success: true })
  }

  return false
})

// Guard: in some environments chrome.contextMenus may be undefined
// (missing permission in built manifest, or restricted context).
// Without this guard, the service worker crashes at startup.
if (chrome.contextMenus) {
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
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" })
    }
  })
} else {
  console.warn(
    "[WhatsApp Quick Replies] chrome.contextMenus unavailable — skipping context menu setup"
  )
}
