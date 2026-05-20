// Feature flags.
//
// AUTO_SEND_ENABLED — when false, the extension never auto-sends a reply: it
// only ever *suggests* (drafts the reply into the message box for the user to
// review and send). Auto-send carries WhatsApp account-ban risk (automated
// sending violates WhatsApp's terms), so it ships disabled.
//
// The entire auto-send code path (engine `auto` matches, `sendAutoReplies`,
// the send-mode UI) is kept intact — flipping this single flag to `true`
// re-enables auto-send everywhere. Typed as `boolean` on purpose so the
// compiler doesn't treat the auto-send branches as dead code.
export const AUTO_SEND_ENABLED: boolean = false

// Base URL of the QuickReplies website / API the extension talks to.
// TODO(production): set this to the deployed site URL, and add the same
// origin to `host_permissions` in package.json's `manifest` block.
export const API_BASE_URL = "http://localhost:3000"

// Free plan: replies per rolling 30-day period. Enforced locally (so it works
// offline) and mirrored on the server for the dashboard. Pro is unlimited.
// Keep in sync with FREE_MONTHLY_QUOTA in the website's lib/db.ts.
export const FREE_MONTHLY_QUOTA = 300
