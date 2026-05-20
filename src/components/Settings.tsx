import { X, Download, Upload, Bug } from "lucide-react"
import type { UserSettings } from "~/types"
import { exportData, importData } from "~/storage"

// Opens the user's mail client with a pre-filled bug report — version,
// browser and a blank "what happened" so support emails arrive with enough
// context to reproduce. The simplest possible feedback loop.
function reportBug(): void {
  const version = chrome.runtime.getManifest().version
  const subject = `QuickReplies bug report (v${version})`
  const body =
    `Extension version: ${version}\n` +
    `Browser: ${navigator.userAgent}\n` +
    `Page: ${typeof window !== "undefined" ? window.location.hostname : "popup"}\n\n` +
    `What happened:\n\n\n` +
    `What I expected:\n\n\n` +
    `Steps to reproduce:\n1. \n2. \n3. \n`
  window.open(
    `mailto:tech@gsharp.media?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    "_blank"
  )
}

interface SettingsProps {
  settings: UserSettings
  onUpdate: (updates: Partial<UserSettings>) => void
  onClose: () => void
}

export function Settings({ settings, onUpdate, onClose }: SettingsProps) {
  const handleExport = async () => {
    const data = await exportData()
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `whatsapp-quick-replies-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        const content = event.target?.result as string
        const success = await importData(content)
        if (success) {
          alert("Data imported successfully! Please refresh the extension.")
          window.location.reload()
        } else {
          alert("Failed to import data. Please check the file format.")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Toggle Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Features</h3>

            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Enable slash commands
              </span>
              <input
                type="checkbox"
                checked={settings.enableSlashCommands}
                onChange={(e) =>
                  onUpdate({ enableSlashCommands: e.target.checked })
                }
                className="w-4 h-4 text-whatsapp-primary rounded focus:ring-whatsapp-primary"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Enable keyboard shortcuts (Alt+1-5)
              </span>
              <input
                type="checkbox"
                checked={settings.enableKeyboardShortcuts}
                onChange={(e) =>
                  onUpdate({ enableKeyboardShortcuts: e.target.checked })
                }
                className="w-4 h-4 text-whatsapp-primary rounded focus:ring-whatsapp-primary"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Show sidebar button on WhatsApp
              </span>
              <input
                type="checkbox"
                checked={settings.showSidebar}
                onChange={(e) => onUpdate({ showSidebar: e.target.checked })}
                className="w-4 h-4 text-whatsapp-primary rounded focus:ring-whatsapp-primary"
              />
            </label>
          </div>

          {/* Backup/Restore */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700">
              Backup & Restore
            </h3>

            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download size={16} />
                Export Data
              </button>
              <button
                onClick={handleImport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Upload size={16} />
                Import Data
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700">
              Keyboard Shortcuts
            </h3>
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                  Alt + 1-5
                </kbd>{" "}
                - Insert favorite templates
              </p>
              <p>
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                  /command
                </kbd>{" "}
                - Type slash commands in chat
              </p>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700">Support</h3>
            <button
              onClick={reportBug}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Bug size={15} />
              Report a bug
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Version {chrome.runtime.getManifest().version}
            </p>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm text-white bg-whatsapp-primary rounded-lg hover:bg-whatsapp-secondary transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
