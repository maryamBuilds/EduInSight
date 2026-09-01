import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PROGRAMMES } from '@/lib/constants'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Institution } from '@/lib/types'

/**
 * Student self-registration page.
 * The database trigger forces role = 'student'; users cannot select a role.
 * Matches the AuthLayout visual design.
 */
export default function Register() {
  const { register, resendSignupConfirmation, profile } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [programme, setProgramme] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [institutionsLoading, setInstitutionsLoading] = useState(true)
  const [customProgramme, setCustomProgramme] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [autoConfirmed, setAutoConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  useEffect(() => {
    if (autoConfirmed && profile) {
      navigate('/student', { replace: true })
    }
  }, [autoConfirmed, navigate, profile])

  useEffect(() => {
    let cancelled = false
    const loadInstitutions = async () => {
      const result = await supabase
        .from('institutions')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (!cancelled) {
        if (result.error) setError('Educational institutions could not be loaded. Please refresh and try again.')
        else setInstitutions((result.data ?? []) as Institution[])
        setInstitutionsLoading(false)
      }
    }
    void loadInstitutions()
    return () => { cancelled = true }
  }, [])

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
    if (!institutionId) {
      setError('Please select your educational institution.')
      return
    }
    if (!programme) {
      setError('Please select your programme.')
      return
    }
    if (programme === 'Other programme' && !customProgramme.trim()) {
      setError('Please enter your degree programme.')
      return
    }
    setLoading(true)

    const result = await register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      institutionId,
      programme: programme === 'Other programme' ? customProgramme.trim() : programme,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else if (result.needsEmailConfirmation) {
      setSuccess(true)
    } else {
      setAutoConfirmed(true)
    }
  }

  if (autoConfirmed) {
    return (
      <div className="rounded-[18px] border border-border bg-white p-10 text-center shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-teal" aria-hidden="true" />
        <h2 className="mb-2 text-[26px] font-bold text-navy">Account Created</h2>
        <p className="text-muted">Opening your student dashboard…</p>
      </div>
    )
  }

  if (success) {
    const resend = async () => {
      setResending(true)
      setResendMessage('')
      const result = await resendSignupConfirmation(email.trim())
      setResending(false)
      setResendMessage(result.error ?? 'Confirmation email sent again. Check your inbox and spam folder.')
    }

    return (
      <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
        <div className="text-center">
          <CheckCircle
            className="mx-auto mb-4 h-12 w-12 text-success"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-[26px] font-bold text-navy">
            Confirm your email
          </h2>
          <p className="mb-6 text-muted">
            We sent a confirmation link to <strong className="text-navy">{email}</strong>.
            Open that link before signing in. Your student access remains locked
            until the email is confirmed.
          </p>
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-teal px-8 py-3 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {resending ? 'Sending…' : 'Resend confirmation email'}
          </button>
          {resendMessage && <p className="mt-4 text-sm text-muted" role="status">{resendMessage}</p>}
          <p className="mt-5 text-sm text-muted">
            Already confirmed?{' '}
            <Link to="/login" className="font-bold text-teal-dark hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[18px] border border-border bg-white p-10 shadow-[0_20px_55px_rgba(11,31,51,0.12)] max-md:p-7">
      <h2 className="mb-2 text-center text-[30px] font-bold text-navy">
        Create your account
      </h2>
      <p className="mb-8 text-center text-muted">
        Student self-registration for IlmVox AI
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
          <label htmlFor="fullName" className="font-bold text-text">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          />
        </div>

        <div className="mb-5 grid gap-2">
          <label htmlFor="institution" className="font-bold text-text">
            Educational institution
          </label>
          <select
            id="institution"
            value={institutionId}
            onChange={(e) => setInstitutionId(e.target.value)}
            required
            disabled={institutionsLoading}
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none disabled:cursor-wait disabled:bg-gray-100"
          >
            <option value="">{institutionsLoading ? 'Loading institutions…' : 'Select your institution'}</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>{institution.name}</option>
            ))}
          </select>
          <small className="text-xs text-muted">Your institution will be saved with your student profile.</small>
        </div>

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

        <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="password" className="font-bold text-text">
              Password
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
          <div className="grid gap-2">
            <label htmlFor="confirmPassword" className="font-bold text-text">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              required
              autoComplete="new-password"
              className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-5 grid gap-2">
          <label htmlFor="programme" className="font-bold text-text">
            Programme
          </label>
          <select
            id="programme"
            value={programme}
            onChange={(e) => setProgramme(e.target.value)}
            required
            className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
          >
            <option value="">Select your programme</option>
            {PROGRAMMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {programme === 'Other programme' && (
          <div className="mb-5 grid gap-2">
            <label htmlFor="customProgramme" className="font-bold text-text">
              Degree programme
            </label>
            <input
              id="customProgramme"
              type="text"
              value={customProgramme}
              onChange={(e) => setCustomProgramme(e.target.value)}
              placeholder="Enter your degree programme"
              required
              className="w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-4 py-3.5 text-text transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)] focus:outline-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[9px] bg-teal py-4 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-muted">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-teal-dark hover:underline"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-6 border-t border-[#E4DED2] pt-5 text-center text-[13px] leading-relaxed text-muted">
        All new accounts are created with the student role. Teacher and
        administrator roles can only be assigned by a university administrator.
      </p>
    </div>
  )
}
