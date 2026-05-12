import type { VariableContext } from "~/types"

// Available variables that can be used in templates
export const AVAILABLE_VARIABLES = [
  { key: "name", description: "Contact name from WhatsApp" },
  { key: "time", description: "Current time (HH:MM)" },
  { key: "date", description: "Current date (DD/MM/YYYY)" },
  { key: "day", description: "Current day name" }
]

// Get current variable context
export function getVariableContext(contactName: string = "there"): VariableContext {
  const now = new Date()

  return {
    name: contactName || "there",
    time: now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }),
    date: now.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }),
    day: now.toLocaleDateString("en-IN", { weekday: "long" })
  }
}

// Replace variables in template content
export function processTemplate(
  content: string,
  context: VariableContext
): string {
  let processed = content

  // Replace all known variables
  Object.entries(context).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi")
    processed = processed.replace(regex, value)
  })

  return processed
}

// Extract variable names from template content
export function extractVariables(content: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }

  return variables
}

// Validate if all variables in template are supported
export function validateVariables(content: string): {
  valid: boolean
  unsupported: string[]
} {
  const usedVariables = extractVariables(content)
  const supportedKeys = AVAILABLE_VARIABLES.map((v) => v.key)
  const unsupported = usedVariables.filter((v) => !supportedKeys.includes(v.toLowerCase()))

  return {
    valid: unsupported.length === 0,
    unsupported
  }
}

// Format template preview with highlighted variables
export function formatPreview(content: string): string {
  return content.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    '<span class="variable">{{$1}}</span>'
  )
}
