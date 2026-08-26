import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface OverlayDialogProps {
  /** Whether the dialog is visible. */
  open: boolean
  /** Called when the dialog should close (overlay click, Escape, close button). */
  onClose: () => void
  /** Dialog title. */
  title: string
  /** Optional subtitle above the title. */
  subtitle?: string
  /** Dialog body content. */
  children: ReactNode
  /** Optional footer with action buttons. */
  footer?: ReactNode
  /** Maximum width CSS value. Defaults to "min(780px, 100%)". */
  maxWidth?: string
}

/**
 * Full-screen overlay with a centred dialog card.
 * Matches the wireframe `.detail-overlay` / `.dialog` element.
 * Handles Escape key, overlay click-to-close, body scroll lock, and focus trap.
 */
export function OverlayDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'min(780px, 100%)',
}: OverlayDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Save previously focused element & manage focus + focus trap + Escape key
  useEffect(() => {
    if (!open) {
      // Restore focus to the element that had focus before the dialog opened
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
      return
    }

    // Remember what was focused before the dialog
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Move focus into the dialog: first focusable child, or the dialog itself
    const el = dialogRef.current
    if (el) {
      const focusable = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        el.focus()
      }
    }

    // Focus trap (Tab / Shift+Tab) + Escape-to-close
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusableEls = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusableEls.length === 0) return

      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-5"
      style={{ background: 'rgba(6, 22, 35, 0.48)' }}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[92vh] flex-col overflow-hidden rounded-[15px] bg-white shadow-[0_24px_65px_rgba(0,0,0,0.25)]"
        style={{ width: maxWidth }}
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            {subtitle && (
              <small className="text-muted">{subtitle}</small>
            )}
            <h2 className="mt-1 text-xl text-navy">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mt-1 rounded p-1 text-muted hover:text-text"
            aria-label="Close dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer className="flex items-center justify-end gap-2.5 border-t border-border px-6 py-[17px]">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
