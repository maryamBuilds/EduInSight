interface PeriodSelectorProps {
  /** Available time-period options. */
  options?: string[]
  /** Currently selected value. */
  value: string
  /** Change handler. */
  onChange: (value: string) => void
  /** Accessible label. Defaults to "Time period". */
  label?: string
}

const DEFAULT_OPTIONS = [
  'Last 24 hours',
  'Last 7 days',
  'Last 14 days',
  'Last 30 days',
  'Last 3 months',
  'This semester',
]

/**
 * Select dropdown for choosing a time period.
 * Matches the wireframe `.select` element in teacher and admin dashboards.
 */
export function PeriodSelector({
  options = DEFAULT_OPTIONS,
  value,
  onChange,
  label = 'Time period',
}: PeriodSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="h-[42px] cursor-pointer rounded-lg border border-[#CAD3D6] bg-white px-3 text-text outline-none transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)]"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
