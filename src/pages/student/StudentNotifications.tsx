import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStudentUpdates } from '@/hooks/useStudentUpdates'
import { formatRelativeDate } from '@/lib/utils'

export default function StudentNotifications() {
  const { updates, readIds, unreadCount, loading, error, reload, markRead, markAllRead } = useStudentUpdates()

  if (loading) return <div className="grid min-h-[55vh] place-items-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-teal" aria-label="Loading notifications" /></div>

  if (error) return (
    <div className="grid min-h-[55vh] place-items-center"><div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
      <p className="mb-5 text-muted">{error}</p>
      <button type="button" onClick={() => void reload()} className="inline-flex items-center gap-2 rounded-lg bg-teal px-5 py-3 font-bold text-white hover:bg-teal-dark"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again</button>
    </div></div>
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold text-navy">Notifications</h2>
          <p className="mt-1 text-muted">{unreadCount === 0 ? 'You are all caught up.' : `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}.`}</p>
        </div>
        {unreadCount > 0 && <button type="button" onClick={markAllRead} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 font-bold text-teal-dark hover:bg-soft-teal"><CheckCheck className="h-5 w-5" aria-hidden="true" /> Mark all as read</button>}
      </header>

      {updates.length === 0 ? (
        <section className="rounded-xl border border-border bg-white py-14 text-center">
          <Bell className="mx-auto h-10 w-10 text-aqua" aria-hidden="true" />
          <h3 className="mt-4 text-xl font-bold text-navy">No notifications yet</h3>
          <p className="mt-2 text-muted">New approved responses to your feedback will appear here.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="divide-y divide-border">
            {updates.map((update) => {
              const unread = !readIds.has(update.id)
              return (
                <Link key={update.id} to={`/student/feedback/${update.feedback_id}`} onClick={() => markRead(update.id)} className={`flex gap-4 p-5 transition hover:bg-ivory/60 ${unread ? 'bg-soft-teal/50' : 'bg-white'}`}>
                  <span className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full ${unread ? 'bg-teal text-white' : 'bg-soft-blue text-ocean'}`}><Bell className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-bold text-navy">{update.action_title}</h3>
                      {unread && <span className="rounded-full bg-teal px-2.5 py-1 text-xs font-bold text-white">New</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{update.student_facing_message}</p>
                    <time className="mt-2 block text-xs font-semibold text-teal-dark" dateTime={update.published_at ?? undefined}>{update.published_at ? formatRelativeDate(update.published_at) : 'Recently published'}</time>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
