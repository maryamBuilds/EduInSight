import type { ReactNode } from 'react'
import { Bell, Menu } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface TopbarProps {
  /** Primary heading (e.g. "Good Morning, S. Maryam"). */
  greeting: string
  /** Secondary subtitle (e.g. "BS Computer Science · Semester 3"). */
  subtitle?: string
  /** User's full name for the avatar in the top-right corner. */
  avatarName?: string
  /** Notification count badge. 0 or undefined hides the badge. */
  notificationCount?: number
  /** Additional action elements (e.g. SearchInput, PeriodSelector). */
  actions?: ReactNode
  /** Called when the mobile hamburger button is tapped. */
  onMenuClick?: () => void
  /** Whether the mobile navigation drawer is currently open. */
  menuExpanded?: boolean
  /** ID of the mobile navigation drawer controlled by the hamburger button. */
  menuControlsId?: string
}

/**
 * Top header bar with greeting, optional search/period actions, and avatar.
 * Matches the wireframe `.topbar` element.
 */
export function Topbar({
  greeting,
  subtitle,
  avatarName,
  notificationCount,
  actions,
  onMenuClick,
  menuExpanded,
  menuControlsId,
}: TopbarProps) {
  const initials = avatarName ? getInitials(avatarName) : undefined

  return (
    <header className="flex min-h-[88px] flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-8 py-[18px] max-md:px-[18px]">
      {/* Left: hamburger (mobile) + greeting */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-navy hover:bg-gray-100 md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={menuExpanded ?? false}
          aria-controls={menuControlsId}
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <div>
          <h1 className="m-0 text-[27px] text-navy">{greeting}</h1>
          {subtitle && (
            <p className="mt-[5px] text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: actions + notifications + avatar */}
      <div className="flex items-center gap-3">
        {actions}

        {notificationCount != null && notificationCount > 0 && (
          <button
            type="button"
            className="relative grid h-[42px] w-[42px] place-items-center rounded-full border border-[#CAD3D6] bg-white"
            aria-label={`${notificationCount} notifications`}
          >
            <Bell className="h-[18px] w-[18px] text-muted" aria-hidden="true" />
            <span className="absolute -right-[3px] -top-[4px] grid h-[18px] w-[18px] place-items-center rounded-full bg-[#E76F51] text-[11px] font-bold text-white">
              {notificationCount}
            </span>
          </button>
        )}

        {initials && (
          <span
            className="grid h-[45px] w-[45px] place-items-center rounded-full bg-aqua font-bold text-navy"
            aria-hidden="true"
          >
            {initials}
          </span>
        )}
      </div>
    </header>
  )
}
