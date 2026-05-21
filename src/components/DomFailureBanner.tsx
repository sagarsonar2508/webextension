import { useEffect, useState } from "react"
import { AlertTriangle, X } from "lucide-react"
import type { DomFailureKind } from "~/utils/whatsapp-dom"

// Shown when our WhatsApp DOM selectors stop matching — i.e. WhatsApp
// shipped a layout change and we haven't pushed a fix yet. Far better than
// the extension silently doing nothing.
//
// The banner self-dismisses after 5 minutes and is dismissible by the user.
// utils/whatsapp-dom.ts dispatches `quickreplies:dom-failure` events; we
// listen for them here.

interface FailureState {
  kind: DomFailureKind
  at: number
}

const HUMAN_LABEL: Record<DomFailureKind, string> = {
  message_input: "the message box",
  send_button: "the send button",
  contact_name: "the contact name",
  chat_container: "the chat panel"
}

export function DomFailureBanner() {
  const [failure, setFailure] = useState<FailureState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onFailure = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { kind: DomFailureKind; at: number }
        | undefined
      if (!detail) return
      setFailure({ kind: detail.kind, at: detail.at })
      setDismissed(false)
    }
    window.addEventListener("quickreplies:dom-failure", onFailure)
    return () =>
      window.removeEventListener("quickreplies:dom-failure", onFailure)
  }, [])

  if (!failure || dismissed) return null
  // Auto-hide stale banners on next mount.
  if (Date.now() - failure.at > 5 * 60 * 1000) return null

  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[10001] max-w-md w-[calc(100%-2rem)] bg-amber-50 border border-amber-300 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-amber-900">
          WhatsApp Quick Replies needs an update
        </p>
        <p className="mt-0.5 text-amber-800">
          WhatsApp Web changed {HUMAN_LABEL[failure.kind]}, so some features
          may not work. We&apos;ve been notified — try refreshing in a few
          minutes, or check for an extension update.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-amber-700 hover:text-amber-900 shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
