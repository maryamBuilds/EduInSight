import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3, FileText, Loader2, Megaphone, RefreshCw } from 'lucide-react'
import { Panel, StatusBadge } from '@/components'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Feedback, FeedbackStatus, PublishedActionUpdate } from '@/lib/types'

const STATUS_LEVEL: Record<FeedbackStatus, number> = {
  submitted: 0,
  analysed: 1,
  under_review: 2,
  assigned: 2,
  in_progress: 2,
  resolved: 3,
}

const TIMELINE = [
  { title: 'Submitted', description: 'Your original feedback was received securely.' },
  { title: 'Analysed', description: 'The reported issue was organised for review.' },
  { title: 'Under Review', description: 'The relevant authorised team is reviewing the evidence.' },
  { title: 'Action Update', description: 'An approved response or action has been published.' },
]

export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>()
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [updates, setUpdates] = useState<PublishedActionUpdate[]>([])
  const [updatesUnavailable, setUpdatesUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const [feedbackResult, updateResult] = await Promise.all([
      supabase.from('my_feedback').select('*').eq('id', id).maybeSingle(),
      supabase.from('published_action_updates').select('*').eq('feedback_id', id).order('published_at', { ascending: false }),
    ])

    if (feedbackResult.error) {
      setError('This feedback could not be loaded. Please try again.')
    } else if (!feedbackResult.data) {
      setNotFound(true)
    } else {
      setFeedback(feedbackResult.data as Feedback)
      if (updateResult.error) {
        setUpdates([])
        setUpdatesUnavailable(true)
      } else {
        setUpdates((updateResult.data ?? []) as PublishedActionUpdate[])
        setUpdatesUnavailable(false)
      }
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    const request = window.setTimeout(() => void loadDetail(), 0)
    return () => window.clearTimeout(request)
  }, [loadDetail])

  const retry = () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    setUpdatesUnavailable(false)
    void loadDetail()
  }

  const currentLevel = useMemo(() => {
    if (!feedback) return 0
    return Math.max(STATUS_LEVEL[feedback.status], updates.length > 0 ? 3 : 0)
  }, [feedback, updates.length])

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-teal" aria-label="Loading feedback details" /></div>
  }

  if (error) {
    return (
      <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
        <p className="mb-5 text-muted">{error}</p>
        <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</button>
      </div></div>
    )
  }

  if (notFound || !feedback) {
    return (
      <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
        <FileText className="mx-auto h-10 w-10 text-aqua" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-bold text-navy">Feedback not found</h2>
        <p className="mt-2 text-muted">It may not exist, or it does not belong to your account.</p>
        <Link to="/student/feedback" className="mt-5 inline-flex font-bold text-teal-dark hover:underline">Return to My Feedback</Link>
      </div></div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <Link to="/student/feedback" className="inline-flex items-center gap-2 text-sm font-bold text-teal-dark hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to My Feedback</Link>
        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-bold text-navy">Feedback Details</h2>
            <p className="mt-1 font-mono text-sm text-muted">{feedback.reference_number}</p>
          </div>
          <StatusBadge status={feedback.status} />
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-6">
          <Panel title="Original Feedback">
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-text" dir="auto">{feedback.original_text}</p>
            <p className="mt-4 text-xs text-muted">Your original words are preserved exactly as submitted.</p>
          </Panel>

          <Panel title="Submission Information">
            <dl className="grid gap-5 sm:grid-cols-2">
              {[
                ['Submitted', formatDate(feedback.submitted_at)],
                ['University service', feedback.university_service],
                ['Feedback area', feedback.feedback_area],
                ['Programme', feedback.programme],
                ['Study stage', feedback.study_stage],
                ['Course or location', feedback.custom_course_name || 'Not specified'],
                ['Feedback type', feedback.feedback_types.join(', ') || 'Not specified'],
                ['Submission identity', feedback.is_anonymous ? 'Anonymous' : 'Identified'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-1 font-semibold text-navy">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Published Action Updates">
            {updatesUnavailable ? (
              <div className="py-6 text-center">
                <Megaphone className="mx-auto h-9 w-9 text-aqua" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-navy">Updates are temporarily unavailable</h3>
                <p className="mt-1 text-sm text-muted">Your feedback details are safe. Refresh after the database update is applied.</p>
              </div>
            ) : updates.length === 0 ? (
              <div className="py-6 text-center">
                <Megaphone className="mx-auto h-9 w-9 text-aqua" aria-hidden="true" />
                <h3 className="mt-3 font-bold text-navy">No published response yet</h3>
                <p className="mt-1 text-sm text-muted">You will see an approved update here when action is communicated.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <article key={update.id} className="rounded-xl border-l-4 border-teal bg-soft-teal p-5">
                    <h3 className="font-bold text-navy">{update.action_title}</h3>
                    <p className="mt-2 leading-7 text-text">{update.student_facing_message}</p>
                    <time className="mt-3 block text-xs font-semibold text-teal-dark" dateTime={update.published_at ?? undefined}>{update.published_at ? formatDate(update.published_at) : 'Publication date unavailable'}</time>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Status Timeline" className="h-fit">
          <ol className="space-y-0">
            {TIMELINE.map((step, index) => {
              const complete = index <= currentLevel
              const current = index === currentLevel
              return (
                <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < TIMELINE.length - 1 && <span className={`absolute left-[15px] top-8 h-full w-0.5 ${index < currentLevel ? 'bg-teal' : 'bg-border'}`} aria-hidden="true" />}
                  <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${complete ? 'border-teal bg-teal text-white' : 'border-border bg-white text-muted'}`}>
                    {complete && !current ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clock3 className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div>
                    <p className={`font-bold ${complete ? 'text-navy' : 'text-muted'}`}>{step.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted">{step.description}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>
      </section>
    </div>
  )
}
