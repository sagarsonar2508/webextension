import type {
  Template,
  StorageData,
  UserSettings,
  TemplateCategory
} from "~/types"

const STORAGE_KEY = "whatsapp-quick-replies"

// Default Settings
export const DEFAULT_SETTINGS: UserSettings = {
  enableSlashCommands: true,
  enableKeyboardShortcuts: true,
  showSidebar: true,
  defaultCategory: "general",
  maxRecentTemplates: 10
}

// Default Templates
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "default-1",
    shortcut: "/pricing",
    title: "Pricing Information",
    content:
      "Hi {{name}}, thanks for your interest! Our pricing starts from ₹499/month. Would you like me to share more details?",
    category: "sales",
    isFavorite: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "default-2",
    shortcut: "/followup",
    title: "Follow Up",
    content:
      "Hi {{name}}, I wanted to follow up on our previous conversation. Do you have any questions I can help with?",
    category: "followup",
    isFavorite: true,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "default-3",
    shortcut: "/thanks",
    title: "Thank You",
    content:
      "Thank you so much, {{name}}! I really appreciate your time. Feel free to reach out if you need anything else.",
    category: "general",
    isFavorite: false,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "default-4",
    shortcut: "/payment",
    title: "Payment Reminder",
    content:
      "Hi {{name}}, this is a friendly reminder about your pending payment. Please let me know if you need any assistance with the payment process.",
    category: "payments",
    isFavorite: false,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "default-5",
    shortcut: "/welcome",
    title: "Welcome Message",
    content:
      "Welcome aboard, {{name}}! We're excited to have you. Here's what you need to get started...",
    category: "onboarding",
    isFavorite: false,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
]

// Get all data from storage
export async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const data = result[STORAGE_KEY] as StorageData | undefined

  if (!data) {
    const defaultData: StorageData = {
      templates: DEFAULT_TEMPLATES,
      settings: DEFAULT_SETTINGS,
      recentTemplates: []
    }
    await setStorageData(defaultData)
    return defaultData
  }

  return data
}

// Set all data to storage
export async function setStorageData(data: StorageData): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: data })
}

// Template CRUD Operations
export async function getTemplates(): Promise<Template[]> {
  const data = await getStorageData()
  return data.templates
}

export async function getTemplateById(id: string): Promise<Template | undefined> {
  const templates = await getTemplates()
  return templates.find((t) => t.id === id)
}

export async function getTemplateByShortcut(
  shortcut: string
): Promise<Template | undefined> {
  const templates = await getTemplates()
  return templates.find(
    (t) => t.shortcut.toLowerCase() === shortcut.toLowerCase()
  )
}

export async function addTemplate(
  template: Omit<Template, "id" | "createdAt" | "updatedAt" | "usageCount">
): Promise<Template> {
  const data = await getStorageData()
  const newTemplate: Template = {
    ...template,
    id: generateId(),
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  data.templates.push(newTemplate)
  await setStorageData(data)
  return newTemplate
}

export async function updateTemplate(
  id: string,
  updates: Partial<Omit<Template, "id" | "createdAt">>
): Promise<Template | undefined> {
  const data = await getStorageData()
  const index = data.templates.findIndex((t) => t.id === id)

  if (index === -1) return undefined

  data.templates[index] = {
    ...data.templates[index],
    ...updates,
    updatedAt: Date.now()
  }
  await setStorageData(data)
  return data.templates[index]
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const data = await getStorageData()
  const index = data.templates.findIndex((t) => t.id === id)

  if (index === -1) return false

  data.templates.splice(index, 1)
  data.recentTemplates = data.recentTemplates.filter((tid) => tid !== id)
  await setStorageData(data)
  return true
}

export async function incrementUsageCount(id: string): Promise<void> {
  const data = await getStorageData()
  const template = data.templates.find((t) => t.id === id)

  if (template) {
    template.usageCount++
    template.updatedAt = Date.now()

    // Update recent templates
    data.recentTemplates = data.recentTemplates.filter((tid) => tid !== id)
    data.recentTemplates.unshift(id)
    data.recentTemplates = data.recentTemplates.slice(
      0,
      data.settings.maxRecentTemplates
    )

    await setStorageData(data)
  }
}

// Search templates
export async function searchTemplates(query: string): Promise<Template[]> {
  const templates = await getTemplates()
  const lowerQuery = query.toLowerCase()

  return templates.filter(
    (t) =>
      t.title.toLowerCase().includes(lowerQuery) ||
      t.shortcut.toLowerCase().includes(lowerQuery) ||
      t.content.toLowerCase().includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery)
  )
}

// Get templates by category
export async function getTemplatesByCategory(
  category: TemplateCategory
): Promise<Template[]> {
  const templates = await getTemplates()
  return templates.filter((t) => t.category === category)
}

// Get favorite templates
export async function getFavoriteTemplates(): Promise<Template[]> {
  const templates = await getTemplates()
  return templates.filter((t) => t.isFavorite)
}

// Get recent templates
export async function getRecentTemplates(): Promise<Template[]> {
  const data = await getStorageData()
  const recentIds = data.recentTemplates
  return data.templates
    .filter((t) => recentIds.includes(t.id))
    .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id))
}

// Settings Operations
export async function getSettings(): Promise<UserSettings> {
  const data = await getStorageData()
  return data.settings
}

export async function updateSettings(
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const data = await getStorageData()
  data.settings = { ...data.settings, ...updates }
  await setStorageData(data)
  return data.settings
}

// Toggle favorite
export async function toggleFavorite(id: string): Promise<boolean> {
  const data = await getStorageData()
  const template = data.templates.find((t) => t.id === id)

  if (!template) return false

  template.isFavorite = !template.isFavorite
  template.updatedAt = Date.now()
  await setStorageData(data)
  return template.isFavorite
}

// Utility functions
function generateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Export data for backup
export async function exportData(): Promise<string> {
  const data = await getStorageData()
  return JSON.stringify(data, null, 2)
}

// Import data from backup
export async function importData(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString) as StorageData
    if (!data.templates || !data.settings) {
      throw new Error("Invalid data format")
    }
    await setStorageData(data)
    return true
  } catch {
    return false
  }
}
