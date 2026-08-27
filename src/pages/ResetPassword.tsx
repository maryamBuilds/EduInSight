import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

/**
 * Reset-password page — reached via the email recovery link.
 *
 * Supabase exchanges the recovery token for a session automatically.
 * This page lets the user set a new password.
 */
export default function ResetPassword() {
  const { user, recoveryMode, loading: authLoading, resetPasswordUpdate } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error } = await resetPasswordUpdate(password)

    setLoading(false)

    if (error) {
      setError(error)
    } else {
      setSuccess(true)
      // Redirect to dashboard after 2 seconds
      setTimeout(() => navigate('/', { replace: true }), 2000)
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)]">
        <Loader2 className="h-8 w-8 animate-spin text-teal" aria-label="Checking recovery link" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
        <div className="text-center">
          <CheckCircle
            className="mx-auto mb-4 h-12 w-12 text-success"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-[26px] font-bold text-navy">
            Password Updated
          </h2>
          <p className="text-muted">
            Your password has been changed. Redirecting to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  // A normal signed-in session is not sufficient; require the recovery event.
  if (!user || !recoveryMode) {
    return (
      <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
        <div className="text-center">
          <AlertCircle
            className="mx-auto mb-4 h-12 w-12 text-warning"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-[26px] font-bold text-navy">
            Invalid or Expired Link
          </h2>
          <p className="mb-6 text-muted">
            This password-reset link is no longer valid. Please request a new
            one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block rounded-[9px] bg-teal px-8 py-3 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark"
          >
            Request New Link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
      <h2 className="mb-2 text-center text-[30px] font-bold text-navy">
        Set a new password
      </h2>
      <p className="mb-8 text-center text-muted">
        Enter your new password below.
      </p>

      {error && (
        <div
          className="mb-5 flex items-start gap-2 rounded-lg border border-soft-red bg-soft-red/40 p-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-5 grid gap-2">
          <label htmlFor="password" className="font-bold text-text">
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          />
        </div>

        <div className="mb-6 grid gap-2">
          <label htmlFor="confirmPassword" className="font-bold text-text">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
            required
            autoComplete="new-password"
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-teal py-4 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
