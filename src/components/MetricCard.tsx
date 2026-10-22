import type { ReactNode } from 'react'

interface MetricCardProps {
  /** Icon element (typically a Lucide icon). */
  icon: ReactNode
  /** Descriptive label (e.g. "Total Feedback"). */
  label: string
  /** Numeric or text value (e.g. "120"). */
  value: string | number
  /** Background colour class for the icon container. */
  iconBg?: string
  /** Text colour class for the icon. */
  iconColour?: string
}

/**
 * Dashboard metric card with icon, label and value.
 * Matches the wireframe `.metric` / `.metric-card` element.
 */
export function MetricCard({
  icon,
  label,
  value,
  iconBg = 'bg-soft-blue',
  iconColour = 'text-ocean',
}: MetricCardProps) {
  return (
    <article className="flex min-w-0 items-center gap-3.5 rounded-[13px] border border-border bg-white p-[19px] max-sm:flex-col max-sm:items-start max-sm:gap-2 max-sm:p-3.5">
      <div
        className={`grid h-12 w-12 shrink-0 place-items-center max-sm:h-9 max-sm:w-9 rounded-[11px] text-[22px] ${iconBg} ${iconColour}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <small className="block leading-snug text-muted">{label}</small>
        <strong className="mt-1 block text-[27px] text-navy max-sm:text-2xl">{value}</strong>
      </div>
    </article>
  )
}
