interface EvidenceQuoteProps {
  /** The original feedback text to display. */
  text: string
  /** Language hint (for dir attribute). */
  language?: 'en' | 'ur' | 'roman_ur' | 'mixed'
}

/**
 * Blockquote-style evidence card with aqua left border.
 * Preserves the original multilingual feedback text per AGENTS.md.
 * Matches the wireframe `.evidence` element.
 */
export function EvidenceQuote({ text, language }: EvidenceQuoteProps) {
  const isRtl = language === 'ur'
  // Detect Urdu script heuristically for dir="auto" fallback
  const dir = isRtl ? 'rtl' : 'auto'

  return (
    <blockquote
      dir={dir}
      className="my-2 rounded-r border-l-4 border-aqua bg-[#F5F8F7] px-3.5 py-3 leading-relaxed not-italic text-text"
    >
      &ldquo;{text}&rdquo;
    </blockquote>
  )
}
