import type { PlasmoCSConfig } from "plasmo"
import { connectAccount } from "~/storage/account"

// Runs on the QuickReplies website only. Two responsibilities:
//
//   1. Tell the page the extension is installed (so the dashboard can swap
//      its "paste this token" UI for a one-click "Connect this device" button).
//   2. Intercept the click on that button, write the token straight into the
//      extension's storage, and report success back via a CustomEvent.
//
// To enable on production, add the deployed origin to `matches` below AND to
// `host_permissions` in package.json.
export const config: PlasmoCSConfig = {
  matches: ["http://localhost:3000/*"],
  run_at: "document_start"
}

// Marker the dashboard probes for. Set as early as possible (document_start)
// so the React mount on /dashboard already sees it.
try {
  document.documentElement.setAttribute(
    "data-quickreplies-extension",
    chrome.runtime.getManifest().version
  )
} catch {
  // documentElement may not exist for a tick on the very earliest fragments —
  // a no-op here is fine, the click handler still works.
}

// One-click connect. Any element on the page carrying
// `data-quickreplies-connect="<token>"` becomes the connect button — we read
// the token, save it, and dispatch the result so the dashboard can flip UI.
document.addEventListener("click", async (e) => {
  const target = e.target as Element | null
  const node = target?.closest?.("[data-quickreplies-connect]")
  if (!(node instanceof HTMLElement)) return

  e.preventDefault()
  const token = node.getAttribute("data-quickreplies-connect") || ""
  let ok = true
  let error: string | undefined
  try {
    await connectAccount(token)
  } catch (err) {
    ok = false
    error = err instanceof Error ? err.message : String(err)
  }
  window.dispatchEvent(
    new CustomEvent("quickreplies:connected", { detail: { ok, error } })
  )
})

// Plasmo wants a default export for tsx content scripts — nothing to render.
export default function _NoUI() {
  return null
}
