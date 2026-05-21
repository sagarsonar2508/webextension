// Feature flags & build-time config.
//
// AUTO_SEND_ENABLED — when false, the extension never auto-sends a reply: it
// only ever *suggests* (drafts the reply into the message box for the user to
// review and send). Auto-send carries WhatsApp account-ban risk (automated
// sending violates WhatsApp's terms), so it ships disabled.
//
// The entire auto-send code path (engine `auto` matches, `sendAutoReplies`,
// the send-mode UI) is kept intact — flipping this single flag to `true`
// re-enables auto-send everywhere.
export const AUTO_SEND_ENABLED: boolean = false

// Base URL of the QuickReplies website / API the extension talks to.
// Read from build env so the same source ships against dev / staging / prod.
//
// Set in .env at the extension root, e.g.:
//   PLASMO_PUBLIC_API_BASE_URL="https://app.quickreplies.io"
// Plasmo inlines PLASMO_PUBLIC_* at build time.
export const API_BASE_URL: string =
  process.env.PLASMO_PUBLIC_API_BASE_URL || "http://localhost:3000"

// Sentry DSN for the extension. Set PLASMO_PUBLIC_SENTRY_DSN to enable.
// Without it, error capture is a no-op (see utils/telemetry.ts).
export const SENTRY_DSN: string = process.env.PLASMO_PUBLIC_SENTRY_DSN || ""

// Free plan: replies per rolling 30-day period. Enforced locally (so it works
// offline) and mirrored on the server for the dashboard. Pro / Business are
// unlimited. Keep in sync with FREE_MONTHLY_QUOTA in the website's lib/db.ts.
export const FREE_MONTHLY_QUOTA = 300
