interface IdentityBadgeProps {
  isAnonymous: boolean
  /** Student's name, present only when they chose to submit with it. */
  name?: string | null
  /** Student's department, shown next to the name. */
  department?: string | null
}

/**
 * Pill showing who sent a feedback submission: "Anonymous student" by
 * default, or the student's name and department when they chose to share it.
 */
export function IdentityBadge({ isAnonymous, name, department }: IdentityBadgeProps) {
  if (isAnonymous || !name) {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-[#EEF1F2] px-2.5 py-1 text-xs font-semibold text-muted">
        Anonymous student
      </span>
    )
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-soft-teal px-2.5 py-1 text-xs font-semibold text-teal-dark">
      From: {name}
      {department ? ` · ${department}` : ''}
    </span>
  )
}
