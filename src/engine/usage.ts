// Records one reply: meters it against the plan quota, bumps the template's
// own usage counter, and appends an analytics event. One place so every
// insert path (popup, sidebar, slash command, keyboard, auto-reply) behaves
// identically.

import { meterReply } from "~/storage/account"
import { recordEvent } from "~/storage/analytics"
import { getTemplateById, incrementUsageCount } from "~/storage"

/** A user inserted a saved template. Returns false if blocked by the quota. */
export async function registerTemplateUse(
  id: string,
  title: string
): Promise<boolean> {
  // Look up the character count so the server can calculate time saved.
  // We pass the user-chosen TITLE, never the message body.
  let chars = 0
  try {
    const tpl = await getTemplateById(id)
    chars = tpl?.content.length ?? 0
  } catch {
    /* ignore — analytics is best-effort */
  }

  const { allowed } = await meterReply({
    source: "template",
    templateKey: id,
    templateTitle: title,
    characterCount: chars
  })
  if (!allowed) return false
  await incrementUsageCount(id).catch(() => {})
  await recordEvent("template", id, title).catch(() => {})
  return true
}

/** An auto-reply rule produced a reply. Returns false if blocked by the quota. */
export async function registerAutoReply(
  ruleId: string,
  ruleName: string,
  characterCount = 0
): Promise<boolean> {
  const { allowed } = await meterReply({
    source: "auto_reply",
    templateKey: ruleId,
    templateTitle: ruleName,
    characterCount
  })
  if (!allowed) return false
  await recordEvent("auto-reply", ruleId, ruleName).catch(() => {})
  return true
}

/** An AI-suggested reply was accepted by the user. */
export async function registerAiReply(
  sessionId: string,
  characterCount: number
): Promise<boolean> {
  const { allowed } = await meterReply({
    source: "ai",
    templateKey: sessionId,
    templateTitle: "AI suggestion",
    characterCount
  })
  return allowed
}
