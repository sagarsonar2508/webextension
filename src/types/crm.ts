// Lightweight CRM — per-contact notes, tags and lead status, shown inside
// WhatsApp Web. Entirely local-first: nothing here is ever sent to a server.

export type LeadStatus = "new" | "contacted" | "negotiating" | "won" | "lost"

export const LEAD_STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: "new", label: "New", color: "#3b82f6" },
  { value: "contacted", label: "Contacted", color: "#f59e0b" },
  { value: "negotiating", label: "Negotiating", color: "#8b5cf6" },
  { value: "won", label: "Won", color: "#22c55e" },
  { value: "lost", label: "Lost", color: "#ef4444" }
]

export interface Contact {
  // Keyed by contact name from the chat header — imperfect but stable enough
  // for SMB use, and matches how ConversationState is keyed today.
  id: string
  name: string
  status: LeadStatus
  tags: string[]
  note: string
  createdAt: number
  updatedAt: number
}

export interface CrmData {
  contacts: Record<string, Contact>  // keyed by Contact.id
}

export const DEFAULT_CRM: CrmData = { contacts: {} }
