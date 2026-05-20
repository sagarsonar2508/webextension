// Thin client for the QuickReplies website API.
//
// Only two things ever cross this boundary: an auth token and reply *counts*.
// No WhatsApp message text, contact names or chat data — rule matching is
// 100% local. See the privacy note in the website's lib/db.ts.

import { API_BASE_URL } from "~/config"
import type { UsageSnapshot } from "~/types"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** True when the API rejected the token (caller should disconnect). */
export function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401
}

/** True when the free quota is exhausted server-side. */
export function isQuotaError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 402
}

async function call(
  path: string,
  token: string,
  init?: RequestInit
): Promise<UsageSnapshot> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {})
      }
    })
  } catch {
    throw new ApiError("network error — could not reach QuickReplies", 0)
  }

  // 402 still carries a usable snapshot (the over-quota state) — surface it.
  if (res.status === 402) {
    const body = (await res.json().catch(() => ({}))) as UsageSnapshot
    throw Object.assign(new ApiError("quota exceeded", 402), { snapshot: body })
  }
  if (!res.ok) {
    throw new ApiError(`request failed (${res.status})`, res.status)
  }
  return (await res.json()) as UsageSnapshot
}

/** Validate a token and fetch the current quota snapshot. */
export function fetchUsage(token: string): Promise<UsageSnapshot> {
  return call("/api/usage", token, { method: "GET" })
}

/** Report `count` metered replies to the server. */
export function reportUsage(
  token: string,
  count: number
): Promise<UsageSnapshot> {
  return call("/api/usage", token, {
    method: "POST",
    body: JSON.stringify({ count })
  })
}
