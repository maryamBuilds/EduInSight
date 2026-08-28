import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Loader2, MessageSquarePlus, RefreshCw } from 'lucide-react'
import { FilterButtons, SearchInput, StatusBadge } from '@/components'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Feedback, PublishedActionUpdate } from '@/lib/types'

type HistoryFilter = 'all' | 'submitted' | 'review' | 'resolved'

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'review', label: 'Under Review' },
  { value: 'resolved', label: 'Resolved' },
]

const REVIEW_STATUSES = new Set<Feedback['status']>([
  'analysed', 'under_review', 'assigned', 'in_progress',
])

function matchesFilter(item: Feedback, filter: HistoryFilter) {
  if (filter === 'all') return true
  if (filter === 'review') return REVIEW_STATUSES.has(item.status)
  return item.status === filter
}

function itemTitle(item: Feedback) {
  return item.topic?.trim() || item.custom_course_name?.trim() || item.feedback_area
}

export default function MyFeedback() {
  const [items, setItems] = useState<Feedback[]>([])
  const [updates, setUpdates] = useState<PublishedActionUpdate[]>([])
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    const [feedbackResult, updateResult] = await Promise.all([
      supabase.from('my_feedback').select('*').order('submitted_at', { ascending: false }),
      supabase.from('published_action_updates').select('*'),
    ])

    if (feedbackResult.error || updateResult.error) {
      setError('Your feedback history could not be loaded. Please try again.')
    } else {
      setItems((feedbackResult.data ?? []) as Feedback[])
      setUpdates((updateResult.data ?? []) as PublishedActionUpdate[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void loadHistory(), 0)
    return () => window.clearTimeout(request)
  }, [loadHistory])

  const retry = () => {
    setLoading(true)
    setError(null)
    void loadHistory()
  }

  const updateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    updates.forEach((update) => counts.set(update.feedback_id, (counts.get(update.feedback_id) ?? 0) + 1))
    return counts
  }, [updates])

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return items.filter((item) => {
      if (!matchesFilter(item, filter)) return false
      if (!term) return true
      return [
        item.reference_number,
        item.feedback_area,
        item.university_service,
        item.topic,
        item.custom_course_name,
        item.original_text,
      ].some((value) => value?.toLocaleLowerCase().includes(term))
    })
  }, [filter, items, search])

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-teal" aria-label="Loading feedback history" /></div>
  }

  if (error) {
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
          <p className="mb-5 text-muted">{error}</p>
          <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold text-navy">My Feedback</h2>
          <p className="mt-1 text-muted">Track your submissions and view approved responses.</p>
        </div>
        <Link to="/student/submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark">
          <MessageSquarePlus className="h-5 w-5" aria-hidden="true" /> Submit Feedback
        </Link>
      </header>

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <FilterButtons options={FILTERS} active={filter} onChange={setFilter} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search reference, service or topic" className="w-full lg:max-w-sm" />
        </div>
      </section>

      {items.length === 0 ? (
        <section className="rounded-xl border border-border bg-white py-14 text-center">
          <FileText className="mx-auto h-10 w-10 text-aqua" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-bold text-navy">No feedback submitted yet</h3>
          <p className="mt-2 text-muted">Your submissions will appear here once you share feedback.</p>
          <Link to="/student/submit" className="mt-5 inline-flex font-bold text-teal-dark hover:underline">Submit your first feedback</Link>
        </section>
      ) : visibleItems.length === 0 ? (
        <section className="rounded-xl border border-border bg-white py-12 text-center">
          <h3 className="font-bold text-navy">No matching feedback</h3>
          <p className="mt-2 text-sm text-muted">Try another search or status filter.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {visibleItems.map((item) => (
              <Link key={item.id} to={`/student/feedback/${item.id}`} className="grid gap-4 p-5 transition hover:bg-ivory/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-navy">{itemTitle(item)}</h3>
                    {Boolean(updateCounts.get(item.id)) && <span className="rounded-full bg-soft-teal px-2.5 py-1 text-xs font-bold text-teal-dark">New response</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{item.reference_number} · {item.university_service}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-text">{item.original_text}</p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <StatusBadge status={item.status} />
                  <time className="text-xs text-muted" dateTime={item.submitted_at}>{formatDate(item.submitted_at)}</time>
                  <ArrowRight className="hidden h-4 w-4 text-teal-dark sm:block" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
