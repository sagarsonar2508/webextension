import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { aiSuggest, ApiError } from "~/api/client"
import { getAccount } from "~/storage/account"
import { getLastIncomingMessageText } from "~/utils/whatsapp-incoming"
import { getContactName, setMessageInputText } from "~/utils/whatsapp-dom"
import { registerAiReply } from "~/engine/usage"
import { captureError } from "~/utils/telemetry"

const TONES = ["friendly", "formal", "concise", "warm"] as const
type Tone = (typeof TONES)[number]

// The sidebar's "AI draft" panel. Reads the most recent incoming message,
// calls /api/ai/suggest with the chosen tone, and drops the result into the
// WhatsApp input. Quota-aware: shows the remaining AI calls and disables
// when over the limit.
export function AiSuggestButton({
  onAfterInsert
}: {
  onAfterInsert?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [tone, setTone] = useState<Tone>("friendly")
  const [error, setError] = useState("")
  const [draft, setDraft] = useState("")
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(
    null
  )

  const generate = async () => {
    setBusy(true)
    setError("")
    setDraft("")
    try {
      const acc = await getAccount()
      if (!acc.token) {
        setError("Connect your account in settings to use AI suggestions.")
        return
      }
      const message = getLastIncomingMessageText()
      if (!message) {
        setError("Open a chat with an incoming message first.")
        return
      }
      const res = await aiSuggest(acc.token, {
        message,
        contactName: getContactName(),
        tone
      })
      setDraft(res.reply)
      setUsage({ used: res.aiUsed, limit: res.aiLimit })
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setError("AI quota reached for the month — upgrade for more.")
      } else if (e instanceof ApiError && e.status === 401) {
        setError("Please reconnect your account.")
      } else {
        setError(e instanceof Error ? e.message : "AI request failed")
        captureError(e, { phase: "ai-suggest" })
      }
    } finally {
      setBusy(false)
    }
  }

  const insert = async () => {
    if (!draft) return
    const ok = setMessageInputText(draft)
    if (!ok) {
      setError("Could not insert — open the chat box and try again.")
      return
    }
    await registerAiReply(`ai-${Date.now()}`, draft.length).catch(() => {})
    setDraft("")
    onAfterInsert?.()
  }

  return (
    <div className="p-3 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Sparkles size={14} className="text-whatsapp-secondary" />
          AI draft
        </h3>
        {usage && (
          <span className="text-xs text-gray-500">
            {usage.used}/{usage.limit} this month
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {TONES.map((t) => (
          <button
            key={t}
            onClick={() => setTone(t)}
            className={`px-2 py-0.5 rounded-full text-xs ${tone === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      <button
        onClick={generate}
        disabled={busy}
        className="mt-2 w-full py-2 rounded-lg bg-whatsapp-primary text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Drafting…
          </>
        ) : (
          "Draft reply"
        )}
      </button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {draft && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full p-2 text-sm border border-gray-200 rounded-lg"
            rows={3}
          />
          <button
            onClick={insert}
            className="mt-1 w-full py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">
            Insert into chat
          </button>
        </div>
      )}
    </div>
  )
}
