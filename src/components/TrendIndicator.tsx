import type { TrendDirection } from '@/lib/types'
import { TREND_LABELS, TREND_ARROWS, TREND_COLOURS } from '@/lib/constants'

interface TrendIndicatorProps {
  direction: TrendDirection
  /** Show the label text beside the arrow. Defaults to true. */
  showLabel?: boolean
}

/**
 * Displays a trend arrow (↗ — ↘) with optional direction label.
 * Colour coding: increasing = danger, stable = muted, improving = success.
 */
export function TrendIndicator({ direction, showLabel = true }: TrendIndicatorProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${TREND_COLOURS[direction]}`}>
      <span aria-hidden="true">{TREND_ARROWS[direction]}</span>
      {showLabel && <span>{TREND_LABELS[direction]}</span>}
    </span>
  )
}
