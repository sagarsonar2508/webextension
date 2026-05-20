import { useEffect, useState, useCallback } from "react"
import { X, Plus } from "lucide-react"
import type { Contact, LeadStatus } from "~/types"
import { LEAD_STATUSES } from "~/types"
import { getContact, upsertContact } from "~/storage/crm"

// Editable CRM card for a single contact. Used both in the popup's CRM tab
// and in the WhatsApp Web sidebar (for whoever's chat is open).

interface ContactCardProps {
  name: string
  onClose?: () => void
  onSaved?: (c: Contact) => void
}

export function ContactCard({ name, onClose, onSaved }: ContactCardProps) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [note, setNote] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getContact(name).then((c) => {
      if (cancelled) return
      setContact(c)
      setNote(c?.note ?? "")
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [name])

  const save = useCallback(
    async (patch: Partial<Pick<Contact, "status" | "tags" | "note">>) => {
      const saved = await upsertContact(name, patch)
      setContact(saved)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)
      onSaved?.(saved)
    },
    [name, onSaved]
  )

  const status: LeadStatus = contact?.status ?? "new"
  const tags = contact?.tags ?? []

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) {
      setTagInput("")
      return
    }
    save({ tags: [...tags, t] })
    setTagInput("")
  }

  const removeTag = (t: string) => save({ tags: tags.filter((x) => x !== t) })

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-400">Loading contact…</div>
    )
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400">
            {savedFlash ? "Saved ✓" : contact ? "Lead card" : "New lead"}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-500">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Lead status */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => save({ status: s.value })}
                className="px-2 py-1 rounded-full text-xs font-medium border transition-colors"
                style={
                  status === s.value
                    ? { background: s.color, color: "#fff", borderColor: s.color }
                    : { color: "#4b5563", borderColor: "#e5e7eb" }
                }>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-whatsapp-light text-xs text-whatsapp-dark">
                {t}
                <button
                  onClick={() => removeTag(t)}
                  className="hover:text-red-500">
                  <X size={11} />
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-gray-400">No tags yet</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add a tag…"
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-whatsapp-primary"
            />
            <button
              onClick={addTag}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Note */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Note</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (contact?.note ?? "") && save({ note })}
            rows={3}
            placeholder="Anything worth remembering about this contact…"
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none focus:outline-none focus:border-whatsapp-primary"
          />
        </div>
      </div>
    </div>
  )
}
