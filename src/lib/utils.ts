/**
 * IlmVox AI — shared utility functions
 */

/**
 * Format an ISO timestamp into a human-readable relative string.
 * Falls back to the locale date string when the date is older than 30 days.
 */
export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format an ISO timestamp as a short date string (e.g. "18 August 2026").
 */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Generate two-letter initials from a full name.
 * "Sajda Maryam" → "SM"
 * "Dr. Fatima Sahar" → "DF" (skips titles/punctuation)
 */
export function getInitials(fullName: string): string {
  const parts = fullName
    .replace(/[.]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Generate a unique reference number for feedback submissions.
 * Format: EDU-YYYY-NNNN
 */
export function generateReferenceNumber(sequenceNumber: number): string {
  const year = new Date().getFullYear()
  const padded = String(sequenceNumber).padStart(4, '0')
  return `EDU-${year}-${padded}`
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1).trimEnd() + '…'
}

/**
 * Build a greeting based on the current hour.
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

/**
 * Type-safe exhaustive check for switch statements and conditionals.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`)
}
