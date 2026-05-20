import type { AnalyticsData, AnalyticsEvent, ReplySource } from "~/types"
import { DEFAULT_ANALYTICS } from "~/types"

// Local analytics log. Append-only, capped — every reply the extension helps
// send is recorded here so the Analytics dashboard can chart it. Never synced.

const ANALYTICS_KEY = "wqr-analytics"
const ANALYTICS_EVENT_CAP = 5000 // oldest events drop past this

export async function getAnalytics(): Promise<AnalyticsData> {
  const result = await chrome.storage.local.get(ANALYTICS_KEY)
  return (result[ANALYTICS_KEY] as AnalyticsData | undefined) ?? DEFAULT_ANALYTICS
}

export async function recordEvent(
  source: ReplySource,
  refId: string,
  refLabel: string
): Promise<void> {
  const data = await getAnalytics()
  data.events.push({ at: Date.now(), source, refId, refLabel })
  if (data.events.length > ANALYTICS_EVENT_CAP) {
    data.events = data.events.slice(-ANALYTICS_EVENT_CAP)
  }
  await chrome.storage.local.set({ [ANALYTICS_KEY]: data })
}

export async function clearAnalytics(): Promise<void> {
  await chrome.storage.local.set({ [ANALYTICS_KEY]: DEFAULT_ANALYTICS })
}

// ── Derived stats ──────────────────────────────────────────────────────────

export interface DayBucket {
  label: string   // e.g. "Mon 19"
  date: string    // YYYY-MM-DD
  count: number
}

export interface RankedItem {
  refId: string
  label: string
  count: number
}

export interface AnalyticsStats {
  total: number
  last7: number
  last30: number
  perDay: DayBucket[]          // last 14 days, oldest → newest
  byHour: number[]             // 24 buckets
  busiestHour: number | null   // 0–23, or null when there's no data
  topTemplates: RankedItem[]
  topRules: RankedItem[]
  bySource: Record<ReplySource, number>
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

// Pure — derives every dashboard number from the raw event log.
export function computeStats(events: AnalyticsEvent[], now = Date.now()): AnalyticsStats {
  const last7 = events.filter((e) => now - e.at < 7 * DAY_MS).length
  const last30 = events.filter((e) => now - e.at < 30 * DAY_MS).length

  // 14-day per-day buckets.
  const perDay: DayBucket[] = []
  const byDateKey = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS)
    const key = dayKey(d)
    byDateKey.set(key, 0)
    perDay.push({
      label: d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
      date: key,
      count: 0
    })
  }
  for (const e of events) {
    const key = dayKey(new Date(e.at))
    if (byDateKey.has(key)) byDateKey.set(key, (byDateKey.get(key) || 0) + 1)
  }
  for (const b of perDay) b.count = byDateKey.get(b.date) || 0

  // Hour-of-day histogram (last 30 days only — recent habits matter most).
  const byHour = new Array(24).fill(0) as number[]
  for (const e of events) {
    if (now - e.at < 30 * DAY_MS) byHour[new Date(e.at).getHours()]++
  }
  const maxHour = Math.max(...byHour)
  const busiestHour = maxHour > 0 ? byHour.indexOf(maxHour) : null

  // Rankings.
  const rank = (source: ReplySource): RankedItem[] => {
    const map = new Map<string, RankedItem>()
    for (const e of events) {
      if (e.source !== source) continue
      const item = map.get(e.refId) ?? { refId: e.refId, label: e.refLabel, count: 0 }
      item.count++
      item.label = e.refLabel // keep the most recent label
      map.set(e.refId, item)
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }

  const bySource: Record<ReplySource, number> = { template: 0, "auto-reply": 0 }
  for (const e of events) bySource[e.source]++

  return {
    total: events.length,
    last7,
    last30,
    perDay,
    byHour,
    busiestHour,
    topTemplates: rank("template"),
    topRules: rank("auto-reply"),
    bySource
  }
}
