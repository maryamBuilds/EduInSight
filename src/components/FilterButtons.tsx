interface FilterButtonsProps<T extends string> {
  /** Available filter options. */
  options: { value: T; label: string }[]
  /** Currently active filter value. */
  active: T
  /** Called when a filter button is clicked. */
  onChange: (value: T) => void
}

/**
 * Horizontal row of pill-shaped filter buttons.
 * Matches the wireframe `.filters` / `.filter-button` element.
 */
export function FilterButtons<T extends string>({
  options,
  active,
  onChange,
}: FilterButtonsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
      {options.map(({ value, label }) => {
        const isActive = value === active
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={isActive}
            className={`rounded-[18px] border px-[11px] py-2 text-sm transition-colors ${
              isActive
                ? 'border-teal bg-soft-teal font-bold text-teal-dark'
                : 'border-border bg-white text-muted hover:bg-ivory'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
