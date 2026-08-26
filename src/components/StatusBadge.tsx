import type { FeedbackStatus } from '@/lib/types'
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUS_COLOURS } from '@/lib/constants'

interface StatusBadgeProps {
  status: FeedbackStatus
  /** Override the default label text. */
  label?: string
}

/**
 * Pill badge for feedback statuses.
 * Colour mapping is defined in constants.ts and matches the wireframe.
 */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${FEEDBACK_STATUS_COLOURS[status]}`}
    >
      {label ?? FEEDBACK_STATUS_LABELS[status]}
    </span>
  )
}
