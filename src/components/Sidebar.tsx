import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  Home,
  PenSquare,
  LayoutList,
  CircleDot,
  Bell,
  UserRound,
  LayoutDashboard,
  BookOpen,
  FileText,
  Target,
  BarChart3,
  Flag,
  Building2,
  ClipboardCheck,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/lib/types'
import { useAuth } from '@/context/AuthContext'
import { Logo } from './Logo'
import { getInitials } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Navigation item definition
// ---------------------------------------------------------------------------

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** If true, renders as an external-style link (e.g. Sign Out). */
  external?: boolean
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Home', to: '/student', icon: Home },
  { label: 'Submit Feedback', to: '/student/submit', icon: PenSquare },
  { label: 'My Feedback', to: '/student/feedback', icon: LayoutList },
  { label: 'University Updates', to: '/student/updates', icon: CircleDot },
  { label: 'Notifications', to: '/student/notifications', icon: Bell },
  { label: 'My Profile', to: '/student/profile', icon: UserRound },
]

const TEACHER_NAV: NavItem[] = [
  { label: 'Overview', to: '/teacher', icon: LayoutDashboard },
  { label: 'Learning Insights', to: '/teacher/insights', icon: BookOpen },
  { label: 'Feedback', to: '/teacher/feedback', icon: FileText },
  { label: 'Actions', to: '/teacher/actions', icon: Target },
  { label: 'Reports', to: '/teacher/reports', icon: BarChart3 },
]

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard },
  { label: 'Priority Issues', to: '/admin/issues', icon: Flag },
  { label: 'Departments', to: '/admin/departments', icon: Building2 },
  { label: 'Action Tracking', to: '/admin/actions', icon: ClipboardCheck },
  { label: 'Student Updates', to: '/admin/updates', icon: CircleDot },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
]

