import type { ReactNode } from 'react'
import { Bell, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getInitials } from '@/lib/utils'

interface TopbarProps {
  /** Primary heading (e.g. "Good Morning, S. Maryam"). */
  greeting: string
  /** Secondary subtitle (e.g. "BS Computer Science · Semester 3"). */
  subtitle?: string
  /** User's full name for the avatar in the top-right corner. */
  avatarName?: string
  /** Optional profile destination for the avatar. */
  avatarHref?: string
  /** Notification count badge. 0 or undefined hides the badge. */
  notificationCount?: number
  /** Optional destination for the notification bell. */
  notificationHref?: string
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
  avatarHref,
  notificationCount,
  notificationHref,
  actions,
  onMenuClick,
  menuExpanded,
  menuControlsId,
}: TopbarProps) {
  const initials = avatarName ? getInitials(avatarName) : undefined

  return (
    <header className="relative z-10 flex min-h-[88px] flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-white via-white to-[#F3FAF9] px-8 py-[18px] shadow-[0_4px_18px_rgba(11,31,51,0.05)] max-md:px-[18px]">
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
          <h1 className="m-0 text-[27px] font-bold tracking-[-0.02em] text-navy">{greeting}</h1>
          {subtitle && (
            <p className="mt-[5px] text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: actions + notifications + avatar */}
      <div className="flex items-center gap-3">
        {actions}

        {notificationCount != null && (
          notificationHref ? (
            <Link
              to={notificationHref}
              className="relative grid h-[42px] w-[42px] place-items-center rounded-full border border-[#CAD3D6] bg-white hover:bg-gray-50"
              aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : 'Open notifications'}
            >
              <Bell className="h-[18px] w-[18px] text-muted" aria-hidden="true" />
              {notificationCount > 0 && (
                <span className="absolute -right-[3px] -top-[4px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#E76F51] px-1 text-[11px] font-bold text-white">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              className="relative grid h-[42px] w-[42px] place-items-center rounded-full border border-[#CAD3D6] bg-white"
              aria-label={`${notificationCount} notifications`}
            >
            <Bell className="h-[18px] w-[18px] text-muted" aria-hidden="true" />
            {notificationCount > 0 && (
              <span className="absolute -right-[3px] -top-[4px] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#E76F51] px-1 text-[11px] font-bold text-white">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
            </button>
          )
        )}

        {initials && (avatarHref ? (
          <Link to={avatarHref} className="flex items-center gap-2.5 rounded-full pr-1 transition hover:bg-soft-blue" aria-label="Open my profile">
            <span className="grid h-[45px] w-[45px] place-items-center rounded-full bg-aqua font-bold text-navy">
              {initials}
            </span>
            <strong className="max-w-28 truncate text-sm text-navy max-lg:hidden">{avatarName?.split(/\s+/)[0]}</strong>
          </Link>
        ) : (
          <span
            className="grid h-[45px] w-[45px] place-items-center rounded-full bg-aqua font-bold text-navy"
            aria-hidden="true"
          >
            {initials}
          </span>
        ))}
      </div>
    </header>
  )
}
