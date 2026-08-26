import type { ReactNode } from 'react'

interface PanelProps {
  /** Optional heading displayed in the panel header. */
  title?: string
  /** Optional action element (e.g. "View all →" button) in the header. */
  action?: ReactNode
  /** Panel body content. */
  children: ReactNode
  /** Additional CSS class for the panel wrapper. */
  className?: string
}

/**
 * Rounded white card container used throughout all dashboards.
 * Matches the wireframe `.panel` element.
 */
export function Panel({ title, action, children, className = '' }: PanelProps) {
  const hasHeader = title || action

  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-white ${className}`}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-[18px]">
          {title && (
            <h3 className="m-0 text-[19px] text-navy">{title}</h3>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
