import { Star, Edit2, Trash2, Copy } from "lucide-react"
import type { Template } from "~/types"

interface TemplateCardProps {
  template: Template
  onEdit: (template: Template) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onInsert: (template: Template) => void
}

export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onToggleFavorite,
  onInsert
}: TemplateCardProps) {
  const categoryColors: Record<string, string> = {
    sales: "bg-blue-100 text-blue-800",
    support: "bg-purple-100 text-purple-800",
    payments: "bg-green-100 text-green-800",
    onboarding: "bg-orange-100 text-orange-800",
    followup: "bg-yellow-100 text-yellow-800",
    general: "bg-gray-100 text-gray-800"
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 text-sm">
              {template.title}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[template.category]}`}
            >
              {template.category}
            </span>
          </div>
          <code className="text-xs text-whatsapp-secondary bg-gray-50 px-1.5 py-0.5 rounded">
            {template.shortcut}
          </code>
        </div>
        <button
          onClick={() => onToggleFavorite(template.id)}
          className="p-1 hover:bg-gray-100 rounded"
          title={template.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            size={16}
            className={
              template.isFavorite
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-400"
            }
          />
        </button>
      </div>

      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
        {template.content}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Used {template.usageCount} times
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onInsert(template)}
            className="p-1.5 bg-whatsapp-primary text-white rounded hover:bg-whatsapp-secondary transition-colors"
            title="Insert template"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Edit template"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Delete template"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