const NAV_MAP: Record<UserRole, NavItem[]> = {
  student: STUDENT_NAV,
  teacher: TEACHER_NAV,
  admin: ADMIN_NAV,
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student View',
  teacher: 'Teacher View',
  admin: 'Administration View',
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

interface SidebarProps {
  /** The current user's role — determines navigation items. */
  role: UserRole
  /** User's full name (displayed in profile section and used for initials). */
  fullName: string
  /** Additional content below the navigation (optional). */
  extra?: ReactNode
  /**
   * Called when a navigation link is activated (e.g. clicked).
   * Layouts use this to close the mobile drawer after navigation.
   */
  onNavigate?: () => void
  /**
   * When true, renders as a fixed full-screen mobile drawer instead of
   * a sticky desktop sidebar. The layout is responsible for controlling
   * visibility (open/close state) and rendering the backdrop.
   */
  mobile?: boolean
  /**
   * Called when the close button (X) inside the mobile drawer is clicked.
   * Only used when mobile is true.
   */
  onClose?: () => void
}

/**
 * Primary navigation sidebar used across all role-based dashboards.
 *
 * - Navy → ocean gradient with aqua radial accent.
 * - Desktop (≥1024px): 255px wide with full labels.
 * - Tablet (768–1023px): 78px icon-only sidebar.
 * - Mobile (<768px): hidden; layouts render a drawer instance instead.
 */
export function Sidebar({ role, fullName, extra, onNavigate, mobile, onClose }: SidebarProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV_MAP[role]
  const initials = getInitials(fullName)

  const handleLogout = async () => {
    await logout()
    onNavigate?.()
    navigate('/login', { replace: true })
  }

  /* ── Mobile drawer ── */
  if (mobile) {
    return (
      <aside
        id={`mobile-nav-${role}`}
        className="fixed inset-0 z-30 flex flex-col overflow-y-auto px-[18px] py-7 text-white md:hidden"
        aria-label={`${role} mobile navigation drawer`}
        style={{
          background: `
            radial-gradient(circle at 10% 8%, rgba(118,199,192,0.15), transparent 28%),
            linear-gradient(180deg, #0B1F33, #12344D)
          `,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg text-white hover:bg-white/10"
          aria-label="Close navigation menu"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Logo */}
        <div className="mx-3 mb-9">
          <Logo className="text-white" />
        </div>

        {/* Navigation */}
        <nav className="grid flex-1 gap-[7px]" aria-label={`${role} mobile navigation`}>
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === `/${role}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left text-[#E5EFF3] transition-colors hover:bg-white/[0.08] ${
                  isActive
                    ? '!text-white !bg-black/20 shadow-[inset_4px_0_0_#76C7C0]'
                    : ''
                }`
              }
            >
              <Icon className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left text-[#E5EFF3] transition-colors hover:bg-white/[0.08]"
          >
            <LogOut className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            Sign Out
          </button>
        </nav>

        {extra}

        {/* User profile */}
        {role === 'student' ? (
        <NavLink
          to="/student/profile"
          onClick={onNavigate}
          className="mt-auto flex items-center gap-[11px] rounded-lg border-t border-white/20 pt-[18px] transition hover:bg-white/[0.06]"
          aria-label="Open my profile"
        >
          <span
            className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-aqua font-bold text-navy"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="grid gap-[3px]">
            <strong className="text-sm">{fullName}</strong>
            <small className="text-[#BDD1D9]">{ROLE_LABELS[role]}</small>
          </div>
        </NavLink>
        ) : (
          <div className="mt-auto flex items-center gap-[11px] border-t border-white/20 pt-[18px]">
            <span className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-aqua font-bold text-navy" aria-hidden="true">{initials}</span>
            <div className="grid gap-[3px]">
              <strong className="text-sm">{fullName}</strong>
              <small className="text-[#BDD1D9]">{ROLE_LABELS[role]}</small>
            </div>
          </div>
        )}
      </aside>
    )
  }

  /* ── Desktop / tablet sidebar (hidden on mobile) ── */
  return (
    <aside
      className="sticky top-0 hidden h-screen min-h-screen flex-col px-[18px] py-7 text-white md:flex lg:w-[255px]"
      style={{
        background: `
          radial-gradient(circle at 10% 8%, rgba(118,199,192,0.15), transparent 28%),
          linear-gradient(180deg, #0B1F33, #12344D)
        `,
      }}
    >
      {/* Logo */}
      <div className="mx-3 mb-9">
        <Logo className="text-white" />
      </div>

      {/* Navigation */}
      <nav
        className="grid flex-1 gap-[7px]"
        aria-label={`${role} navigation`}
      >
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === `/${role}`}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left text-[#E5EFF3] transition-colors hover:bg-white/[0.08] ${
                isActive
                  ? '!text-white !bg-black/20 shadow-[inset_4px_0_0_#76C7C0]'
                  : ''
              }`
            }
          >
            <Icon className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            <span className="max-lg:hidden">{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left text-[#E5EFF3] transition-colors hover:bg-white/[0.08]"
        >
          <LogOut className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          <span className="max-lg:hidden">Sign Out</span>
        </button>
      </nav>

      {extra}

      {/* User profile */}
      {role === 'student' ? (
      <NavLink
        to="/student/profile"
        className="mt-auto flex items-center gap-[11px] rounded-lg border-t border-white/20 pt-[18px] transition hover:bg-white/[0.06]"
        aria-label="Open my profile"
      >
        <span
          className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-aqua font-bold text-navy"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="grid gap-[3px] max-lg:hidden">
          <strong className="text-sm">{fullName}</strong>
          <small className="text-[#BDD1D9]">{ROLE_LABELS[role]}</small>
        </div>
      </NavLink>
      ) : (
        <div className="mt-auto flex items-center gap-[11px] border-t border-white/20 pt-[18px]">
          <span className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-aqua font-bold text-navy" aria-hidden="true">{initials}</span>
          <div className="grid gap-[3px] max-lg:hidden">
            <strong className="text-sm">{fullName}</strong>
            <small className="text-[#BDD1D9]">{ROLE_LABELS[role]}</small>
          </div>
        </div>
      )}
    </aside>
  )
}
