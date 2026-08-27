import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
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
            <Route path="/student" element={<Placeholder label="Student Dashboard — Stage 6" />} />
            <Route path="/student/submit" element={<Placeholder label="Submit Feedback — Stage 5" />} />
            <Route path="/student/feedback" element={<Placeholder label="My Feedback — Stage 7" />} />
            <Route path="/student/feedback/:id" element={<Placeholder label="Feedback Detail — Stage 7" />} />
            <Route path="/student/updates" element={<Placeholder label="University Updates — Stage 6" />} />
            <Route path="/student/notifications" element={<Placeholder label="Notifications — Stage 6" />} />
          </Route>
        </Route>
      </Route>

      {/* ── Teacher routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<RoleGuard allowedRole="teacher" />}>
          <Route element={<TeacherLayout />}>
            <Route path="/teacher" element={<Placeholder label="Teacher Dashboard — Stage 8" />} />
            <Route path="/teacher/insights" element={<Placeholder label="Learning Insights — Stage 8" />} />
            <Route path="/teacher/feedback" element={<Placeholder label="Teacher Feedback — Stage 8" />} />
            <Route path="/teacher/actions" element={<Placeholder label="Teacher Actions — Stage 8" />} />
            <Route path="/teacher/reports" element={<Placeholder label="Teacher Reports — Stage 8" />} />
          </Route>
        </Route>
      </Route>

      {/* ── Admin routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<RoleGuard allowedRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Placeholder label="Admin Dashboard — Stage 9" />} />
            <Route path="/admin/issues" element={<Placeholder label="Priority Issues — Stage 9" />} />
            <Route path="/admin/departments" element={<Placeholder label="Departments — Stage 9" />} />
            <Route path="/admin/actions" element={<Placeholder label="Action Tracking — Stage 9" />} />
            <Route path="/admin/updates" element={<Placeholder label="Student Updates — Stage 9" />} />
            <Route path="/admin/reports" element={<Placeholder label="Admin Reports — Stage 9" />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
