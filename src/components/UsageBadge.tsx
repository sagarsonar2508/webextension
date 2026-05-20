import { useEffect, useState } from "react"
import { Zap } from "lucide-react"
import { getAccount, quotaStatus, type QuotaStatus } from "~/storage/account"

// Compact plan + quota strip. Shown in the popup so the free cap is always
// visible — and so the upgrade nudge is one click away.

export function UsageBadge({ onManage }: { onManage: () => void }) {
  const [status, setStatus] = useState<QuotaStatus | null>(null)

  useEffect(() => {
    getAccount().then((acc) => setStatus(quotaStatus(acc)))
  }, [])

  if (!status) return null

  if (status.plan === "pro") {
    return (
      <button
        onClick={onManage}
        className="w-full flex items-center justify-between px-3 py-2 bg-whatsapp-light/60 border-b text-left">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-whatsapp-dark">
          <Zap size={13} className="fill-whatsapp-primary text-whatsapp-primary" />
          Pro · unlimited replies
        </span>
        <span className="text-xs text-whatsapp-secondary">Manage</span>
      </button>
    )
  }

  const used = status.used
  const limit = status.limit ?? 0
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0
  const over = used >= limit
  // Warn when the user crosses 80% so the upgrade prompt arrives before the
  // wall, not at it. Three states: normal (green) → warn (amber) → over (red).
  const warn = !over && pct >= 80

  const tone = over
    ? { bar: "bg-red-500", text: "text-red-600", cta: "Upgrade now" }
    : warn
      ? { bar: "bg-amber-500", text: "text-amber-700", cta: "Get Pro" }
      : { bar: "bg-whatsapp-primary", text: "text-whatsapp-secondary", cta: "Get Pro" }

  const label = over
    ? "Free limit reached"
    : warn
      ? `${used} / ${limit} replies — running low`
      : `${used} / ${limit} replies this month`

  return (
    <button
      onClick={onManage}
      className="w-full px-3 py-2 border-b text-left">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${warn || over ? tone.text : "text-gray-600"}`}>
          {label}
        </span>
        <span className={`text-xs font-semibold ${tone.text}`}>{tone.cta}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  )
}
