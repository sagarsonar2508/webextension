import { Star, Clock, Grid } from "lucide-react"
import type { TemplateCategory } from "~/types"
import { TEMPLATE_CATEGORIES } from "~/types"

type CategoryFilter = TemplateCategory | "all" | "favorites" | "recent"

interface CategoryTabsProps {
  selected: CategoryFilter
  onSelect: (category: CategoryFilter) => void
}

export function CategoryTabs({ selected, onSelect }: CategoryTabsProps) {
  const specialTabs: { value: CategoryFilter; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: "All", icon: <Grid size={14} /> },
    { value: "favorites", label: "Favorites", icon: <Star size={14} /> },
    { value: "recent", label: "Recent", icon: <Clock size={14} /> }
  ]

  return (
    <div className="space-y-2">
      {/* Special tabs */}
      <div className="flex gap-1">
        {specialTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onSelect(tab.value)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-colors ${
              selected === tab.value
                ? "bg-whatsapp-primary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              selected === cat.value
                ? "bg-whatsapp-secondary text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  )
}
