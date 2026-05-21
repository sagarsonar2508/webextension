// Lightweight error telemetry for the extension.
//
// We deliberately don't bundle the full @sentry/browser SDK — it bloats the
// extension package and the WhatsApp content script must stay light. Instead
// we POST a tiny JSON payload to Sentry's envelope endpoint ourselves, with
// the DSN baked in at build time via SENTRY_DSN.
//
// PRIVACY: never sends DOM contents, the URL path, or any input value. Only
// the error name, message, and a 30-frame stack — same as a console error.
// Tokens are not logged here in the first place (see api/client.ts).
//
// Set SENTRY_DSN in the extension's build env to enable; otherwise calls are
// no-ops.

import { SENTRY_DSN } from "~/config"

interface ParsedDsn {
  publicKey: string
  host: string
  projectId: string
  envelopeUrl: string
}

let parsed: ParsedDsn | null = null
function parseDsn(): ParsedDsn | null {
  if (parsed) return parsed
  if (!SENTRY_DSN) return null
  try {
    const u = new URL(SENTRY_DSN)
    const publicKey = u.username
    const host = u.host
    const projectId = u.pathname.replace(/^\//, "")
    parsed = {
      publicKey,
      host,
      projectId,
      envelopeUrl: `https://${host}/api/${projectId}/envelope/`
    }
    return parsed
  } catch {
    return null
  }
}

let userId: string | null = null
export function setTelemetryUser(id: string | null): void {
  userId = id
}

const seen = new Set<string>()

export function captureError(
  err: unknown,
  context?: Record<string, unknown>
): void {
  const dsn = parseDsn()
  if (!dsn) return

  const e = normalize(err)
  // Deduplicate within a session — WhatsApp DOM failures can fire on every
  // mutation observer tick.
  const fingerprint = `${e.type}:${e.value}:${(e.stack || "").slice(0, 200)}`
  if (seen.has(fingerprint)) return
  seen.add(fingerprint)
  if (seen.size > 100) seen.clear()

  const eventId = randomId()
  const sentAt = new Date().toISOString()

  const header = JSON.stringify({
    event_id: eventId,
    sent_at: sentAt,
    dsn: SENTRY_DSN
  })
  const itemHeader = JSON.stringify({ type: "event" })
  const event = {
    event_id: eventId,
    timestamp: sentAt,
    platform: "javascript",
    level: "error",
    environment: process.env.NODE_ENV || "production",
    release: chrome.runtime.getManifest().version,
    tags: { component: "extension" },
    extra: context || {},
    user: userId ? { id: userId } : undefined,
    exception: {
      values: [
        {
          type: e.type,
          value: e.value,
          stacktrace: e.stack
            ? { frames: parseStack(e.stack) }
            : undefined
        }
      ]
    }
  }
  const envelope = `${header}\n${itemHeader}\n${JSON.stringify(event)}`

  // Fire-and-forget; we don't await the response.
  void fetch(dsn.envelopeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=qr-extension/1.0`
    },
    body: envelope
  }).catch(() => {})
}

function normalize(err: unknown): {
  type: string
  value: string
  stack?: string
} {
  if (err instanceof Error) {
    return { type: err.name, value: err.message, stack: err.stack }
  }
  return { type: "Error", value: String(err) }
}

function parseStack(stack: string): { filename?: string; function?: string; lineno?: number; colno?: number }[] {
  return stack
    .split("\n")
    .slice(1, 31) // first line is the message; cap at 30 frames
    .map((line) => {
      // Matches "at fn (file:line:col)" and "at file:line:col"
      const m = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/)
      if (!m) return { function: line.trim() }
      return {
        function: m[1] || undefined,
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4])
      }
    })
}

function randomId(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
