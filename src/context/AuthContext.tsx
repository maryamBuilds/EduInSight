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
  programme: string
  studyStructure: 'semester' | 'year'
  studyStage: string
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
      }
      setSessionReady(true)
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
          setUser(session.user)
          setLoading(true)
        }

        setSessionReady(true)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /* ── Load the profile outside the auth callback to avoid client lock races ── */
  useEffect(() => {
    let cancelled = false

    if (!sessionReady) return
    if (!user) return

    const loadProfile = async () => {
      // A new-user trigger may need a moment to create the profile row.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (cancelled) return

        if (!error && data) {
          const nextProfile = data as Profile
          if (!nextProfile.is_active) {
            setAuthError(
              'Your account is inactive. Please contact your university administrator.',
            )
            await supabase.auth.signOut()
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
        await supabase.auth.signOut()
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [sessionReady, user])

  /* ── Login ── */
  const login = async (email: string, password: string) => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({
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

    // onAuthStateChange → SIGNED_IN will fetch the profile
    return { error: null }
  }

  /* ── Register ── */
  const register = async (data: RegisterData) => {
    setAuthError(null)
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          programme: data.programme,
          study_structure: data.studyStructure,
          study_stage: data.studyStage,
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
      return { error: error.message, needsEmailConfirmation: false }
    }

    if (signUpData.session?.user) {
      setUser(signUpData.session.user)
    }

    return {
      error: null,
      needsEmailConfirmation: !signUpData.session,
    }
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
