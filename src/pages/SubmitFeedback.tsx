import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  CheckCircle,
  Loader2,
  Send,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Course, CourseSection, Database, Department } from '@/lib/types'
import {
  FEEDBACK_AREAS_BY_SERVICE,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_TYPES,
  UNIVERSITY_SERVICES,
} from '@/lib/constants'

type Step = 'write' | 'review' | 'submitted'
type SubmitFeedbackArgs = Database['public']['Functions']['submit_feedback']['Args']
type SubmitFeedbackResult = Database['public']['Functions']['submit_feedback']['Returns']

interface FormState {
  departmentId: string
  studyStructure: '' | 'semester' | 'year'
  studyStage: string
  universityService: string
  courseId: string
  courseSectionId: string
  customCourseName: string
  feedbackArea: string
  topic: string
  feedbackTypes: string[]
  originalText: string
  isAnonymous: boolean
}

const EMPTY_FORM: FormState = {
  departmentId: '',
  studyStructure: '',
  studyStage: '',
  universityService: '',
  courseId: '',
  courseSectionId: '',
  customCourseName: '',
  feedbackArea: '',
  topic: '',
  feedbackTypes: [],
  originalText: '',
  isAnonymous: true,
}

const inputClass =
  'w-full rounded-[9px] border border-[#C9D2D5] bg-[#FCFCFA] px-3.5 py-3 text-text outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/10 disabled:cursor-not-allowed disabled:bg-gray-100'

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <div className="grid gap-2">
      <span className="font-bold text-text">
        {label}{required && <span className="ml-1 text-danger">*</span>}
      </span>
      {children}
      {hint && <small className="text-xs leading-relaxed text-muted">{hint}</small>}
    </div>
  )
}

