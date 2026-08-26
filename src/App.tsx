import { Routes, Route, Navigate } from 'react-router-dom'

/**
 * ProtectedRoute — placeholder wrapper.
 * Full implementation arrives in Stage 4 (Auth + Role Routing).
 * For Stage 1 it simply renders its children.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/**
 * Stage 1 placeholder landing page.
 * Replaced by real LoginPage in Stage 4.
 */
function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory">
      <div className="rounded-2xl border border-border bg-white px-8 py-6 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-navy">EduInSight</h1>
        <p className="text-muted">{label}</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Placeholder label="Login — Stage 4" />} />
      <Route path="/register" element={<Placeholder label="Register — Stage 4" />} />
      <Route path="/forgot-password" element={<Placeholder label="Forgot Password — Stage 4" />} />
      <Route path="/unauthorized" element={<Placeholder label="Unauthorised Access" />} />

      {/* Student routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <Placeholder label="Student Dashboard — Stage 6" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/submit"
        element={
          <ProtectedRoute>
            <Placeholder label="Submit Feedback — Stage 5" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/feedback"
        element={
          <ProtectedRoute>
            <Placeholder label="My Feedback — Stage 7" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/feedback/:id"
        element={
          <ProtectedRoute>
            <Placeholder label="Feedback Detail — Stage 7" />
          </ProtectedRoute>
        }
      />

      {/* Teacher routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute>
            <Placeholder label="Teacher Dashboard — Stage 8" />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Placeholder label="Admin Dashboard — Stage 9" />
          </ProtectedRoute>
        }
      />

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Placeholder label="404 — Page Not Found" />} />
    </Routes>
  )
}
