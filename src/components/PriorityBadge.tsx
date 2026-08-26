import type { PriorityLevel } from '@/lib/types'
import { PRIORITY_LABELS, PRIORITY_COLOURS } from '@/lib/constants'

interface PriorityBadgeProps {
  level: PriorityLevel
  /** Override the default label text. */
  label?: string
}

/**
 * Pill badge for priority levels (high, medium, low).
 * Colour mapping is defined in constants.ts and matches the wireframe.
 */
export function PriorityBadge({ level, label }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${PRIORITY_COLOURS[level]}`}
    >
      {label ?? PRIORITY_LABELS[level]}
    </span>
  )
}
