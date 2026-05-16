import { useState, useEffect } from "react"
import { X, Info } from "lucide-react"
import type { AutoReplyRule, KeywordMatch, ContactScope, ReplyMode } from "~/types"
import { AVAILABLE_VARIABLES, validateVariables } from "~/utils/variables"

type TriggerKind = "keyword" | "first-message" | "any-message"
type ScopeKind = ContactScope["kind"]

interface AutoReplyRuleFormProps {
  rule?: AutoReplyRule | null
  onSave: (
    data: Omit<AutoReplyRule, "id" | "createdAt" | "updatedAt" | "stats">
  ) => void
  onCancel: () => void
}

export function AutoReplyRuleForm({
  rule,
  onSave,
  onCancel
}: AutoReplyRuleFormProps) {
  const [name, setName] = useState("")
  const [enabled, setEnabled] = useState(true)

  const [triggerKind, setTriggerKind] = useState<TriggerKind>("keyword")
  const [keywords, setKeywords] = useState("")          // comma-separated
  const [keywordMatch, setKeywordMatch] = useState<KeywordMatch>("any")

  const [content, setContent] = useState("")

  const [scopeKind, setScopeKind] = useState<ScopeKind>("all")
  const [scopeNames, setScopeNames] = useState("")      // comma-separated

  const [mode, setMode] = useState<ReplyMode>("suggest")

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showVariables, setShowVariables] = useState(false)

  useEffect(() => {
    if (!rule) return
    setName(rule.name)
    setEnabled(rule.enabled)
    setTriggerKind(rule.trigger.kind)
    if (rule.trigger.kind === "keyword") {
      setKeywords(rule.trigger.words.join(", "))
      setKeywordMatch(rule.trigger.match)
    }
    if (rule.response.kind === "text") setContent(rule.response.content)
    setScopeKind(rule.scope.kind)
    if (rule.scope.kind === "include" || rule.scope.kind === "exclude") {
      setScopeNames(rule.scope.contactNames.join(", "))
    }
    setMode(rule.mode ?? "suggest")
  }, [rule])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = "Name is required"

    if (triggerKind === "keyword") {
      const words = parseList(keywords)
      if (words.length === 0) e.keywords = "Add at least one keyword"
    }

    if (!content.trim()) {
      e.content = "Reply text is required"
    } else {
      const v = validateVariables(content)
      if (!v.valid) e.content = `Unknown variables: ${v.unsupported.join(", ")}`
    }

    if (scopeKind !== "all" && parseList(scopeNames).length === 0) {
      e.scope = "Add at least one contact name"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const trigger: AutoReplyRule["trigger"] =
      triggerKind === "keyword"
        ? { kind: "keyword", words: parseList(keywords), match: keywordMatch }
        : triggerKind === "first-message"
          ? { kind: "first-message" }
          : { kind: "any-message" }

    const scope: ContactScope =
      scopeKind === "all"
        ? { kind: "all" }
        : { kind: scopeKind, contactNames: parseList(scopeNames) }

    onSave({
      name: name.trim(),
      enabled,
      // any-message rules should sit at the bottom so a more specific
      // keyword rule wins when both could match.
      priority: triggerKind === "any-message" ? 100 : 10,
      trigger,
      response: { kind: "text", content: content.trim() },
      scope,
      mode
    })
  }

  const insertVariable = (key: string) => {
    setContent((prev) => `${prev}{{${key}}}`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? "Edit auto-reply rule" : "New auto-reply rule"}
          </h2>
          <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <Field label="Name" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pricing replies"
              className={inputCls(!!errors.name)}
            />
          </Field>

          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Enabled</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-whatsapp-primary rounded focus:ring-whatsapp-primary"
            />
          </label>

          {/* Trigger */}
          <Section title="When">
            <Field label="Trigger">
              <select
                value={triggerKind}
                onChange={(e) => setTriggerKind(e.target.value as TriggerKind)}
                className={inputCls()}>
                <option value="keyword">Message contains keyword</option>
                <option value="first-message">First message from contact</option>
                <option value="any-message">Any incoming message</option>
              </select>
            </Field>

            {triggerKind === "keyword" && (
              <>
                <Field
                  label="Keywords (comma-separated)"
                  error={errors.keywords}>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="price, cost, how much"
                    className={inputCls(!!errors.keywords)}
                  />
                </Field>
                <Field label="Match">
                  <div className="flex gap-3 text-sm">
                    {(["any", "all", "exact"] as KeywordMatch[]).map((m) => (
                      <label key={m} className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="match"
                          checked={keywordMatch === m}
                          onChange={() => setKeywordMatch(m)}
                        />
                        <span className="capitalize">{m}</span>
                      </label>
                    ))}
                  </div>
                </Field>
              </>
            )}

            <Field label="Apply to" error={errors.scope}>
              <select
                value={scopeKind}
                onChange={(e) => setScopeKind(e.target.value as ScopeKind)}
                className={inputCls()}>
                <option value="all">All contacts</option>
                <option value="include">Only these contacts</option>
                <option value="exclude">Everyone except these contacts</option>
              </select>
              {scopeKind !== "all" && (
                <input
                  type="text"
                  value={scopeNames}
                  onChange={(e) => setScopeNames(e.target.value)}
                  placeholder="John, Acme Pvt Ltd"
                  className={`${inputCls(!!errors.scope)} mt-2`}
                />
              )}
            </Field>
          </Section>

          {/* Response */}
          <Section title="Reply with">
            <Field
              label="Text"
              right={
                <button
                  type="button"
                  onClick={() => setShowVariables((v) => !v)}
                  className="text-xs text-whatsapp-secondary hover:text-whatsapp-dark flex items-center gap-1">
                  <Info size={12} /> Variables
                </button>
              }
              error={errors.content}>
              {showVariables && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex flex-wrap gap-1">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-whatsapp-light"
                        title={v.description}>
                        {`{{${v.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Hi {{name}}, thanks for reaching out. Our pricing starts at ₹499/mo."
                className={`${inputCls(!!errors.content)} resize-none`}
              />
            </Field>
          </Section>

          {/* Send mode */}
          <Section title="Send mode">
            <div className="space-y-2">
              <label className="flex items-start gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "suggest"}
                  onChange={() => setMode("suggest")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Suggest a reply
                  </p>
                  <p className="text-xs text-gray-500">
                    Show a banner with the reply — you click Insert to send.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "auto"}
                  onChange={() => setMode("auto")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Auto-send instantly
                  </p>
                  <p className="text-xs text-gray-500">
                    Sends the reply without asking. Only works while the chat is
                    open in WhatsApp Web.
                  </p>
                </div>
              </label>
            </div>
          </Section>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm text-white bg-whatsapp-primary rounded-lg hover:bg-whatsapp-secondary">
              {rule ? "Save changes" : "Create rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function parseList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

function inputCls(invalid = false): string {
  return `w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-whatsapp-primary focus:border-transparent ${
    invalid ? "border-red-500" : "border-gray-300"
  }`
}

function Field({
  label,
  error,
  right,
  children
}: {
  label: string
  error?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {right}
      </div>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-3 border-t first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  )
}
