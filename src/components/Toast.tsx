import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastProps {
  /** Whether the toast is visible. */
  open: boolean
  /** Text message to display. */
  message: string
  /** Visual variant. Defaults to "success". */
  variant?: ToastVariant
  /** Auto-dismiss duration in ms. Defaults to 3000. 0 = no auto-dismiss. */
  duration?: number
  /** Called when the toast should close. */
  onClose: () => void
}

const VARIANT_CONFIG: Record<
  ToastVariant,
  { bg: string; Icon: typeof CheckCircle }
> = {
  success: { bg: 'bg-ocean', Icon: CheckCircle },
  error: { bg: 'bg-danger', Icon: AlertTriangle },
  info: { bg: 'bg-ocean', Icon: Info },
}

/**
 * Fixed-position toast notification at the bottom-right corner.
 * Matches the wireframe `.toast` element.
 */
export function Toast({
  open,
  message,
  variant = 'success',
  duration = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!open || duration === 0) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [open, duration, onClose])

  if (!open) return null

  const { bg, Icon } = VARIANT_CONFIG[variant]

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-40 flex max-w-[360px] items-center gap-3 rounded-[9px] px-[18px] py-[15px] text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)] ${bg}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded p-0.5 text-white/70 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  )
}
