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
import { requestFeedbackAnalysis, studentAnalysisLabel } from '@/lib/aiAnalysis'
import type { Course, CourseSection, Database, Department, Institution } from '@/lib/types'
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
  id,
  label,
  children,
  hint,
  required,
}: {
  id: string
  label: string
  children: React.ReactNode
  hint?: string
  required?: boolean
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="font-bold text-text">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {hint && <small id={`${id}-hint`} className="text-xs leading-relaxed text-muted">{hint}</small>}
    </div>
  )
}

/** Numbered form section, so the student can see how much is left. */
function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description?: string
  children: React.ReactNode
}) {
  const headingId = `section-${number}-heading`
  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden="true">
          {number}
        </span>
        <div>
          <h3 id={headingId} className="text-lg font-bold text-navy">{title}</h3>
          {description && <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      <div className="grid gap-5 sm:pl-11">{children}</div>
    </section>
  )
}

const SEMESTER_STAGES = Array.from({ length: 10 }, (_, index) => `Semester ${index + 1}`)
const YEAR_STAGES = Array.from({ length: 5 }, (_, index) => `Year ${index + 1}`)

export default function SubmitFeedback() {
  const { profile } = useAuth()
  const [step, setStep] = useState<Step>('write')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [departments, setDepartments] = useState<Department[]>([])
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [sections, setSections] = useState<CourseSection[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const [analysisNote, setAnalysisNote] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)

    const loadCatalog = async () => {
      if (!profile?.institution_id) {
        setError('Your student profile is missing educational institution information.')
        setCatalogLoading(false)
        return
      }

      const [institutionResult, departmentResult, courseResult, sectionResult] = await Promise.all([
        supabase.from('institutions').select('*').eq('id', profile.institution_id).abortSignal(controller.signal).maybeSingle(),
        supabase.from('departments').select('*').eq('institution_id', profile.institution_id).order('name').abortSignal(controller.signal),
        supabase.from('courses').select('*').eq('is_active', true).order('name').abortSignal(controller.signal),
        supabase.from('course_sections').select('*').order('section_name').abortSignal(controller.signal),
      ])

      if (cancelled) return
      window.clearTimeout(timeout)
      const firstError = institutionResult.error || departmentResult.error || courseResult.error || sectionResult.error
      if (firstError) {
        setError(
          controller.signal.aborted
            ? 'The university catalogue took too long to load. Check your connection and refresh the page.'
            : 'The university catalogue could not be loaded. Please refresh and try again.',
        )
      } else {
        setInstitution(institutionResult.data as Institution | null)
        setDepartments((departmentResult.data ?? []) as Department[])
        setCourses((courseResult.data ?? []) as Course[])
        setSections((sectionResult.data ?? []) as CourseSection[])
        const loadedDepartments = (departmentResult.data ?? []) as Department[]
        if (loadedDepartments.length === 0) {
          setError('No departments are configured in Supabase yet. The demonstration catalogue must be added before feedback can be submitted.')
        }
        // Prefill details the student already gave us so the form starts at
        // the feedback itself. Every prefilled value stays editable.
        const knownDepartment = loadedDepartments.find((item) => item.id === profile.department_id)
        const defaultDepartmentId = knownDepartment?.id ?? (loadedDepartments.length === 1 ? loadedDepartments[0].id : '')
        const knownStage = profile.study_structure && profile.study_stage
          && (profile.study_structure === 'semester' ? SEMESTER_STAGES : YEAR_STAGES).includes(profile.study_stage)
        setForm((current) => ({
          ...current,
          departmentId: current.departmentId || defaultDepartmentId,
          studyStructure: current.studyStructure || (knownStage && profile.study_structure ? profile.study_structure : ''),
          studyStage: current.studyStage || (knownStage && profile.study_stage ? profile.study_stage : ''),
        }))
      }
      setCatalogLoading(false)
    }

    void loadCatalog()
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [profile?.institution_id, profile?.department_id, profile?.study_structure, profile?.study_stage])

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
    if (form.originalText.trim().length < 20) {
      return 'Please describe what happened in at least 20 characters.'
    }
    if (form.feedbackTypes.length === 0) return 'Please choose at least one type of feedback.'
    if (!form.departmentId) return 'Please select your department.'
    if (!form.studyStructure || !form.studyStage) return 'Please select your current semester or year.'
    if (!form.universityService) return 'Please choose which university service this is about.'
    if (!form.feedbackArea) return 'Please choose the specific area.'
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

      // Request the secure server-side analysis using the ID returned by
      // submit_feedback.  This never blocks the success screen and never
      // affects the saved submission: analysis failures are retried later.
      setAnalysisNote('Analysing your feedback…')
      void requestFeedbackAnalysis(data[0].id)
        .then((result) => {
          setAnalysisNote(
            result
              ? result.requiresHumanReview
                ? 'Human review required'
                : studentAnalysisLabel(result.status, result.errorCode)
              : 'Analysis pending',
          )
        })
        .catch(() => setAnalysisNote('Analysis pending'))
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
    // Keep the study details prefilled from the profile; clear everything else.
    setForm((current) => ({
      ...EMPTY_FORM,
      departmentId: current.departmentId,
      studyStructure: current.studyStructure,
      studyStage: current.studyStage,
    }))
    setError('')
  }

  const stepNumber = step === 'write' ? 1 : step === 'review' ? 2 : 3

  return (
    <div className="mx-auto max-w-[1120px]">
      <ol tabIndex={0} className="mb-5 flex items-center justify-center gap-3 overflow-x-auto rounded-xl border border-border bg-white px-5 py-4" aria-label="Submission progress">
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
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={review} noValidate className="rounded-[14px] border border-border bg-white p-7 max-sm:p-4" aria-labelledby="feedback-form-heading">
            <h2 id="feedback-form-heading" className="text-[24px] font-bold text-navy">Share your feedback</h2>
            <p className="mb-6 mt-1 leading-relaxed text-muted">
              Submitting as {profile?.programme ?? 'a student'}
              {institution ? ` at ${institution.name}` : ''}. Fields marked <span className="text-danger" aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.
            </p>

            <div className="grid gap-7">
              <FormSection number={1} title="What happened?" description="Write naturally in English, Urdu, Roman Urdu or mixed Urdu–English. Your original words are kept exactly as written.">
                <Field id="feedback-text" label="Your feedback" required hint="Say where it happens, what the difficulty is and, if you can, what would help.">
                  <textarea
                    id="feedback-text"
                    dir="auto"
                    value={form.originalText}
                    onChange={(event) => update('originalText', event.target.value)}
                    maxLength={FEEDBACK_MAX_LENGTH}
                    rows={7}
                    required
                    aria-describedby="feedback-text-hint feedback-text-count"
                    className={`${inputClass} resize-y text-[17px] leading-relaxed`}
                    placeholder="Example: Database ka lecture bohat fast hai, normalization ke examples zyada hon to samajh aa jaye."
                  />
                </Field>
                <span id="feedback-text-count" className="-mt-3 text-right text-xs text-muted">
                  {form.originalText.length}/{FEEDBACK_MAX_LENGTH} characters
                </span>
                <fieldset>
                  <legend className="mb-2 font-bold text-text">
                    What kind of feedback is it?<span className="ml-1 text-danger" aria-hidden="true">*</span>
                    <span className="ml-1 font-normal text-muted">Choose all that apply</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_TYPES.map((item) => {
                      const checked = form.feedbackTypes.includes(item)
                      return (
                        <label key={item} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition focus-within:ring-4 focus-within:ring-teal/25 ${checked ? 'border-teal-dark bg-soft-teal font-bold text-teal-dark' : 'border-[#8A979E] bg-white text-text hover:border-teal-dark'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleType(item)} className="sr-only" />
                          {checked && <Check className="h-4 w-4" aria-hidden="true" />}
                          {item}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </FormSection>

              <FormSection number={2} title="Your studies" description="Filled in from your profile where possible. Change anything that is out of date.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="department" label="Department" required>
                    <select
                      id="department"
                      value={form.departmentId}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, departmentId: event.target.value, courseId: '', courseSectionId: '', customCourseName: '' }))
                        setError('')
                      }}
                      disabled={catalogLoading}
                      required
                      className={inputClass}
                    >
                      <option value="">{catalogLoading ? 'Loading departments…' : 'Select department'}</option>
                      {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field id="study-stage" label="Current semester or year" required>
                    <select
                      id="study-stage"
                      value={form.studyStructure && form.studyStage ? `${form.studyStructure}:${form.studyStage}` : ''}
                      onChange={(event) => {
                        const [structure = '', stage = ''] = event.target.value.split(':')
                        setForm((current) => ({
                          ...current,
                          studyStructure: structure as FormState['studyStructure'],
                          studyStage: stage,
                          courseId: '',
                          courseSectionId: '',
                          customCourseName: '',
                        }))
                        setError('')
                      }}
                      required
                      className={inputClass}
                    >
                      <option value="">Select semester or year</option>
                      <optgroup label="Semester system">
                        {SEMESTER_STAGES.map((stage) => <option key={stage} value={`semester:${stage}`}>{stage}</option>)}
                      </optgroup>
                      <optgroup label="Year system">
                        {YEAR_STAGES.map((stage) => <option key={stage} value={`year:${stage}`}>{stage}</option>)}
                      </optgroup>
                    </select>
                  </Field>
                </div>
              </FormSection>

              <FormSection number={3} title="What is it about?" description="This sends your feedback to the right teacher or office.">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="university-service" label="University service" required>
                    <select
                      id="university-service"
                      value={form.universityService}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        universityService: event.target.value,
                        feedbackArea: '',
                        courseId: '',
                        courseSectionId: '',
                        customCourseName: '',
                      }))}
                      required
                      className={inputClass}
                    >
                      <option value="">Select service</option>
                      {UNIVERSITY_SERVICES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field id="feedback-area" label="Specific area" required>
                    <select
                      id="feedback-area"
                      value={form.feedbackArea}
                      onChange={(event) => update('feedbackArea', event.target.value)}
                      disabled={!form.universityService}
                      required
                      className={inputClass}
                    >
                      <option value="">
                        {form.universityService ? 'Select the specific area' : 'Choose a service first'}
                      </option>
                      {availableFeedbackAreas.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                {courseRelevant && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="course" label="Course" hint="Courses shown match your department and current semester or year.">
                      <select
                        id="course"
                        value={form.courseId}
                        onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value, courseSectionId: '', customCourseName: '' }))}
                        disabled={!form.departmentId || !form.studyStage}
                        aria-describedby="course-hint"
                        className={inputClass}
                      >
                        <option value="">
                          {!form.departmentId || !form.studyStage ? 'Set your department and semester first' : 'No specific course'}
                        </option>
                        {filteredCourses.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} — ` : ''}{item.name}</option>)}
                        <option value="custom">Course not listed</option>
                      </select>
                    </Field>
                    {form.courseId && form.courseId !== 'custom' && (
                      <Field
                        id="course-section"
                        label="Section"
                        hint="Choose your section so the teacher of that section can see and act on your feedback."
                      >
                        <select
                          id="course-section"
                          value={form.courseSectionId}
                          onChange={(event) => update('courseSectionId', event.target.value)}
                          aria-describedby="course-section-hint"
                          className={inputClass}
                        >
                          <option value="">No specific section</option>
                          {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.section_name} · {item.semester}</option>)}
                        </select>
                      </Field>
                    )}
                    {form.courseId === 'custom' && (
                      <Field id="custom-course" label="Course name" required>
                        <input id="custom-course" value={form.customCourseName} onChange={(event) => update('customCourseName', event.target.value)} required className={inputClass} placeholder="Enter the relevant course name" />
                      </Field>
                    )}
                  </div>
                )}
                <Field id="topic" label="Topic or location" hint="For example: Database Normalization, Main Library or Computer Lab 2.">
                  <input id="topic" value={form.topic} onChange={(event) => update('topic', event.target.value)} aria-describedby="topic-hint" className={inputClass} />
                </Field>
              </FormSection>

              <FormSection number={4} title="Who can see your name?">
                <fieldset>
                  <legend className="sr-only">Submission identity</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { anonymous: true, title: 'Submit anonymously', text: 'Your name does not appear in ordinary feedback analytics.' },
                      { anonymous: false, title: 'Submit with my name', text: 'Authorised staff may contact you for clarification.' },
                    ].map((option) => (
                      <label key={option.title} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 focus-within:ring-4 focus-within:ring-teal/25 ${form.isAnonymous === option.anonymous ? 'border-teal-dark bg-soft-teal' : 'border-[#8A979E]'}`}>
                        <input type="radio" name="identity" checked={form.isAnonymous === option.anonymous} onChange={() => update('isAnonymous', option.anonymous)} className="mt-1 accent-teal-dark" />
                        <span><strong className="block text-text">{option.title}</strong><small className="mt-1 block leading-relaxed text-muted">{option.text}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="rounded-r-lg border-l-4 border-teal bg-[#F5F8F7] p-3 text-sm leading-relaxed text-muted">
                  Do not include unnecessary personal information. Sensitive allegations are handled through a restricted institutional process.
                </p>
              </FormSection>
            </div>

            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-border pt-5">
              <button type="button" onClick={reset} className="rounded-lg border border-border bg-white px-5 py-3 font-bold text-ocean hover:bg-gray-50">Clear form</button>
              <button type="submit" disabled={catalogLoading || departments.length === 0} className="rounded-lg bg-teal-dark px-5 py-3 font-bold text-white shadow-md hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50">Review and submit →</button>
            </div>
          </form>

          <aside className="h-fit rounded-[14px] border border-border bg-white p-[22px] lg:sticky lg:top-5" aria-labelledby="tips-heading">
            <h2 id="tips-heading" className="text-xl font-bold text-navy">Writing useful feedback</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text">
              <li>Name the course, service or place.</li>
              <li>Describe the exact difficulty.</li>
              <li>Explain how it affects your learning.</li>
              <li>Suggest what would help, if you can.</li>
            </ul>
            <div className="mt-5 rounded-lg bg-soft-blue p-4 text-sm leading-relaxed text-text">
              <strong className="block text-ocean">Example of clear feedback</strong>
              <p className="mb-0 mt-2 italic">
                “Database Systems mein functional dependencies samajh aa rahi hain, lekin 3NF aur BCNF decomposition ke waqt candidate keys identify karna clear nahi. Ek complete relation ko step-by-step decompose karke explain kiya jaye.”
              </p>
            </div>
            <div className="mt-4 rounded-lg bg-soft-amber p-3 text-xs leading-relaxed text-[#7A4D0F]">
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
            <button type="button" onClick={() => void submit()} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-teal-dark px-5 py-3 font-bold text-white shadow-md hover:bg-ocean disabled:opacity-60">
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
          {analysisNote && (
            <div className="mx-auto mt-3 w-fit rounded-full bg-soft-blue px-4 py-1.5 text-sm font-semibold text-ocean">
              {analysisNote}
            </div>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/student/feedback" className="rounded-lg bg-teal-dark px-5 py-3 font-bold text-white shadow-md hover:bg-ocean">View Status</Link>
            <Link to="/student" className="rounded-lg border border-border bg-white px-5 py-3 font-bold text-ocean hover:bg-gray-50">Return to Dashboard</Link>
          </div>
        </section>
      )}
    </div>
  )
}
