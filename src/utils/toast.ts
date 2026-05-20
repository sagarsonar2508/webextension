// Minimal in-page toast for the WhatsApp Web content script.
//
// Appends straight to document.body (outside the extension's shadow root), so
// it uses inline styles — it must not depend on the extension's Tailwind CSS.

interface ToastAction {
  label: string
  onClick: () => void
}

let activeToast: HTMLElement | null = null

export function showToast(
  message: string,
  opts: { action?: ToastAction; duration?: number } = {}
): void {
  activeToast?.remove()

  const toast = document.createElement("div")
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "80px",
    right: "20px",
    zIndex: "2147483647",
    maxWidth: "320px",
    padding: "12px 14px",
    background: "#111b21",
    color: "#fff",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    font: "14px/1.4 -apple-system, Segoe UI, Roboto, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  } as CSSStyleDeclaration)

  const text = document.createElement("span")
  text.textContent = message
  toast.appendChild(text)

  if (opts.action) {
    const btn = document.createElement("button")
    btn.textContent = opts.action.label
    Object.assign(btn.style, {
      alignSelf: "flex-start",
      padding: "5px 10px",
      background: "#00a884",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      font: "600 13px -apple-system, Segoe UI, Roboto, sans-serif"
    } as CSSStyleDeclaration)
    const action = opts.action
    btn.addEventListener("click", () => {
      action.onClick()
      toast.remove()
    })
    toast.appendChild(btn)
  }

  document.body.appendChild(toast)
  activeToast = toast

  setTimeout(() => {
    if (activeToast === toast) activeToast = null
    toast.remove()
  }, opts.duration ?? 6000)
}

/** Shown when the free reply quota is exhausted. */
export function showQuotaToast(): void {
  showToast("You've used all your free replies this month.", {
    action: {
      label: "Upgrade to Pro",
      onClick: () =>
        chrome.runtime.sendMessage({ type: "OPEN_UPGRADE" })
    },
    duration: 8000
  })
}
