interface ProgressBarProps {
  /** Percentage value (0–100). */
  value: number
  /** Label displayed above the bar (optional). */
  label?: string
  /** Optional right-aligned value text (e.g. "40% (48)"). */
  valueText?: string
}

/**
 * Horizontal progress bar with optional label.
 * Matches the wireframe `.progress-track` / `.progress-fill` element.
 */
export function ProgressBar({ value, label, valueText }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className="grid gap-[7px]">
      {(label || valueText) && (
        <div className="flex items-center justify-between gap-2 text-[13px]">
          {label && <strong>{label}</strong>}
          {valueText && <span className="text-muted">{valueText}</span>}
        </div>
      )}
      <div
        className="h-[7px] overflow-hidden rounded-full bg-[#E8EEEE]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-aqua to-teal"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
