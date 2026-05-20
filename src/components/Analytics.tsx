import { useEffect, useState } from "react"
import { BarChart3, Clock, TrendingUp } from "lucide-react"
import {
  getAnalytics,
  computeStats,
  type AnalyticsStats
} from "~/storage/analytics"

// Analytics dashboard (popup tab): replies over time, busiest hour, and the
// templates / rules pulling their weight. All derived from the local event log.

function hourLabel(h: number): string {
  const period = h < 12 ? "am" : "pm"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period}`
}

export function Analytics() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)

  useEffect(() => {
    getAnalytics().then((d) => setStats(computeStats(d.events)))
  }, [])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (stats.total === 0) {
    return (
      <div className="text-center py-10 px-6">
        <BarChart3 size={44} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">
          No replies tracked yet. Insert a template or let an auto-reply rule
          fire — your stats will show up here.
        </p>
      </div>
    )
  }

  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count))

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Last 7 days" value={stats.last7} />
        <Stat label="Last 30 days" value={stats.last30} />
        <Stat label="All time" value={stats.total} />
      </div>

      {/* 14-day chart */}
      <div className="p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-2">
          <TrendingUp size={13} />
          Replies — last 14 days
        </div>
        <div className="flex items-end gap-1 h-24">
          {stats.perDay.map((d) => (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${d.label}: ${d.count}`}>
              <div className="w-full flex items-end h-20">
                <div
                  className="w-full bg-whatsapp-primary rounded-t"
                  style={{
                    height: `${(d.count / maxDay) * 100}%`,
                    minHeight: d.count > 0 ? "3px" : "0"
                  }}
                />
              </div>
              <span className="text-[9px] text-gray-400 leading-none">
                {d.label.split(" ")[1]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Busiest hour */}
      <div className="p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
          <Clock size={13} />
          Busiest hour
        </div>
        <p className="text-sm text-gray-600">
          {stats.busiestHour === null ? (
            "Not enough data yet"
          ) : (
            <>
              You reply most around{" "}
              <span className="font-semibold text-gray-900">
                {hourLabel(stats.busiestHour)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Top templates */}
      <Ranked
        title="Top templates"
        items={stats.topTemplates}
        empty="No template replies yet"
      />

      {/* Top rules */}
      <Ranked
        title="Top auto-reply rules"
        items={stats.topRules}
        empty="No auto-reply activity yet"
      />

      {/* Source split */}
      <p className="text-xs text-gray-400 text-center">
        {stats.bySource.template} from templates ·{" "}
        {stats.bySource["auto-reply"]} from auto-reply
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 rounded-lg bg-gray-50 text-center">
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  )
}

function Ranked({
  title,
  items,
  empty
}: {
  title: string
  items: { refId: string; label: string; count: number }[]
  empty: string
}) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="p-3 rounded-lg border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.refId}>
              <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                <span className="truncate pr-2">{i.label || "Untitled"}</span>
                <span className="font-medium text-gray-900">{i.count}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-whatsapp-secondary rounded-full"
                  style={{ width: `${(i.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
