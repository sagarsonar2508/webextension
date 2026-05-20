import { useEffect, useState, useCallback } from "react"
import { Users, Search, ChevronRight } from "lucide-react"
import type { Contact, LeadStatus } from "~/types"
import { LEAD_STATUSES } from "~/types"
import { listContacts } from "~/storage/crm"
import { ContactCard } from "./ContactCard"

// CRM tab in the popup: a searchable, status-filterable list of saved
// contacts. Picking one opens its editable lead card. New contacts get added
// automatically from the WhatsApp Web sidebar as you chat.

const statusMeta = (s: LeadStatus) =>
  LEAD_STATUSES.find((x) => x.value === s) ?? LEAD_STATUSES[0]

export function CrmPanel() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<LeadStatus | "all">("all")
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    setContacts(await listContacts())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (selected) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ContactCard
          name={selected}
          onClose={() => {
            setSelected(null)
            load()
          }}
          onSaved={load}
        />
      </div>
    )
  }

  const filtered = contacts.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search + filter */}
      <div className="p-3 border-b bg-white space-y-2">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-whatsapp-primary"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {LEAD_STATUSES.map((s) => (
            <Chip
              key={s.value}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin w-6 h-6 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Users size={42} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">
              {contacts.length === 0
                ? "No contacts yet. Open a chat in WhatsApp Web — the sidebar lets you save notes, tags and lead status."
                : "No contacts match this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((c) => {
              const meta = statusMeta(c.status)
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.name)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 text-left">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: meta.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {meta.label}
                      {c.tags.length > 0 && ` · ${c.tags.join(", ")}`}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-gray-300 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-whatsapp-primary text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}>
      {children}
    </button>
  )
}
