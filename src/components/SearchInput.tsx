import { Search } from 'lucide-react'

interface SearchInputProps {
  /** Current input value. */
  value: string
  /** Change handler. */
  onChange: (value: string) => void
  /** Placeholder text. Defaults to "Search...". */
  placeholder?: string
  /** Additional CSS class. */
  className?: string
}

/**
 * Search input with magnifying-glass icon.
 * Matches the wireframe `.search` element.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[42px] w-full rounded-lg border border-[#CAD3D6] bg-white py-0 pl-9 pr-3 text-text outline-none transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)]"
      />
    </div>
  )
}
