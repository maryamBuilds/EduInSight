import { NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  Home,
  PenSquare,
  LayoutList,
  CircleDot,
  Bell,
  LayoutDashboard,
  BookOpen,
  FileText,
  Target,
  Flag,
  Building2,
  ClipboardCheck,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
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
  /** Whether the desktop sidebar is collapsed to icon-only mode. */
  collapsed?: boolean
  /** Toggles desktop sidebar collapsed state. */
  onToggleCollapse?: () => void
}

/**
 * Primary navigation sidebar used across all role-based dashboards.
 *
 * - Navy → ocean gradient with aqua radial accent.
 * - Desktop (≥1024px): 255px wide with full labels.
 * - Tablet (768–1023px): 78px icon-only sidebar.
 * - Mobile (<768px): hidden; layouts render a drawer instance instead.
 */
export function Sidebar({ role, fullName, extra, onNavigate, mobile, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
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
                `flex items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left font-semibold text-[#E5EFF3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua hover:bg-white/[0.08] ${
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
            className="flex w-full items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left font-semibold text-[#E5EFF3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua hover:bg-white/[0.08]"
          >
            <LogOut className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            Sign Out
          </button>
        </nav>

        {extra}

        {/* User profile */}
        <NavLink
          to={`/${role}/profile`}
          onClick={onNavigate}
          className="mt-auto flex items-center gap-[11px] rounded-xl border-t border-white/20 pt-[18px] transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua"
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
      </aside>
    )
  }

  /* ── Desktop / tablet sidebar (hidden on mobile) ── */
  return (
    <aside
      className={`sticky top-0 hidden h-screen min-h-screen flex-col py-7 text-white shadow-[8px_0_28px_rgba(11,31,51,0.12)] transition-[width,padding] duration-300 md:flex ${collapsed ? 'px-3 lg:w-[78px]' : 'px-[18px] lg:w-[255px]'}`}
      style={{
        background: `
          radial-gradient(circle at 10% 8%, rgba(118,199,192,0.15), transparent 28%),
          linear-gradient(180deg, #0B1F33, #12344D)
        `,
      }}
    >
      {/* Logo */}
      <div className={`mb-14 flex items-center ${collapsed ? 'justify-center' : 'mx-3'}`}>
        <Logo className="text-white" nameClassName={collapsed ? 'hidden' : 'max-lg:hidden'} />
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`absolute top-[82px] hidden h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.07] text-[#DCEAED] transition hover:border-aqua/50 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua lg:grid ${collapsed ? 'left-1/2 -translate-x-1/2' : 'right-4'}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>
        )}
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
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left font-semibold text-[#E5EFF3] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua hover:bg-white/[0.08] ${
                isActive
                  ? '!bg-white/[0.11] !text-white shadow-[inset_4px_0_0_#76C7C0,0_8px_20px_rgba(0,0,0,0.12)]'
                  : ''
              }`
            }
          >
            <Icon className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'hidden' : 'max-lg:hidden'}>{label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
          className="flex w-full items-center gap-[13px] rounded-[9px] px-4 py-3.5 text-left font-semibold text-[#E5EFF3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua hover:bg-white/[0.08]"
        >
          <LogOut className="h-[19px] w-[19px] shrink-0" aria-hidden="true" />
          <span className={collapsed ? 'hidden' : 'max-lg:hidden'}>Sign Out</span>
        </button>
      </nav>

      {extra}

      <NavLink
        to={`/${role}/profile`}
        title={collapsed ? `${fullName} · ${ROLE_LABELS[role]}` : undefined}
        className={`mt-auto flex items-center gap-[11px] rounded-xl border-t border-white/20 pt-[18px] transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua ${collapsed ? 'justify-center' : ''}`}
        aria-label="Open my profile"
      >
        <span
          className="grid h-[45px] w-[45px] shrink-0 place-items-center rounded-full bg-aqua font-bold text-navy"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className={`gap-[3px] ${collapsed ? 'hidden' : 'grid max-lg:hidden'}`}>
          <strong className="text-sm">{fullName}</strong>
          <small className="text-[#BDD1D9]">{ROLE_LABELS[role]}</small>
        </div>
      </NavLink>
    </aside>
  )
}
