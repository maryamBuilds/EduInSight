import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  Languages,
  Loader2,
  Megaphone,
  MessageSquarePlus,
  MessageCircleQuestion,
  RefreshCw,
} from 'lucide-react'
import { MetricCard, Panel, StatusBadge } from '@/components'
import { supabase } from '@/lib/supabase'
import type { Feedback, PublishedActionUpdate } from '@/lib/types'

const REVIEW_STATUSES = new Set<Feedback['status']>([
  'analysed',
  'under_review',
  'assigned',
  'in_progress',
])

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function feedbackTitle(feedback: Feedback) {
  return feedback.topic?.trim()
    || feedback.custom_course_name?.trim()
    || feedback.feedback_area
    || 'Feedback submission'
}

function feedbackContext(feedback: Feedback) {
  return feedback.custom_course_name?.trim()
    || feedback.university_service
    || feedback.programme
}

export default function StudentDashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [updates, setUpdates] = useState<PublishedActionUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    const [feedbackResult, updatesResult] = await Promise.all([
      supabase
        .from('my_feedback')
        .select('*')
        .order('submitted_at', { ascending: false }),
      supabase
        .from('published_action_updates')
        .select('*')
        .order('published_at', { ascending: false }),
    ])

    if (feedbackResult.error || updatesResult.error) {
      setError('Your dashboard could not be loaded. Please try again.')
    } else {
      setFeedback((feedbackResult.data ?? []) as Feedback[])
      const uniqueUpdates = new Map<string, PublishedActionUpdate>()
      ;((updatesResult.data ?? []) as PublishedActionUpdate[]).forEach((update) => {
        if (!uniqueUpdates.has(update.id)) uniqueUpdates.set(update.id, update)
      })
      setUpdates([...uniqueUpdates.values()])
    }
    setLoading(false)
  }, [])

  const retryDashboard = () => {
    setLoading(true)
    setError(null)
    void loadDashboard()
  }

  useEffect(() => {
    const request = window.setTimeout(() => void loadDashboard(), 0)
    return () => window.clearTimeout(request)
  }, [loadDashboard])

  const counts = useMemo(() => ({
    total: feedback.length,
    received: feedback.filter((item) => item.status === 'submitted').length,
    review: feedback.filter((item) => REVIEW_STATUSES.has(item.status)).length,
    action: updates.length,
  }), [feedback, updates])

  const latestFeedback = feedback[0] ?? null
  const latestHasUpdate = latestFeedback
    ? updates.some((update) => update.feedback_id === latestFeedback.id)
    : false
  const progressIndex = latestFeedback
    ? ({ submitted: 0, analysed: 1, under_review: 2, assigned: 2, in_progress: 2, resolved: 3 } as const)[latestFeedback.status]
    : -1

  if (loading) {
    return (
      <div className="grid min-h-[55vh] place-items-center" role="status">
        <div className="flex flex-col items-center gap-3 text-muted">
          <Loader2 className="h-8 w-8 animate-spin text-teal" aria-hidden="true" />
          <p>Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
          <p className="mb-5 text-muted">{error}</p>
          <button
            type="button"
            onClick={retryDashboard}
            className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[14px] border border-teal/30 bg-gradient-to-r from-[#EAF7F5] to-[#F4FAF8] px-7 py-6 sm:px-[30px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-2xl font-bold text-navy">Your voice can improve learning</h2>
            <p className="mt-2 max-w-2xl text-muted">
              Share what is working, where you are struggling, or what needs attention.
            </p>
            <Link
              to="/student/submit"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white shadow-[0_7px_16px_rgba(42,157,143,0.2)] transition hover:-translate-y-px hover:bg-teal-dark"
            >
              Submit New Feedback
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex items-center gap-2 border-teal/20 text-sm font-semibold text-ocean lg:border-l lg:py-8 lg:pl-8">
            <Languages className="h-5 w-5 text-teal" aria-hidden="true" />
            English · Urdu · Roman Urdu · Mixed
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Feedback summary">
        <MetricCard icon={<FileText />} label="Total Submitted" value={counts.total} />
        <MetricCard icon={<Inbox />} label="Received" value={counts.received} iconBg="bg-soft-teal" iconColour="text-teal-dark" />
        <MetricCard icon={<Clock3 />} label="Under Review" value={counts.review} iconBg="bg-soft-amber" iconColour="text-warning" />
        <MetricCard icon={<CheckCircle2 />} label="Action Updates" value={counts.action} iconBg="bg-soft-teal" iconColour="text-success" />
      </section>

      <section className="grid gap-[18px] xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]">
        <Panel
          title="My Recent Feedback"
          action={feedback.length > 0 ? (
            <Link to="/student/feedback" className="inline-flex items-center gap-1 text-sm font-bold text-teal-dark hover:underline">
              View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined}
        >
          {feedback.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquarePlus className="mx-auto h-9 w-9 text-aqua" aria-hidden="true" />
              <h4 className="mt-3 font-bold text-navy">No feedback submitted yet</h4>
              <p className="mt-1 text-sm text-muted">Your recent submissions will appear here.</p>
              <Link to="/student/submit" className="mt-4 inline-flex font-bold text-teal-dark hover:underline">
                Submit your first feedback
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {feedback.slice(0, 3).map((item, index) => (
                <Link
                  key={item.id}
                  to={`/student/feedback/${item.id}`}
                  className="grid gap-3 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[38px_minmax(0,1fr)_auto_95px] sm:items-center hover:bg-ivory/50"
                >
                  <span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-[#F0F3F3] font-bold text-navy">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy">{feedbackTitle(item)}</p>
                    <p className="mt-1 truncate text-sm text-muted">
                      {feedbackContext(item)}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  <time className="text-xs text-muted" dateTime={item.submitted_at}>{formatDate(item.submitted_at)}</time>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Feedback Status">
          {!latestFeedback ? (
            <div className="py-8 text-center text-sm text-muted">Submit feedback to begin tracking its progress.</div>
          ) : (
            <ol className="mt-1 space-y-0">
              {[
                ['Submitted', 'Your feedback was submitted successfully.'],
                ['Analysed', 'EduInSight identified the reported issue.'],
                ['Under Review', 'The relevant team is reviewing the evidence.'],
                ['Action Update', 'You will be notified when action is taken.'],
              ].map(([label, description], index) => {
                const complete = index < 3 ? progressIndex > index : latestHasUpdate
                const current = index < 3 ? progressIndex === index : progressIndex >= 3 && !latestHasUpdate
                return (
                  <li key={label} className="relative min-h-[67px] pl-10 last:min-h-0">
                    {index < 3 && <span className="absolute left-[8px] top-5 h-[47px] w-0.5 bg-[#D5DCDE]" aria-hidden="true" />}
                    <span className={`absolute left-0 top-0 grid h-[18px] w-[18px] place-items-center rounded-full border-[3px] ${complete ? 'border-teal bg-teal' : current ? 'border-warning bg-soft-amber' : 'border-[#AEB9BE] bg-white'}`} aria-hidden="true">
                      {complete && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <b className={complete ? 'text-teal-dark' : current ? 'text-warning' : 'text-navy'}>{label}</b>
                    <small className="mt-1 block leading-5 text-muted">{description}</small>
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>

        <Panel
          title="Latest University Updates"
          action={updates.length > 0 ? (
            <Link to="/student/updates" className="inline-flex items-center gap-1 text-sm font-bold text-teal-dark hover:underline">
              View all updates <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined}
        >
          {updates.length === 0 ? (
            <div className="py-7 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-aqua" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted">Published responses to your feedback will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {updates.slice(0, 2).map((update) => (
                <article key={update.id} className="grid grid-cols-[44px_1fr] gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-soft-teal text-teal-dark"><Megaphone className="h-5 w-5" /></span>
                  <div>
                    <p className="font-bold text-navy">{update.action_title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted">{update.student_facing_message}</p>
                    <time className="mt-1 block text-xs text-muted" dateTime={update.published_at ?? undefined}>{formatDate(update.published_at)}</time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Need help expressing your feedback?" className="bg-gradient-to-br from-white to-[#EFF8F6]">
          <div className="flex h-full flex-col justify-between gap-5 sm:flex-row sm:items-center xl:flex-col xl:items-start">
            <div>
              <p className="max-w-md leading-6 text-muted">View examples and practical guidance for writing clear and useful feedback.</p>
              <Link to="/student/submit" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark">
                View Feedback Guide <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <MessageCircleQuestion className="h-14 w-14 text-aqua" aria-hidden="true" />
          </div>
        </Panel>
      </section>
    </div>
  )
}
