import { useEffect, useState } from "react"
import { Plus, Settings as SettingsIcon, MessageSquare, Sparkles } from "lucide-react"
import { useTemplateStore } from "~/store"
import {
  TemplateCard,
  TemplateForm,
  SearchBar,
  CategoryTabs,
  Settings,
  AutoReplyRulesList
} from "~/components"
import type { Template } from "~/types"
import { incrementUsageCount } from "~/storage"

import "~/styles/globals.css"

type Tab = "templates" | "auto-reply"

function Popup() {
  const {
    templates,
    filteredTemplates,
    settings,
    isLoading,
    searchQuery,
    selectedCategory,
    editingTemplate,
    loadTemplates,
    loadSettings,
    setSearchQuery,
    setSelectedCategory,
    addNewTemplate,
    editTemplate,
    removeTemplate,
    toggleTemplateFavorite,
    updateUserSettings,
    setEditingTemplate
  } = useTemplateStore()

  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [tab, setTab] = useState<Tab>("templates")

  useEffect(() => {
    loadTemplates()
    loadSettings()
  }, [loadTemplates, loadSettings])

  const handleInsertTemplate = async (template: Template) => {
    // Send message to content script to insert template
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "INSERT_TEMPLATE",
        payload: {
          content: template.content,
          templateId: template.id
        }
      })
      await incrementUsageCount(template.id)
      window.close()
    }
  }

  const handleSaveTemplate = async (
    data: Omit<Template, "id" | "createdAt" | "updatedAt" | "usageCount">
  ) => {
    if (editingTemplate) {
      await editTemplate(editingTemplate.id, data)
    } else {
      await addNewTemplate(data)
    }
    setShowForm(false)
    setEditingTemplate(null)
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setShowForm(true)
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      await removeTemplate(id)
    }
  }

  const handleCancelForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
  }

  return (
    <div className="w-[400px] min-h-[500px] max-h-[600px] flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-whatsapp-dark text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={24} />
            <h1 className="text-lg font-semibold">Quick Replies</h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            {tab === "templates" && (
              <button
                onClick={() => setShowForm(true)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Add template"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>

        {tab === "templates" && (
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        )}
      </header>

      {/* Top-level tabs */}
      <div className="flex border-b bg-white">
        <TabButton
          active={tab === "templates"}
          onClick={() => setTab("templates")}
          icon={<MessageSquare size={14} />}
          label="Templates"
        />
        <TabButton
          active={tab === "auto-reply"}
          onClick={() => setTab("auto-reply")}
          icon={<Sparkles size={14} />}
          label="Auto-reply"
        />
      </div>

      {tab === "templates" ? (
        <>
          {/* Category Tabs */}
          <div className="p-3 bg-white border-b">
            <CategoryTabs
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-y-auto p-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin w-6 h-6 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">
                  {searchQuery
                    ? "No templates found"
                    : "No templates yet. Create your first one!"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-3 text-sm text-whatsapp-primary hover:text-whatsapp-secondary"
                  >
                    + Add Template
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={handleEditTemplate}
                    onDelete={handleDeleteTemplate}
                    onToggleFavorite={toggleTemplateFavorite}
                    onInsert={handleInsertTemplate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="p-2 bg-white border-t text-center">
            <p className="text-xs text-gray-400">
              {templates.length} template{templates.length !== 1 ? "s" : ""} | Type{" "}
              <code className="bg-gray-100 px-1 rounded">/shortcut</code> in chat
            </p>
          </footer>
        </>
      ) : (
        <AutoReplyRulesList />
      )}

      {/* Modals */}
      {showForm && (
        <TemplateForm
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleCancelForm}
        />
      )}

      {showSettings && settings && (
        <Settings
          settings={settings}
          onUpdate={updateUserSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-whatsapp-primary text-whatsapp-primary"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}>
      {icon}
      {label}
    </button>
  )
}

export default Popup
