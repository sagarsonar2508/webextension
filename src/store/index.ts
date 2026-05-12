import { create } from "zustand"
import type { Template, TemplateCategory, UserSettings } from "~/types"
import {
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  toggleFavorite,
  getSettings,
  updateSettings,
  searchTemplates,
  getTemplatesByCategory,
  getFavoriteTemplates,
  getRecentTemplates
} from "~/storage"

interface TemplateStore {
  // State
  templates: Template[]
  filteredTemplates: Template[]
  settings: UserSettings | null
  isLoading: boolean
  error: string | null
  searchQuery: string
  selectedCategory: TemplateCategory | "all" | "favorites" | "recent"
  editingTemplate: Template | null

  // Actions
  loadTemplates: () => Promise<void>
  loadSettings: () => Promise<void>
  setSearchQuery: (query: string) => void
  setSelectedCategory: (
    category: TemplateCategory | "all" | "favorites" | "recent"
  ) => void
  addNewTemplate: (
    template: Omit<Template, "id" | "createdAt" | "updatedAt" | "usageCount">
  ) => Promise<Template>
  editTemplate: (
    id: string,
    updates: Partial<Omit<Template, "id" | "createdAt">>
  ) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  toggleTemplateFavorite: (id: string) => Promise<void>
  updateUserSettings: (updates: Partial<UserSettings>) => Promise<void>
  setEditingTemplate: (template: Template | null) => void
  refreshTemplates: () => Promise<void>
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  // Initial State
  templates: [],
  filteredTemplates: [],
  settings: null,
  isLoading: false,
  error: null,
  searchQuery: "",
  selectedCategory: "all",
  editingTemplate: null,

  // Actions
  loadTemplates: async () => {
    set({ isLoading: true, error: null })
    try {
      const templates = await getTemplates()
      set({ templates, filteredTemplates: templates, isLoading: false })
    } catch (error) {
      set({ error: "Failed to load templates", isLoading: false })
    }
  },

  loadSettings: async () => {
    try {
      const settings = await getSettings()
      set({ settings })
    } catch (error) {
      set({ error: "Failed to load settings" })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    get().refreshTemplates()
  },

  setSelectedCategory: (
    category: TemplateCategory | "all" | "favorites" | "recent"
  ) => {
    set({ selectedCategory: category, searchQuery: "" })
    get().refreshTemplates()
  },

  addNewTemplate: async (template) => {
    set({ isLoading: true })
    try {
      const newTemplate = await addTemplate(template)
      await get().refreshTemplates()
      set({ isLoading: false })
      return newTemplate
    } catch (error) {
      set({ error: "Failed to add template", isLoading: false })
      throw error
    }
  },

  editTemplate: async (id, updates) => {
    set({ isLoading: true })
    try {
      await updateTemplate(id, updates)
      await get().refreshTemplates()
      set({ isLoading: false, editingTemplate: null })
    } catch (error) {
      set({ error: "Failed to update template", isLoading: false })
    }
  },

  removeTemplate: async (id) => {
    set({ isLoading: true })
    try {
      await deleteTemplate(id)
      await get().refreshTemplates()
      set({ isLoading: false })
    } catch (error) {
      set({ error: "Failed to delete template", isLoading: false })
    }
  },

  toggleTemplateFavorite: async (id) => {
    try {
      await toggleFavorite(id)
      await get().refreshTemplates()
    } catch (error) {
      set({ error: "Failed to toggle favorite" })
    }
  },

  updateUserSettings: async (updates) => {
    try {
      const settings = await updateSettings(updates)
      set({ settings })
    } catch (error) {
      set({ error: "Failed to update settings" })
    }
  },

  setEditingTemplate: (template) => {
    set({ editingTemplate: template })
  },

  refreshTemplates: async () => {
    const { searchQuery, selectedCategory } = get()

    let templates: Template[]

    if (searchQuery) {
      templates = await searchTemplates(searchQuery)
    } else if (selectedCategory === "all") {
      templates = await getTemplates()
    } else if (selectedCategory === "favorites") {
      templates = await getFavoriteTemplates()
    } else if (selectedCategory === "recent") {
      templates = await getRecentTemplates()
    } else {
      templates = await getTemplatesByCategory(selectedCategory)
    }

    set({ templates, filteredTemplates: templates })
  }
}))
