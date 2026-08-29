import { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AuthLayout,
  MinimalLayout,
  StudentLayout,
  TeacherLayout,
  AdminLayout,
} from '@/components'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import SubmitFeedback from '@/pages/SubmitFeedback'
import StudentDashboard from '@/pages/student/StudentDashboard'
import MyFeedback from '@/pages/student/MyFeedback'
import FeedbackDetail from '@/pages/student/FeedbackDetail'
import UniversityUpdates from '@/pages/student/UniversityUpdates'
import StudentNotifications from '@/pages/student/StudentNotifications'
import StudentProfile from '@/pages/student/StudentProfile'
import TeacherDashboard from '@/pages/teacher/TeacherDashboard'
import AdminDashboard from '@/pages/admin/AdminDashboard'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map each role to its dashboard root path. */
const ROLE_HOME: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
}

/**
 * Full-screen loading spinner shown while the initial session is being
 * restored and the user's profile is being fetched.
 */
function AuthLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory">
      <div className="flex flex-col items-center gap-4 text-navy">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted">Loading EduInSight…</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProtectedRoute — requires authentication + active profile
// ---------------------------------------------------------------------------

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <AuthLoader />

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (!profile.is_active) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

/**
 * Wrapper that nests a ProtectedRoute around a layout Outlet.
 */
function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  )
}

// ---------------------------------------------------------------------------
// RoleGuard — restricts a route group to a specific role
// ---------------------------------------------------------------------------

function RoleGuard({ allowedRole }: { allowedRole: UserRole }) {
  const { profile } = useAuth()

  if (!profile) return null // Should not happen inside ProtectedRoute

  if (profile.role !== allowedRole) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}

// ---------------------------------------------------------------------------
// RedirectIfAuth — sends authenticated users to their dashboard
// ---------------------------------------------------------------------------

function RedirectIfAuth() {
  const { profile, loading } = useAuth()

  if (loading) return <AuthLoader />

  if (profile) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <Outlet />
}

// ---------------------------------------------------------------------------
// SmartRoot — "/" redirects to the user's role dashboard or login
// ---------------------------------------------------------------------------

function SmartRoot() {
  const { profile, loading } = useAuth()

  if (loading) return <AuthLoader />

  if (profile) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <Navigate to="/login" replace />
}

// ---------------------------------------------------------------------------
// Unauthorised page content
// ---------------------------------------------------------------------------

function UnauthorizedPage() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <h2 className="mb-3 text-2xl font-bold text-navy">Unauthorised Access</h2>
      <p className="mb-6 text-muted">
        {profile
          ? `Your account role (${profile.role}) does not have access to this page.`
          : 'You do not have permission to view this page.'}
      </p>
      <div className="flex items-center justify-center gap-3">
        {profile && (
          <button
            onClick={() => navigate(ROLE_HOME[profile.role], { replace: true })}
            className="rounded-[9px] bg-teal px-6 py-3 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark"
          >
            Go to Dashboard
          </button>
        )}
        <button
          onClick={handleLogout}
          className="rounded-[9px] border border-border bg-white px-6 py-3 font-semibold text-text transition-colors hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Placeholder for routes not yet implemented
// ---------------------------------------------------------------------------

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-8 py-6 text-center shadow-sm">
      <h2 className="mb-2 text-2xl font-bold text-navy">EduInSight</h2>
      <p className="text-muted">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardSectionRoute — renders a complete dashboard at a focused section
// ---------------------------------------------------------------------------

function DashboardSectionRoute({
  children,
  sectionId,
}: {
  children: React.ReactNode
  sectionId?: string
}) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (!sectionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const scrollToSection = () => {
      const section = document.getElementById(sectionId)
      if (!section) return false

      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return true
    }

    if (scrollToSection()) return

    // Dashboards fetch live data before their sections render. Observe the
    // document briefly so direct section routes still focus the right panel.
    const observer = new MutationObserver(() => {
      if (scrollToSection()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const timeout = window.setTimeout(() => observer.disconnect(), 5000)

    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [pathname, sectionId])

  return <>{children}</>
}

// ---------------------------------------------------------------------------
// App — route tree
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <Routes>
      {/* ── Root: redirect to role dashboard or login ── */}
      <Route path="/" element={<SmartRoot />} />

      {/* ── Public auth routes (redirect if already logged in) ── */}
      <Route element={<RedirectIfAuth />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
      </Route>

      {/* Recovery must remain reachable while Supabase has signed the user in. */}
      <Route element={<AuthLayout />}>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* ── Minimal routes (no sidebar) ── */}
      <Route element={<MinimalLayout />}>
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Placeholder label="404 — Page Not Found" />} />
      </Route>

      {/* ── Student routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<RoleGuard allowedRole="student" />}>
          <Route element={<StudentLayout />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/submit" element={<SubmitFeedback />} />
            <Route path="/student/feedback" element={<MyFeedback />} />
            <Route path="/student/feedback/:id" element={<FeedbackDetail />} />
            <Route path="/student/updates" element={<UniversityUpdates />} />
            <Route path="/student/notifications" element={<StudentNotifications />} />
            <Route path="/student/profile" element={<StudentProfile />} />
          </Route>
        </Route>
      </Route>

      {/* ── Teacher routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<RoleGuard allowedRole="teacher" />}>
          <Route element={<TeacherLayout />}>
            <Route path="/teacher" element={<TeacherDashboard view="overview" />} />
            <Route path="/teacher/insights" element={<TeacherDashboard view="insights" />} />
            <Route path="/teacher/feedback" element={<TeacherDashboard view="feedback" />} />
            <Route path="/teacher/actions" element={<TeacherDashboard view="actions" />} />
            <Route path="/teacher/reports" element={<Navigate to="/teacher" replace />} />
          </Route>
        </Route>
      </Route>

      {/* ── Admin routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<RoleGuard allowedRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardSectionRoute><AdminDashboard /></DashboardSectionRoute>} />
            <Route path="/admin/issues" element={<DashboardSectionRoute sectionId="admin-issues"><AdminDashboard /></DashboardSectionRoute>} />
            <Route path="/admin/departments" element={<DashboardSectionRoute sectionId="admin-departments"><AdminDashboard /></DashboardSectionRoute>} />
            <Route path="/admin/actions" element={<DashboardSectionRoute sectionId="admin-actions"><AdminDashboard /></DashboardSectionRoute>} />
            <Route path="/admin/updates" element={<DashboardSectionRoute sectionId="admin-actions"><AdminDashboard /></DashboardSectionRoute>} />
            <Route path="/admin/reports" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
