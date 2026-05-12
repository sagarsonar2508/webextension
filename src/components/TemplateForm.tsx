import { useState, useEffect } from "react"
import { X, Info } from "lucide-react"
import type { Template, TemplateCategory } from "~/types"
import { TEMPLATE_CATEGORIES } from "~/types"
import { AVAILABLE_VARIABLES, validateVariables } from "~/utils/variables"

interface TemplateFormProps {
  template?: Template | null
  onSave: (
    data: Omit<Template, "id" | "createdAt" | "updatedAt" | "usageCount">
  ) => void
  onCancel: () => void
}

export function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [title, setTitle] = useState("")
  const [shortcut, setShortcut] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<TemplateCategory>("general")
  const [isFavorite, setIsFavorite] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showVariables, setShowVariables] = useState(false)

  useEffect(() => {
    if (template) {
      setTitle(template.title)
      setShortcut(template.shortcut)
      setContent(template.content)
      setCategory(template.category)
      setIsFavorite(template.isFavorite)
    }
  }, [template])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!title.trim()) {
      newErrors.title = "Title is required"
    }

    if (!shortcut.trim()) {
      newErrors.shortcut = "Shortcut is required"
    } else if (!shortcut.startsWith("/")) {
      newErrors.shortcut = "Shortcut must start with /"
    } else if (shortcut.includes(" ")) {
      newErrors.shortcut = "Shortcut cannot contain spaces"
    }

    if (!content.trim()) {
      newErrors.content = "Content is required"
    } else {
      const validation = validateVariables(content)
      if (!validation.valid) {
        newErrors.content = `Unknown variables: ${validation.unsupported.join(", ")}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    onSave({
      title: title.trim(),
      shortcut: shortcut.trim().toLowerCase(),
      content: content.trim(),
      category,
      isFavorite
    })
  }

  const insertVariable = (varKey: string) => {
    setContent((prev) => `${prev}{{${varKey}}}`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {template ? "Edit Template" : "New Template"}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Pricing Information"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent ${
                errors.title ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shortcut
            </label>
            <input
              type="text"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="e.g., /pricing"
              className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent ${
                errors.shortcut ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.shortcut && (
              <p className="text-red-500 text-xs mt-1">{errors.shortcut}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent"
            >
              {TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="text-xs text-whatsapp-secondary hover:text-whatsapp-dark flex items-center gap-1"
              >
                <Info size={12} />
                Variables
              </button>
            </div>

            {showVariables && (
              <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">
                  Click to insert variable:
                </p>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-whatsapp-light transition-colors"
                      title={v.description}
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Hi {{name}}, thanks for contacting us..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent resize-none ${
                errors.content ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.content && (
              <p className="text-red-500 text-xs mt-1">{errors.content}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="favorite"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="w-4 h-4 text-whatsapp-primary rounded focus:ring-whatsapp-primary"
            />
            <label htmlFor="favorite" className="text-sm text-gray-700">
              Add to favorites
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm text-white bg-whatsapp-primary rounded-lg hover:bg-whatsapp-secondary transition-colors"
            >
              {template ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
