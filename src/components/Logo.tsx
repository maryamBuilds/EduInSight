/**
 * IlmVox AI — Logo component
 *
 * Renders the brand mark (three ascending bars representing the
 * feedback → insight → action pipeline) and optional wordmark.
 */

interface LogoProps {
  /** Show the "IlmVox AI" wordmark. Defaults to true. */
  showName?: boolean
  /** Additional CSS class for the wrapper. */
  className?: string
  /** Additional CSS class for the wordmark only. */
  nameClassName?: string
}

export function Logo({ showName = true, className = '', nameClassName = '' }: LogoProps) {
  return (
    <div className={`font-heading flex items-center gap-[11px] text-[23px] font-bold ${className}`}>
      {/* Graph-bar logo mark */}
      <div
        className="flex h-[38px] w-[42px] items-end justify-center gap-[4px] border-[3px] border-aqua p-[7px]"
        aria-hidden="true"
        role="img"
        aria-label="IlmVox AI graph logo"
      >
        <span className="h-[9px] w-[5px] bg-aqua" />
        <span className="h-[16px] w-[5px] bg-aqua" />
        <span className="h-[24px] w-[5px] bg-aqua" />
      </div>

      {showName && <strong className={`text-inherit ${nameClassName}`}>IlmVox AI</strong>}
    </div>
  )
}
