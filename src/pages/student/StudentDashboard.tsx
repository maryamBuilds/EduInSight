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
    <div className="space-y-6">
      <section className="rounded-2xl bg-ocean p-7 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h2 className="text-2xl font-bold sm:text-[28px]">Your voice can improve learning</h2>
            <p className="mt-2 max-w-2xl text-white/80">
              Share what is working, where you are struggling, or what needs attention.
            </p>
            <Link
              to="/student/submit"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white shadow-lg shadow-black/10 transition hover:-translate-y-px hover:bg-teal-dark"
            >
              <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
              Submit New Feedback
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/75">
            <Languages className="h-5 w-5 text-aqua" aria-hidden="true" />
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
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
              {feedback.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  to={`/student/feedback/${item.id}`}
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center hover:bg-ivory/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy">{feedbackTitle(item)}</p>
                    <p className="mt-1 truncate text-sm text-muted">
                      {item.reference_number} · {feedbackContext(item)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <StatusBadge status={item.status} />
                    <time className="text-xs text-muted" dateTime={item.submitted_at}>{formatDate(item.submitted_at)}</time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Latest University Updates"
          action={updates.length > 0 ? (
            <Link to="/student/updates" className="inline-flex items-center gap-1 text-sm font-bold text-teal-dark hover:underline">
              View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined}
        >
          {updates.length === 0 ? (
            <div className="py-8 text-center">
              <Megaphone className="mx-auto h-9 w-9 text-aqua" aria-hidden="true" />
              <h4 className="mt-3 font-bold text-navy">No updates yet</h4>
              <p className="mt-1 text-sm text-muted">Published responses to your feedback will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {updates.slice(0, 3).map((update) => (
                <article key={update.id} className="rounded-xl bg-soft-blue p-4">
                  <p className="font-bold text-navy">{update.action_title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{update.student_facing_message}</p>
                  <time className="mt-3 block text-xs font-semibold text-teal-dark" dateTime={update.published_at ?? undefined}>
                    {formatDate(update.published_at)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  )
}
