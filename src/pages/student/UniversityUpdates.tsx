import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Megaphone, RefreshCw } from 'lucide-react'
import { FilterButtons, SearchInput } from '@/components'
import { useStudentUpdates } from '@/hooks/useStudentUpdates'
import { ACTION_STATUS_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { ActionType } from '@/lib/types'

type UpdateFilter = 'all' | ActionType | 'completed'

const FILTERS: { value: UpdateFilter; label: string }[] = [
  { value: 'all', label: 'All Updates' },
  { value: 'teaching', label: 'Academic' },
  { value: 'institutional', label: 'Institutional' },
  { value: 'completed', label: 'Completed Actions' },
]

export default function UniversityUpdates() {
  const { updates, loading, error, reload, markRead } = useStudentUpdates()
  const [filter, setFilter] = useState<UpdateFilter>('all')
  const [search, setSearch] = useState('')

  const visibleUpdates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return updates.filter((update) => {
      const filterMatch = filter === 'all'
        || (filter === 'completed' ? update.action_status === 'completed' : update.action_type === filter)
      const searchMatch = !term || [update.action_title, update.student_facing_message]
        .some((value) => value.toLocaleLowerCase().includes(term))
      return filterMatch && searchMatch
    })
  }, [filter, search, updates])

  if (loading) return <div className="grid min-h-[55vh] place-items-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-teal" aria-label="Loading university updates" /></div>

  if (error) return (
    <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
      <p className="mb-5 text-muted">{error}</p>
      <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</button>
    </div></div>
  )

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-navy">University Updates</h2>
        <p className="mt-1 text-muted">Approved responses and actions connected to your feedback.</p>
      </header>

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <FilterButtons options={FILTERS} active={filter} onChange={setFilter} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search updates" className="w-full lg:max-w-sm" />
        </div>
      </section>

      {updates.length === 0 ? (
        <section className="rounded-xl border border-border bg-white py-14 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-aqua" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-bold text-navy">No university updates yet</h3>
          <p className="mt-2 text-muted">Approved responses to your feedback will appear here.</p>
        </section>
      ) : visibleUpdates.length === 0 ? (
        <section className="rounded-xl border border-border bg-white py-12 text-center"><h3 className="font-bold text-navy">No matching updates</h3><p className="mt-2 text-sm text-muted">Try another search or filter.</p></section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {visibleUpdates.map((update) => (
            <article key={update.id} className="rounded-xl border border-border bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-soft-teal px-3 py-1.5 text-xs font-bold text-teal-dark">{update.action_type === 'teaching' ? 'Academic' : 'Institutional'}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted"><CheckCircle2 className="h-4 w-4 text-teal" aria-hidden="true" /> {ACTION_STATUS_LABELS[update.action_status]}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy">{update.action_title}</h3>
              <p className="mt-2 leading-7 text-text">{update.student_facing_message}</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <time className="text-sm text-muted" dateTime={update.published_at ?? undefined}>{update.published_at ? formatDate(update.published_at) : 'Date unavailable'}</time>
                <Link to={`/student/feedback/${update.feedback_id}`} onClick={() => markRead(update.id)} className="font-bold text-teal-dark hover:underline">View related feedback →</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
