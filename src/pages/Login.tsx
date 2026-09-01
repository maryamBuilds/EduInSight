import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2, AlertCircle } from 'lucide-react'

/**
 * Login page — email/password sign-in.
 * Matches the login_wireframe.html visual design inside AuthLayout.
 */
export default function Login() {
  const { login, authError, clearAuthError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    clearAuthError()
    setLoading(true)

    const { error } = await login(email.trim(), password)

    setLoading(false)

    if (error) {
      setError(error)
    }
  }

  return (
    <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
      <h2 className="mb-2 text-center text-[30px] font-bold text-navy">
        Welcome back
      </h2>
      <p className="mb-8 text-center text-muted">
        Sign in to continue to IlmVox AI
      </p>

      {(error || authError) && (
        <div
          className="mb-5 flex items-start gap-2 rounded-lg border border-soft-red bg-soft-red/40 p-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error || authError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5 grid gap-2">
          <label htmlFor="email" className="font-bold text-text">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          />
        </div>

        <div className="mb-5 grid gap-2">
          <label htmlFor="password" className="font-bold text-text">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          />
        </div>

        <div className="mb-6 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" className="rounded border-[#C9D2D5]" />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="font-semibold text-teal-dark hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-teal py-4 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-muted">
        Student?{' '}
        <Link
          to="/register"
          className="font-semibold text-teal-dark hover:underline"
        >
          Create an account
        </Link>
      </p>

      <p className="mt-6 border-t border-[#E4DED2] pt-5 text-center text-[13px] leading-relaxed text-muted">
        Teacher and administrator accounts are issued or approved by the
        university. Users do not select their role during login.
      </p>
    </div>
  )
}
