// Records one reply: meters it against the plan quota, bumps the template's
// own usage counter, and appends an analytics event. One place so every
// insert path (popup, sidebar, slash command, keyboard, auto-reply) behaves
// identically.

import { meterReply } from "~/storage/account"
import { recordEvent } from "~/storage/analytics"
import { incrementUsageCount } from "~/storage"

/** A user inserted a saved template. Returns false if blocked by the quota. */
export async function registerTemplateUse(
  id: string,
  title: string
): Promise<boolean> {
  const { allowed } = await meterReply()
  if (!allowed) return false
  await incrementUsageCount(id).catch(() => {})
  await recordEvent("template", id, title).catch(() => {})
  return true
}

/** An auto-reply rule produced a reply. Returns false if blocked by the quota. */
export async function registerAutoReply(
  ruleId: string,
  ruleName: string
): Promise<boolean> {
  const { allowed } = await meterReply()
  if (!allowed) return false
  await recordEvent("auto-reply", ruleId, ruleName).catch(() => {})
  return true
}
