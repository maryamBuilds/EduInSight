interface PriorityReasonsProps {
  /** Bullet-point reasons explaining the priority level. */
  reasons: string[]
  /** Section heading. Defaults to "Why this issue is high priority". */
  heading?: string
}

/**
 * Amber-background card listing reasons for a priority classification.
 * Matches the wireframe `.priority-reason` element.
 */
export function PriorityReasons({
  reasons,
  heading = 'Why this issue is high priority',
}: PriorityReasonsProps) {
  return (
    <div>
      <h4 className="mb-2 text-ocean">{heading}</h4>
      <div className="rounded-[9px] bg-[#FFF8EC] p-3.5">
        <ul className="m-0 list-disc space-y-[7px] pl-5 text-sm leading-relaxed text-text">
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
