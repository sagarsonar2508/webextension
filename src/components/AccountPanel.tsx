import { useEffect, useState, useCallback } from "react"
import { X, ExternalLink, RefreshCw, Zap } from "lucide-react"
import { API_BASE_URL } from "~/config"
import {
  getAccount,
  quotaStatus,
  connectAccount,
  disconnectAccount,
  syncAccount,
  type QuotaStatus
} from "~/storage/account"

// Account modal: connect the extension to a QuickReplies account (paste the
// API token from the dashboard), see plan/usage, sync, upgrade or disconnect.

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<QuotaStatus | null>(null)
  const [token, setToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setStatus(quotaStatus(await getAccount()))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openSite = (path: string) =>
    chrome.tabs.create({ url: `${API_BASE_URL}${path}` })

  const connect = async () => {
    setBusy(true)
    setError("")
    try {
      setStatus(await connectAccount(token))
      setToken("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect")
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    setError("")
    try {
      setStatus(await syncAccount())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed")
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    await disconnectAccount()
    await load()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {status?.connected ? (
            <>
              {/* Connected */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {status.email || "Connected"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {status.plan === "pro" ? "Pro plan" : "Free plan"}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    status.plan === "pro"
                      ? "bg-whatsapp-light text-whatsapp-dark"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                  {status.plan === "pro" ? "PRO" : "FREE"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 text-sm text-gray-600">
                {status.limit === null
                  ? `${status.used} replies this month — unlimited`
                  : `${status.used} / ${status.limit} replies used this month`}
              </div>

              {status.plan !== "pro" && (
                <button
                  onClick={() => openSite("/dashboard")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-whatsapp-primary text-white text-sm font-semibold rounded-lg hover:bg-whatsapp-secondary">
                  <Zap size={15} />
                  Upgrade to Pro
                </button>
              )}

              <div className="flex gap-2">
                <button
                  onClick={sync}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg disabled:opacity-60">
                  <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
                  Sync
                </button>
                <button
                  onClick={disconnect}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg">
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Not connected */}
              <p className="text-sm text-gray-600">
                Connect a QuickReplies account to track usage across devices
                and unlock Pro. The extension works without one — you just get
                the free monthly limit.
              </p>
              <ol className="text-xs text-gray-500 space-y-1 list-decimal pl-4">
                <li>Open the dashboard and log in.</li>
                <li>Copy your API token.</li>
                <li>Paste it below and connect.</li>
              </ol>
              <button
                onClick={() => openSite("/login")}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 rounded-lg">
                <ExternalLink size={14} />
                Open dashboard to get token
              </button>
              <div>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your API token"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-whatsapp-primary"
                />
                <button
                  onClick={connect}
                  disabled={busy || !token.trim()}
                  className="mt-2 w-full px-4 py-2 bg-whatsapp-primary text-white text-sm font-semibold rounded-lg hover:bg-whatsapp-secondary disabled:opacity-60">
                  {busy ? "Connecting…" : "Connect account"}
                </button>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}
