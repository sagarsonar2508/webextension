import type { Contact, CrmData, LeadStatus } from "~/types"
import { DEFAULT_CRM } from "~/types"

// Lightweight CRM storage — per-contact notes, tags and lead status.
// Local-first: nothing here is ever sent to a server. Contacts are keyed by
// name (the same key ConversationState uses); imperfect but stable for SMB use.

const CRM_KEY = "wqr-crm"

export async function getCrm(): Promise<CrmData> {
  const result = await chrome.storage.local.get(CRM_KEY)
  return (result[CRM_KEY] as CrmData | undefined) ?? DEFAULT_CRM
}

async function setCrm(data: CrmData): Promise<void> {
  await chrome.storage.local.set({ [CRM_KEY]: data })
}

export async function getContact(name: string): Promise<Contact | null> {
  const data = await getCrm()
  return data.contacts[name] ?? null
}

/** All contacts, most recently updated first. */
export async function listContacts(): Promise<Contact[]> {
  const data = await getCrm()
  return Object.values(data.contacts).sort((a, b) => b.updatedAt - a.updatedAt)
}

type ContactPatch = Partial<Pick<Contact, "status" | "tags" | "note">>

/** Create the contact if missing, then apply `patch`. Returns the saved row. */
export async function upsertContact(
  name: string,
  patch: ContactPatch
): Promise<Contact> {
  const data = await getCrm()
  const now = Date.now()
  const existing = data.contacts[name]

  const contact: Contact = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
        id: name,
        name,
        status: patch.status ?? "new",
        tags: patch.tags ?? [],
        note: patch.note ?? "",
        createdAt: now,
        updatedAt: now
      }

  data.contacts[name] = contact
  await setCrm(data)
  return contact
}

export async function deleteContact(name: string): Promise<void> {
  const data = await getCrm()
  delete data.contacts[name]
  await setCrm(data)
}

/** Convenience: counts by lead status, for the CRM list header. */
export async function statusCounts(): Promise<Record<LeadStatus, number>> {
  const contacts = await listContacts()
  const counts: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    negotiating: 0,
    won: 0,
    lost: 0
  }
  for (const c of contacts) counts[c.status]++
  return counts
}
