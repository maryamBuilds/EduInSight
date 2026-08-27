import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'

/**
 * Forgot-password page — sends a recovery email via Supabase.
 */
export default function ForgotPassword() {
  const { resetPasswordRequest } = useAuth()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await resetPasswordRequest(email.trim())

    setLoading(false)

    if (error) {
      setError(error)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
        <div className="text-center">
          <CheckCircle
            className="mx-auto mb-4 h-12 w-12 text-success"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-[26px] font-bold text-navy">
            Check your email
          </h2>
          <p className="mb-6 text-muted">
            If an account exists for <strong>{email}</strong>, we have sent a
            password-reset link. Please check your inbox and follow the
            instructions.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 font-semibold text-teal-dark hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
      <h2 className="mb-2 text-center text-[30px] font-bold text-navy">
        Forgot your password?
      </h2>
      <p className="mb-8 text-center text-muted">
        Enter your university email and we will send you a link to reset your
        password.
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
        <div className="mb-6 grid gap-2">
          <label htmlFor="email" className="font-bold text-text">
            University email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu.pk"
            required
            autoComplete="email"
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
          {loading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 font-semibold text-teal-dark hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
