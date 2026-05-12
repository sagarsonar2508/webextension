import { useState, useEffect, useCallback } from "react"
import type { Template, TemplateCategory } from "~/types"
import {
  getTemplates,
  searchTemplates,
  getTemplatesByCategory,
  getFavoriteTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  toggleFavorite,
  incrementUsageCount
} from "~/storage"

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (err) {
      setError("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      return loadTemplates()
    }
    setLoading(true)
    try {
      const results = await searchTemplates(query)
      setTemplates(results)
    } finally {
      setLoading(false)
    }
  }, [loadTemplates])

  const filterByCategory = useCallback(async (category: TemplateCategory) => {
    setLoading(true)
    try {
      const results = await getTemplatesByCategory(category)
      setTemplates(results)
    } finally {
      setLoading(false)
    }
  }, [])

  const getFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const results = await getFavoriteTemplates()
      setTemplates(results)
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(
    async (template: Omit<Template, "id" | "createdAt" | "updatedAt" | "usageCount">) => {
      const newTemplate = await addTemplate(template)
      setTemplates((prev) => [...prev, newTemplate])
      return newTemplate
    },
    []
  )

  const update = useCallback(
    async (id: string, updates: Partial<Omit<Template, "id" | "createdAt">>) => {
      const updated = await updateTemplate(id, updates)
      if (updated) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        )
      }
      return updated
    },
    []
  )

  const remove = useCallback(async (id: string) => {
    const success = await deleteTemplate(id)
    if (success) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
    return success
  }, [])

  const toggleFav = useCallback(async (id: string) => {
    const isFavorite = await toggleFavorite(id)
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFavorite } : t))
    )
    return isFavorite
  }, [])

  const recordUsage = useCallback(async (id: string) => {
    await incrementUsageCount(id)
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
      )
    )
  }, [])

  return {
    templates,
    loading,
    error,
    loadTemplates,
    search,
    filterByCategory,
    getFavorites,
    add,
    update,
    remove,
    toggleFav,
    recordUsage
  }
}
