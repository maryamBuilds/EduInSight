import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  RefreshCw,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'

function displayStudyStructure(value: string | null | undefined) {
  if (!value) return 'Not provided'
  return value === 'semester' ? 'Semester system' : value === 'year' ? 'Year system' : value
}

export default function StudentProfile() {
  const { profile } = useAuth()
  const [institutionName, setInstitutionName] = useState('')
  const [institutionLoading, setInstitutionLoading] = useState(true)
  const [institutionError, setInstitutionError] = useState(false)
  const institutionId = profile?.institution_id

  const loadInstitution = useCallback(async (id?: string) => {
    if (!id) {
      setInstitutionLoading(false)
      setInstitutionError(true)
      return
    }

    setInstitutionLoading(true)
    const result = await supabase
      .from('institutions')
      .select('name')
      .eq('id', id)
      .maybeSingle()

    const institution = result.data as { name: string } | null
    if (result.error || !institution) {
      setInstitutionName('')
      setInstitutionError(true)
    } else {
      setInstitutionName(institution.name)
      setInstitutionError(false)
    }
    setInstitutionLoading(false)
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void loadInstitution(institutionId), 0)
    return () => window.clearTimeout(request)
  }, [institutionId, loadInstitution])

  if (!profile) return null

  const roleLabel = profile.role === 'student'
    ? 'Student'
    : profile.role === 'teacher'
      ? 'Teacher'
      : 'Administrator'
  const roleDescription = profile.role === 'student'
    ? 'Your verified educational details used across EduInSight.'
    : profile.role === 'teacher'
      ? 'Your verified teaching account used to review authorised course feedback.'
      : 'Your verified administrative account used for institutional feedback oversight.'

  const details = [
    { label: 'Email address', value: profile.email, icon: Mail },
    {
      label: 'Educational institution',
      value: institutionLoading ? 'Loading institution…' : institutionName || 'Unavailable',
      icon: Building2,
    },
    { label: 'Account role', value: roleLabel, icon: UserRound },
    ...(profile.role === 'student' ? [
      { label: 'Degree programme', value: profile.programme || 'Not provided', icon: GraduationCap },
      { label: 'Study structure', value: displayStudyStructure(profile.study_structure), icon: BookOpen },
      { label: 'Current semester or year', value: profile.study_stage || 'Not provided', icon: UserRound },
    ] : []),
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="bg-ocean px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-aqua text-2xl font-bold text-navy">
              {getInitials(profile.full_name)}
            </span>
            <div>
              <p className="text-sm font-semibold text-aqua">{roleLabel} account</p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{profile.full_name}</h2>
              <p className="mt-2 text-sm text-[#D8E6EC]">
                {roleDescription}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-teal/20 bg-soft-teal p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-dark" aria-hidden="true" />
            <div>
              <h3 className="font-bold text-navy">Active {roleLabel.toLowerCase()} profile</h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                These verified details identify your account and determine which EduInSight information you can access.
              </p>
            </div>
          </div>

          {institutionError && (
            <div className="mb-6 flex flex-col justify-between gap-3 rounded-lg border border-[#E7CFA7] bg-[#FFF3DF] p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-[#8A5200]">The institution name could not be loaded.</p>
              <button
                type="button"
                onClick={() => void loadInstitution(institutionId)}
                className="inline-flex items-center justify-center gap-2 font-bold text-[#8A5200] hover:underline"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {details.map(({ label, value, icon: Icon }, index) => (
              <div
                key={label}
                className={`rounded-xl border border-border bg-[#F8FAF9] p-5 ${index === 0 ? 'md:col-span-2' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-soft-blue text-ocean">
                    {institutionLoading && label === 'Educational institution' ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
                    <p className="mt-1 break-words font-semibold text-navy">{value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 border-t border-border pt-5 text-sm leading-6 text-muted">
            Profile identity and institutional details are read-only. Contact your university administrator if an official detail needs correction.
          </p>
        </div>
      </section>
    </div>
  )
}
