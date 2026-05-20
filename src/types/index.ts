export * from "./auto-reply"
export * from "./account"
export * from "./analytics"
export * from "./crm"

// Template Types
export interface Template {
  id: string
  shortcut: string
  title: string
  content: string
  category: TemplateCategory
  isFavorite: boolean
  usageCount: number
  createdAt: number
  updatedAt: number
}

export type TemplateCategory =
  | "sales"
  | "support"
  | "payments"
  | "onboarding"
  | "followup"
  | "general"

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "payments", label: "Payments" },
  { value: "onboarding", label: "Onboarding" },
  { value: "followup", label: "Follow-up" },
  { value: "general", label: "General" }
]

// Storage Types
export interface StorageData {
  templates: Template[]
  settings: UserSettings
  recentTemplates: string[] // template IDs
}

export interface UserSettings {
  enableSlashCommands: boolean
  enableKeyboardShortcuts: boolean
  showSidebar: boolean
  defaultCategory: TemplateCategory
  maxRecentTemplates: number
}

// Variable Types
export interface VariableContext {
  name: string
  time: string
  date: string
  day: string
}

// Message Types for Content Script Communication
export type MessageType =
  | "INSERT_TEMPLATE"
  | "GET_CONTACT_NAME"
  | "TOGGLE_SIDEBAR"
  | "SEARCH_TEMPLATES"

export interface ExtensionMessage {
  type: MessageType
  payload?: unknown
}

export interface InsertTemplatePayload {
  content: string
  templateId: string
}

// Keyboard Shortcut Types
export interface KeyboardShortcut {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  templateId: string
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { key: "1", altKey: true, templateId: "" },
  { key: "2", altKey: true, templateId: "" },
  { key: "3", altKey: true, templateId: "" },
  { key: "4", altKey: true, templateId: "" },
  { key: "5", altKey: true, templateId: "" }
]
