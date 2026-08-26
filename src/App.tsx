import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import {
  AuthLayout,
  MinimalLayout,
  StudentLayout,
  TeacherLayout,
  AdminLayout,
} from '@/components'

/**
 * ProtectedRoute — placeholder wrapper.
 * Full implementation arrives in Stage 4 (Auth + Role Routing).
 * For Stage 2 it simply renders its children.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/**
 * Stage 2 placeholder for route content.
 * Each dashboard page will be replaced by its real component in later stages.
 */
function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white px-8 py-6 text-center shadow-sm">
      <h2 className="mb-2 text-2xl font-bold text-navy">EduInSight</h2>
      <p className="text-muted">{label}</p>
    </div>
  )
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

export default function App() {
  return (
    <Routes>
      {/* ── Public auth routes ── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Placeholder label="Login — Stage 4" />} />
        <Route path="/register" element={<Placeholder label="Register — Stage 4" />} />
        <Route path="/forgot-password" element={<Placeholder label="Forgot Password — Stage 4" />} />
      </Route>

      {/* ── Minimal routes (no sidebar) ── */}
      <Route element={<MinimalLayout />}>
        <Route path="/unauthorized" element={<Placeholder label="Unauthorised Access" />} />
        <Route path="*" element={<Placeholder label="404 — Page Not Found" />} />
      </Route>

      {/* ── Student routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<StudentLayout />}>
          <Route path="/student" element={<Placeholder label="Student Dashboard — Stage 6" />} />
          <Route path="/student/submit" element={<Placeholder label="Submit Feedback — Stage 5" />} />
          <Route path="/student/feedback" element={<Placeholder label="My Feedback — Stage 7" />} />
          <Route path="/student/feedback/:id" element={<Placeholder label="Feedback Detail — Stage 7" />} />
          <Route path="/student/updates" element={<Placeholder label="University Updates — Stage 6" />} />
          <Route path="/student/notifications" element={<Placeholder label="Notifications — Stage 6" />} />
        </Route>
      </Route>

      {/* ── Teacher routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<TeacherLayout />}>
          <Route path="/teacher" element={<Placeholder label="Teacher Dashboard — Stage 8" />} />
          <Route path="/teacher/insights" element={<Placeholder label="Learning Insights — Stage 8" />} />
          <Route path="/teacher/feedback" element={<Placeholder label="Teacher Feedback — Stage 8" />} />
          <Route path="/teacher/actions" element={<Placeholder label="Teacher Actions — Stage 8" />} />
          <Route path="/teacher/reports" element={<Placeholder label="Teacher Reports — Stage 8" />} />
        </Route>
      </Route>

      {/* ── Admin routes ── */}
      <Route element={<ProtectedLayout />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Placeholder label="Admin Dashboard — Stage 9" />} />
          <Route path="/admin/issues" element={<Placeholder label="Priority Issues — Stage 9" />} />
          <Route path="/admin/departments" element={<Placeholder label="Departments — Stage 9" />} />
          <Route path="/admin/actions" element={<Placeholder label="Action Tracking — Stage 9" />} />
          <Route path="/admin/updates" element={<Placeholder label="Student Updates — Stage 9" />} />
          <Route path="/admin/reports" element={<Placeholder label="Admin Reports — Stage 9" />} />
        </Route>
      </Route>

      {/* ── Redirects ── */}
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
