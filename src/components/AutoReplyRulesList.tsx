import { useEffect, useState, useCallback } from "react"
import { Plus, Edit2, Trash2, Sparkles, Power } from "lucide-react"
import type { AutoReplyRule, AutoReplySettings, Trigger } from "~/types"
import {
  getRules,
  addRule,
  updateRule,
  deleteRule,
  getAutoReplySettings,
  updateAutoReplySettings
} from "~/storage/auto-reply"
import { AutoReplyRuleForm } from "./AutoReplyRuleForm"

export function AutoReplyRulesList() {
  const [rules, setRules] = useState<AutoReplyRule[]>([])
  const [settings, setSettings] = useState<AutoReplySettings | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AutoReplyRule | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const [r, s] = await Promise.all([getRules(), getAutoReplySettings()])
    setRules(r)
    setSettings(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const handleSave = async (
    data: Omit<AutoReplyRule, "id" | "createdAt" | "updatedAt" | "stats">
  ) => {
    if (editing) {
      await updateRule(editing.id, data)
    } else {
      await addRule(data)
      // First rule created? Auto-enable the master switch so the user
      // doesn't have to hunt for why nothing's firing.
      if (rules.length === 0 && settings && !settings.masterEnabled) {
        const next = await updateAutoReplySettings({ masterEnabled: true })
        setSettings(next)
      }
    }
    setShowForm(false)
    setEditing(null)
    await reload()
  }

  const handleToggle = async (rule: AutoReplyRule) => {
    await updateRule(rule.id, { enabled: !rule.enabled })
    await reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return
    await deleteRule(id)
    await reload()
  }

  const handleMasterToggle = async () => {
    if (!settings) return
    const next = await updateAutoReplySettings({
      masterEnabled: !settings.masterEnabled
    })
    setSettings(next)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const enabledCount = rules.filter((r) => r.enabled).length

  return (
    <div className="flex flex-col h-full">
      {/* Master switch banner */}
      <div
        className={`px-4 py-3 border-b flex items-center gap-3 ${
          settings.masterEnabled ? "bg-whatsapp-light/40" : "bg-gray-50"
        }`}>
        <Power
          size={18}
          className={
            settings.masterEnabled
              ? "text-whatsapp-primary"
              : "text-gray-400"
          }
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Auto-reply suggestions
          </p>
          <p className="text-xs text-gray-500">
            {settings.masterEnabled
              ? `${enabledCount} active rule${enabledCount === 1 ? "" : "s"}`
              : "Off — no replies will be suggested"}
          </p>
        </div>
        <button
          onClick={handleMasterToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            settings.masterEnabled ? "bg-whatsapp-primary" : "bg-gray-300"
          }`}>
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.masterEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* New rule */}
      <div className="px-3 py-2 border-b bg-white">
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-whatsapp-primary rounded-lg hover:bg-whatsapp-secondary">
          <Plus size={16} /> New rule
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto p-3">
        {rules.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No rules yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a rule to suggest replies when matching messages arrive.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={() => handleToggle(rule)}
                onEdit={() => {
                  setEditing(rule)
                  setShowForm(true)
                }}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AutoReplyRuleForm
          rule={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete
}: {
  rule: AutoReplyRule
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow ${
        rule.enabled ? "border-gray-200" : "border-gray-200 opacity-60"
      }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 truncate">
            {rule.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {triggerSummary(rule.trigger)}
          </p>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            rule.enabled ? "bg-whatsapp-primary" : "bg-gray-300"
          }`}
          title={rule.enabled ? "Disable" : "Enable"}>
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              rule.enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {rule.response.kind === "text" && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
          {rule.response.content}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          Triggered {rule.stats.triggered} time
          {rule.stats.triggered === 1 ? "" : "s"}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="Edit">
            <Edit2 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
            title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function triggerSummary(trigger: Trigger): string {
  switch (trigger.kind) {
    case "keyword": {
      const preview = trigger.words.slice(0, 3).join(", ")
      const more = trigger.words.length > 3 ? ` +${trigger.words.length - 3}` : ""
      return `keyword (${trigger.match}): ${preview}${more}`
    }
    case "first-message":
      return "first message from contact"
    case "any-message":
      return "any incoming message"
  }
}