export default function SubmitFeedback() {
  const { profile } = useAuth()
  const [step, setStep] = useState<Step>('write')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [departments, setDepartments] = useState<Department[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [sections, setSections] = useState<CourseSection[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    const loadCatalog = async () => {
      const [departmentResult, courseResult, sectionResult] = await Promise.all([
        supabase.from('departments').select('*').order('name').abortSignal(controller.signal),
        supabase.from('courses').select('*').eq('is_active', true).order('name').abortSignal(controller.signal),
        supabase.from('course_sections').select('*').order('section_name').abortSignal(controller.signal),
      ])

      if (cancelled) return
      window.clearTimeout(timeout)
      const firstError = departmentResult.error || courseResult.error || sectionResult.error
      if (firstError) {
        setError(
          controller.signal.aborted
            ? 'The university catalogue took too long to load. Check your connection and refresh the page.'
            : 'The university catalogue could not be loaded. Please refresh and try again.',
        )
      } else {
        setDepartments((departmentResult.data ?? []) as Department[])
        setCourses((courseResult.data ?? []) as Course[])
        setSections((sectionResult.data ?? []) as CourseSection[])
        if ((departmentResult.data ?? []).length === 0) {
          setError('No departments are configured in Supabase yet. The demonstration catalogue must be added before feedback can be submitted.')
        }
      }
      setCatalogLoading(false)
    }

    void loadCatalog()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const filteredCourses = useMemo(
    () => courses.filter(
      (course) => course.department_id === form.departmentId
        && (!course.typical_stage || course.typical_stage === form.studyStage),
    ),
    [courses, form.departmentId, form.studyStage],
  )
  const filteredSections = useMemo(
    () => sections.filter((section) => section.course_id === form.courseId),
    [sections, form.courseId],
  )

  const selectedDepartment = departments.find((item) => item.id === form.departmentId)
  const selectedCourse = courses.find((item) => item.id === form.courseId)
  const selectedSection = sections.find((item) => item.id === form.courseSectionId)
  const availableStages = form.studyStructure === 'semester'
    ? Array.from({ length: 10 }, (_, index) => `Semester ${index + 1}`)
    : form.studyStructure === 'year'
      ? Array.from({ length: 5 }, (_, index) => `Year ${index + 1}`)
      : []
  const availableFeedbackAreas = form.universityService
    ? FEEDBACK_AREAS_BY_SERVICE[
      form.universityService as keyof typeof FEEDBACK_AREAS_BY_SERVICE
    ] ?? []
    : []
  const courseRelevant = form.universityService === 'Courses and Teaching'
    || form.universityService === 'Assessments and Examinations'

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const toggleType = (value: string) => {
    update(
      'feedbackTypes',
      form.feedbackTypes.includes(value)
        ? form.feedbackTypes.filter((item) => item !== value)
        : [...form.feedbackTypes, value],
    )
  }

  const validate = () => {
    if (!profile?.programme) return 'Your student profile is missing programme information.'
    if (!form.departmentId) return 'Please select a department.'
    if (!form.studyStructure) return 'Please select your study structure.'
    if (!form.studyStage) return 'Please select your current semester or year.'
    if (!form.universityService) return 'Please select a university service.'
    if (!form.feedbackArea) return 'Please select a specific feedback area.'
    if (form.feedbackTypes.length === 0) return 'Please select at least one feedback type.'
    if (form.originalText.trim().length < 20) {
      return 'Please describe the issue in at least 20 characters.'
    }
    if (form.courseId === 'custom' && !form.customCourseName.trim()) {
      return 'Please enter the relevant course name.'
    }
    return ''
  }

  const review = (event: FormEvent) => {
    event.preventDefault()
    const message = validate()
    if (message) {
      setError(message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError('')
    setStep('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async () => {
    if (submitting || !profile?.programme || !form.studyStructure || !form.studyStage) return
    setSubmitting(true)
    setError('')

    const args: SubmitFeedbackArgs = {
      p_department_id: form.departmentId,
      p_programme: profile.programme,
      p_study_structure: form.studyStructure,
      p_study_stage: form.studyStage,
      p_university_service: form.universityService,
      p_course_id: form.courseId && form.courseId !== 'custom' ? form.courseId : null,
      p_course_section_id: form.courseSectionId || null,
      p_custom_course_name:
        form.courseId === 'custom' ? form.customCourseName.trim() : null,
      p_feedback_area: form.feedbackArea,
      p_feedback_types: form.feedbackTypes,
      p_topic: form.topic.trim() || null,
      p_original_text: form.originalText.trim(),
      p_is_anonymous: form.isAnonymous,
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)

    // The project currently uses a handwritten Database interface rather than
    // generated Supabase types. Keep the RPC bound to its client while giving
    // this single function an explicit result type.
    const submitFeedbackRpc = supabase.rpc.bind(supabase) as unknown as (
      name: 'submit_feedback',
      rpcArgs: SubmitFeedbackArgs,
    ) => {
      abortSignal: (signal: AbortSignal) => Promise<{
        data: SubmitFeedbackResult | null
        error: { message: string } | null
      }>
    }

    try {
      const { data, error: submitError } = await submitFeedbackRpc(
        'submit_feedback',
        args,
      ).abortSignal(controller.signal)

      if (submitError) {
        setError(submitError.message)
        return
      }

      if (!data?.[0]) {
        setError('Supabase accepted the request but returned no feedback reference. Please contact the project administrator.')
        return
      }

      setReference(data[0].reference_number)
      setStep('submitted')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caughtError) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : ''
      setError(
        controller.signal.aborted
          ? 'Submission timed out. Check your connection, then try again.'
          : errorMessage || 'Feedback could not be submitted. Please try again.',
      )
    } finally {
      window.clearTimeout(timeout)
      setSubmitting(false)
    }
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setError('')
  }

  const stepNumber = step === 'write' ? 1 : step === 'review' ? 2 : 3

  return (
    <div className="mx-auto max-w-[1120px]">
      <ol className="mb-5 flex items-center justify-center gap-3 overflow-x-auto rounded-xl border border-border bg-white px-5 py-4" aria-label="Submission progress">
        {['Write Feedback', 'Review', 'Submitted'].map((label, index) => (
          <li key={label} className="flex shrink-0 items-center gap-3">
            {index > 0 && <span className="h-0.5 w-8 bg-border sm:w-14" aria-hidden="true" />}
            <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold ${stepNumber >= index + 1 ? 'border-teal bg-teal text-white' : 'border-gray-300 text-muted'}`}>
              {stepNumber > index + 1 ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className={stepNumber === index + 1 ? 'font-bold text-teal-dark' : 'font-semibold text-muted'}>{label}</span>
          </li>
        ))}
      </ol>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-soft-red bg-soft-red/40 p-3 text-sm text-danger" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {step === 'write' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <form onSubmit={review} className="rounded-[14px] border border-border bg-white p-7 max-sm:p-4">
            <h2 className="text-[23px] font-bold text-navy">Tell us about your experience</h2>
            <p className="mb-6 mt-2 leading-relaxed text-muted">
              Provide enough context to help the responsible person understand what the problem is and where it occurs.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="University">
                <input value="Demo University" readOnly className={`${inputClass} bg-[#EEF3F2] text-muted`} />
              </Field>
              <Field label="Department" required>
                <select
                  value={form.departmentId}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, departmentId: event.target.value, courseId: '', courseSectionId: '', customCourseName: '' }))
                    setError('')
                  }}
                  disabled={catalogLoading}
                  className={inputClass}
                >
                  <option value="">{catalogLoading ? 'Loading departments…' : 'Select department'}</option>
                  {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Degree programme">
                <input value={profile?.programme ?? ''} readOnly className={`${inputClass} bg-[#EEF3F2] text-muted`} />
              </Field>
              <Field label="Study structure" required>
                <select
                  value={form.studyStructure}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    studyStructure: event.target.value as FormState['studyStructure'],
                    studyStage: '',
                    courseId: '',
                    courseSectionId: '',
                    customCourseName: '',
                  }))}
                  className={inputClass}
                >
                  <option value="">Select semester or year system</option>
                  <option value="semester">Semester system</option>
                  <option value="year">Year system</option>
                </select>
              </Field>
              <Field label="Current semester/year" required>
                <select
                  value={form.studyStage}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    studyStage: event.target.value,
                    courseId: '',
                    courseSectionId: '',
                    customCourseName: '',
                  }))}
                  disabled={!form.studyStructure}
                  className={inputClass}
                >
                  <option value="">
                    {form.studyStructure ? 'Select current stage' : 'Select study structure first'}
                  </option>
                  {availableStages.map((stage) => <option key={stage}>{stage}</option>)}
                </select>
              </Field>
              <Field label="University service" required>
                <select
                  value={form.universityService}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    universityService: event.target.value,
                    feedbackArea: '',
                    courseId: '',
                    courseSectionId: '',
                    customCourseName: '',
                  }))}
                  className={inputClass}
                >
                  <option value="">Select service</option>
                  {UNIVERSITY_SERVICES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
              <Field label="Specific feedback area" required>
                <select
                  value={form.feedbackArea}
                  onChange={(event) => update('feedbackArea', event.target.value)}
                  disabled={!form.universityService}
                  className={inputClass}
                >
                  <option value="">
                    {form.universityService ? 'Select the specific concern' : 'Select university service first'}
                  </option>
                  {availableFeedbackAreas.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              </div>
              {courseRelevant && (
              <div className="sm:col-span-2">
              <Field label="Relevant course, if applicable" hint="Choose a configured course or enter a course that is not listed.">
                <select
                  value={form.courseId}
                  onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value, courseSectionId: '', customCourseName: '' }))}
                  disabled={!form.departmentId || !form.studyStage}
                  className={inputClass}
                >
                  <option value="">No specific course</option>
                  {filteredCourses.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ''}{item.name}</option>)}
                  <option value="custom">Course not listed</option>
                </select>
              </Field>
              </div>
              )}
              {courseRelevant && form.courseId && form.courseId !== 'custom' && (
              <Field
                label="Section, if applicable"
                hint="Your class group, such as Section A, Section B, Morning or Evening."
              >
                <select value={form.courseSectionId} onChange={(event) => update('courseSectionId', event.target.value)} disabled={!form.courseId || form.courseId === 'custom'} className={inputClass}>
                  <option value="">No specific section</option>
                  {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.section_name} · {item.semester}</option>)}
                </select>
              </Field>
              )}
              {form.courseId === 'custom' && (
                <div className="sm:col-span-2">
                  <Field label="Course name" required>
                    <input value={form.customCourseName} onChange={(event) => update('customCourseName', event.target.value)} className={inputClass} placeholder="Enter the relevant course name" />
                  </Field>
                </div>
              )}
              <div className="sm:col-span-2">
                <Field label="Course name, topic or location, if required">
                  <input value={form.topic} onChange={(event) => update('topic', event.target.value)} className={inputClass} placeholder="Example: Database Systems — Database Normalization, Main Library or Computer Lab 2" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="What type of feedback are you sharing?" required>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_TYPES.map((item) => (
                      <label key={item} className={`cursor-pointer rounded-full border px-3 py-2 text-sm transition ${form.feedbackTypes.includes(item) ? 'border-teal bg-soft-teal font-bold text-teal-dark' : 'border-[#C9D2D5] bg-white text-text'}`}>
                        <input type="checkbox" checked={form.feedbackTypes.includes(item)} onChange={() => toggleType(item)} className="sr-only" />
                        {item}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Describe your feedback" required>
                  <div className="rounded-lg bg-soft-teal px-3 py-2.5 text-sm leading-relaxed text-ocean">
                    You may write naturally in English, Urdu, Roman Urdu or mixed Urdu–English. Your original words will be preserved.
                  </div>
                  <textarea
                    dir="auto"
                    value={form.originalText}
                    onChange={(event) => update('originalText', event.target.value)}
                    maxLength={FEEDBACK_MAX_LENGTH}
                    rows={7}
                    className={`${inputClass} resize-y leading-relaxed`}
                    placeholder="Describe the exact academic or university problem you are experiencing…"
                  />
                  <span className="text-right text-xs text-muted">{form.originalText.length}/{FEEDBACK_MAX_LENGTH} characters</span>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Submission identity">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { anonymous: true, title: 'Submit anonymously', text: 'Your identity will not appear in ordinary feedback analytics.' },
                      { anonymous: false, title: 'Submit with my identity', text: 'Authorised staff may contact you for clarification.' },
                    ].map((option) => (
                      <label key={option.title} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${form.isAnonymous === option.anonymous ? 'border-teal bg-soft-teal' : 'border-[#C9D2D5]'}`}>
                        <input type="radio" name="identity" checked={form.isAnonymous === option.anonymous} onChange={() => update('isAnonymous', option.anonymous)} className="mt-1 accent-teal" />
                        <span><strong className="block text-text">{option.title}</strong><small className="mt-1 block leading-relaxed text-muted">{option.text}</small></span>
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2 rounded-r-lg border-l-4 border-teal bg-[#F5F8F7] p-3 text-sm leading-relaxed text-muted">
                Do not include unnecessary personal information. Sensitive allegations are handled through a restricted institutional process.
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3 border-t border-border pt-5">
              <button type="button" onClick={reset} className="rounded-lg border border-border bg-white px-5 py-3 font-bold text-ocean hover:bg-gray-50">Clear Form</button>
              <button type="submit" disabled={catalogLoading || departments.length === 0} className="rounded-lg bg-teal px-5 py-3 font-bold text-white shadow-md hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50">Review and Submit →</button>
            </div>
          </form>

          <aside className="h-fit rounded-[14px] border border-border bg-white p-[22px] lg:sticky lg:top-5">
            <h2 className="text-xl font-bold text-navy">Writing useful feedback</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">Helpful feedback identifies the exact issue and explains how it affects learning or the student experience.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text">
              <li>Identify the relevant course, service or location.</li>
              <li>Describe the exact difficulty or experience.</li>
              <li>Explain where understanding or access breaks down.</li>
              <li>Include a constructive suggestion where possible.</li>
            </ul>
            <div className="mt-5 rounded-lg bg-soft-blue p-4 text-sm leading-relaxed text-text">
              <strong className="block text-ocean">Strong academic example</strong>
              <p className="mb-0 mt-2 italic">
                “Database Systems mein functional dependencies samajh aa rahi hain, lekin 3NF aur BCNF decomposition ke waqt candidate keys identify karna clear nahi. Ek complete relation ko step-by-step decompose karke explain kiya jaye.”
              </p>
            </div>
            <div className="mt-4 rounded-lg bg-soft-amber p-3 text-xs leading-relaxed text-[#8A5A16]">
              The demonstration catalogue is intentionally limited. Actual course options vary by university and programme.
            </div>
          </aside>
        </div>
      )}

      {step === 'review' && (
        <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-navy">Review your feedback</h2>
          <p className="mt-1 text-muted">Confirm the details before submitting. Your original words will be preserved.</p>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            {[
              ['Department', selectedDepartment?.name],
              ['Programme', profile?.programme],
              ['Study structure', form.studyStructure === 'semester' ? 'Semester system' : 'Year system'],
              ['Study stage', form.studyStage],
              ['University service', form.universityService],
              ['Course', selectedCourse?.name || form.customCourseName || 'Not specified'],
              ['Section', selectedSection ? `${selectedSection.section_name} · ${selectedSection.semester}` : 'Not specified'],
              ['Feedback area', form.feedbackArea],
              ['Feedback type', form.feedbackTypes.join(', ')],
              ['Identity', form.isAnonymous ? 'Anonymous' : 'Identified'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#F7F8F6] p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-1 font-semibold text-text">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-lg border-l-4 border-teal bg-soft-teal/50 p-5">
            <h3 className="font-bold text-navy">Original feedback</h3>
            <p dir="auto" className="mt-2 whitespace-pre-wrap leading-relaxed text-text">{form.originalText}</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
            <button type="button" onClick={() => setStep('write')} className="rounded-lg border border-border bg-white px-5 py-3 font-bold text-ocean hover:bg-gray-50">Edit Feedback</button>
            <button type="button" onClick={() => void submit()} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white shadow-md hover:bg-teal-dark disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        </section>
      )}

      {step === 'submitted' && (
        <section className="rounded-xl border border-border bg-white px-6 py-14 text-center shadow-sm">
          <CheckCircle className="mx-auto h-16 w-16 text-success" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-bold text-navy">Feedback submitted successfully</h2>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted">Your feedback has been received and will be analysed before being routed to the appropriate authorised user.</p>
          <div className="mx-auto mt-6 w-fit rounded-full bg-soft-teal px-5 py-2 font-mono font-bold text-teal-dark">Reference: {reference}</div>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/student/feedback" className="rounded-lg bg-teal px-5 py-3 font-bold text-white shadow-md hover:bg-teal-dark">View Status</Link>
            <Link to="/student" className="rounded-lg border border-border bg-white px-5 py-3 font-bold text-ocean hover:bg-gray-50">Return to Dashboard</Link>
          </div>
        </section>
      )}
    </div>
  )
}
