import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  /** The authenticated Supabase user, or null when signed out. */
  user: User | null
  /** The user's profile row from the profiles table. */
  profile: Profile | null
  /** True while the initial session is being restored or a profile is loading. */
  loading: boolean
  /** True only while Supabase has opened a password-recovery session. */
  recoveryMode: boolean
  /** A user-facing account/session error that survives an automatic sign-out. */
  authError: string | null
  clearAuthError: () => void
  /** Sign in with email and password. */
  login: (email: string, password: string) => Promise<{ error: string | null }>
  /** Register a new student account. */
  register: (data: RegisterData) => Promise<{
    error: string | null
    needsEmailConfirmation: boolean
  }>
  /** Resend the pending student's signup confirmation email. */
  resendSignupConfirmation: (email: string) => Promise<{ error: string | null }>
  /** End the current session. */
  logout: () => Promise<void>
  /** Send a password-reset email. */
  resetPasswordRequest: (
    email: string,
  ) => Promise<{ error: string | null }>
  /** Set a new password using the recovery session. */
  resetPasswordUpdate: (
    password: string,
  ) => Promise<{ error: string | null }>
}

export interface RegisterData {
  fullName: string
  email: string
  password: string
  institutionId: string
  programme: string
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthState | undefined>(undefined)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  /* ── Restore session and synchronously mirror auth events ── */
  useEffect(() => {
    let mounted = true
    const sessionTimeout = window.setTimeout(() => {
      if (!mounted) return
      setAuthError('Your session could not be restored. Please sign in again.')
      setSessionReady(true)
      setLoading(false)
    }, 8000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        window.clearTimeout(sessionTimeout)
        if (!mounted) return
        setUser((current) =>
          current?.id === session?.user.id ? current : (session?.user ?? null),
        )
        if (!session?.user) {
          setProfile(null)
          setLoading(false)
        }
        setSessionReady(true)
      })
      .catch(() => {
        window.clearTimeout(sessionTimeout)
        if (!mounted) return
        setAuthError('Your session could not be restored. Please sign in again.')
        setSessionReady(true)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true)
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setRecoveryMode(false)
          setLoading(false)
        } else if (session?.user) {
          // Keep the existing object for the same user. Token refresh events
          // must not restart profile loading and trap the app on its loader.
          setUser((current) =>
            current?.id === session.user.id ? current : session.user,
          )
        }

        setSessionReady(true)
      },
    )

    return () => {
      mounted = false
      window.clearTimeout(sessionTimeout)
      subscription.unsubscribe()
    }
  }, [])

  /* ── Load the profile outside the auth callback to avoid client lock races ── */
  const userId = user?.id

  useEffect(() => {
    let cancelled = false

    if (!sessionReady) return
    if (!userId) return

    const loadProfile = async () => {
      // A new-user trigger may need a moment to create the profile row.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController()
        const requestTimeout = window.setTimeout(() => controller.abort(), 4000)
        let data: Profile | null = null
        let requestFailed = true

        try {
          const result = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .abortSignal(controller.signal)
            .maybeSingle()
          data = result.data as Profile | null
          requestFailed = Boolean(result.error)
        } catch {
          // Keep requestFailed true for network errors and timeouts.
        } finally {
          window.clearTimeout(requestTimeout)
        }

        if (cancelled) return

        if (!requestFailed && data) {
          const nextProfile = data
          if (!nextProfile.is_active) {
            setAuthError(
              'Your account is inactive. Please contact your university administrator.',
            )
            setUser(null)
            setProfile(null)
            setLoading(false)
            void supabase.auth.signOut()
            return
          }

          setProfile(nextProfile)
          setAuthError(null)
          setLoading(false)
          return
        }

        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 300))
        }
      }

      if (!cancelled) {
        setAuthError(
          'Your account profile could not be loaded. Please try again or contact support.',
        )
        setUser(null)
        setProfile(null)
        setLoading(false)
        void supabase.auth.signOut()
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [sessionReady, userId])

  /* ── Login ── */
  const login = async (email: string, password: string) => {
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Invalid email or password. Please try again.' }
      }
      if (error.message.includes('Email not confirmed')) {
        return {
          error:
            'Please check your email and confirm your account before signing in.',
        }
      }
      return { error: error.message }
    }

    // Use the successful response immediately. The auth event remains useful
    // for other tabs, but navigation must not depend on its timing.
    if (data.user) {
      setLoading(true)
      setSessionReady(true)
      setUser((current) =>
        current?.id === data.user.id ? current : data.user,
      )
    }

    return { error: null }
  }

  /* ── Register ── */
  const register = async (data: RegisterData) => {
    setAuthError(null)
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
        data: {
          full_name: data.fullName,
          institution_id: data.institutionId,
          programme: data.programme,
          avatar_initials: data.fullName
            .split(/\s+/)
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
        },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return {
          error: 'An account with this email already exists.',
          needsEmailConfirmation: false,
        }
      }
      if (error.message.includes('Database error saving new user')) {
        return {
          error:
            'Your student profile could not be created. Please ask the project administrator to apply the latest signup migration, then try again.',
          needsEmailConfirmation: false,
        }
      }
      return { error: error.message, needsEmailConfirmation: false }
    }

    if (signUpData.session) {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      return {
        error: 'Email confirmation is not enabled in Supabase. Enable Confirm email before registering students.',
        needsEmailConfirmation: false,
      }
    }

    return {
      error: null,
      needsEmailConfirmation: !signUpData.session,
    }
  }

  const resendSignupConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
      },
    })
    return { error: error?.message ?? null }
  }

  /* ── Logout ── */
  const logout = async () => {
    setAuthError(null)
    setRecoveryMode(false)
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  /* ── Forgot password ── */
  const resetPasswordRequest = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  /* ── Set new password (recovery session) ── */
  const resetPasswordUpdate = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: error.message }
    setRecoveryMode(false)
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        recoveryMode,
        authError,
        clearAuthError: () => setAuthError(null),
        login,
        register,
        resendSignupConfirmation,
        logout,
        resetPasswordRequest,
        resetPasswordUpdate,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
