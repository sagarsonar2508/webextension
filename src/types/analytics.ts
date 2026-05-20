// Analytics events — a local, append-only log of every reply the extension
// helped send. Powers the Analytics dashboard (replies over time, busiest
// hours, top templates, per-rule performance). Never leaves the device.

export type ReplySource =
  | "template"      // a saved template inserted by the user
  | "auto-reply"    // an auto-reply rule suggestion

export interface AnalyticsEvent {
  at: number          // epoch ms
  source: ReplySource
  refId: string       // template id or rule id
  refLabel: string    // human label captured at event time (title / rule name)
}

// The log is capped — see ANALYTICS_EVENT_CAP in storage/analytics.ts.
export interface AnalyticsData {
  events: AnalyticsEvent[]
}

export const DEFAULT_ANALYTICS: AnalyticsData = { events: [] }
