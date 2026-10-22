import { useState, useId, type FormEvent } from 'react'
import { ProgressBar } from './ProgressBar'
import { ACTION_STATUS_LABELS } from '@/lib/constants'
import type { ActionStatus } from '@/lib/types'
import { formatShortDate } from '@/lib/utils'

/** The editable fields of an action, shared by teacher and admin tracking. */
export interface ActionEditValues {
  title: string
  status: ActionStatus
  responsible_department: string
  responsible_person: string
  deadline: string
  internal_note: string
}

export interface TrackedAction {
  id: string
  title: string
  status: string
  responsible_department: string | null
  responsible_person: string | null
  deadline: string | null
  internal_note?: string | null
  updated_at?: string
}

export interface TrackedUpdate {
  id: string
  student_facing_message: string
  is_published: boolean
  published_at: string | null
  created_at: string
}

interface ActionTrackingCardProps {
  action: TrackedAction
  /** Title of the issue cluster this action responds to. */
  linkedIssue?: string | null
  /** Follow-ups already created for this action, any order. */
  updates: TrackedUpdate[]
  /** Statuses this role may move the action between, in workflow order. */
  statusOptions: ActionStatus[]
  /** Show the admin-only department and internal note fields. */
  adminFields?: boolean
  /** Fixed reference time used for the overdue check. */
  now: number
  /** Persist edited values. Resolves to an error message, or null on success. */
  onSave: (values: ActionEditValues) => Promise<string | null>
  /** Publish a student-facing follow-up. Resolves to an error message, or null. */
  onPublish: (message: string) => Promise<string | null>
}

const PROGRESS_BY_STATUS: Record<string, number> = {
  planned: 15,
  assigned: 25,
  in_progress: 60,
  completed: 100,
}

const INPUT_CLASS =
  'w-full rounded-lg border border-[#C9D2D5] bg-white p-2.5 text-sm font-normal text-text outline-none focus:border-teal focus:shadow-[0_0_0_3px_rgba(42,157,143,0.15)]'

function badgeClass(status: string): string {
  if (status === 'completed') return 'bg-soft-teal text-success'
  if (status === 'in_progress') return 'bg-soft-amber text-[#8A5A16]'
  return 'bg-soft-blue text-ocean'
}

function toValues(action: TrackedAction): ActionEditValues {
  return {
    title: action.title,
    status: action.status as ActionStatus,
    responsible_department: action.responsible_department ?? '',
    responsible_person: action.responsible_person ?? '',
    deadline: action.deadline ?? '',
    internal_note: action.internal_note ?? '',
  }
}

/**
 * Tracking card for an existing teacher or institutional action.
 * Lets authorised staff edit the action, move its progress, and publish
 * follow-up messages that reach the students linked to the issue.
 */
export function ActionTrackingCard({
  action,
  linkedIssue,
  updates,
  statusOptions,
  adminFields = false,
  now,
  onSave,
  onPublish,
}: ActionTrackingCardProps) {
  const idPrefix = useId()
  const [mode, setMode] = useState<'view' | 'edit' | 'follow-up'>('view')
  const [values, setValues] = useState<ActionEditValues>(() => toValues(action))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllUpdates, setShowAllUpdates] = useState(false)

  const statusLabel =
    ACTION_STATUS_LABELS[action.status as ActionStatus] ?? action.status
  const overdue =
    !!action.deadline &&
    action.status !== 'completed' &&
    new Date(action.deadline).getTime() < now
  const sortedUpdates = [...updates].sort(
    (a, b) =>
      new Date(b.published_at ?? b.created_at).getTime() -
      new Date(a.published_at ?? a.created_at).getTime(),
  )
  const visibleUpdates = showAllUpdates ? sortedUpdates : sortedUpdates.slice(0, 2)

  async function run(task: () => Promise<string | null>, onDone: () => void) {
    setBusy(true)
    setError(null)
    const err = await task()
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onDone()
  }

  function startEdit() {
    setValues(toValues(action))
    setError(null)
    setMode('edit')
  }

  function handleStatusChange(status: ActionStatus) {
    if (busy || status === action.status) return
    void run(() => onSave({ ...toValues(action), status }), () => undefined)
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) {
      setError('Action title must not be empty.')
      return
    }
    void run(() => onSave(values), () => setMode('view'))
  }

  function handlePublishSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) {
      setError('Write a message before publishing.')
      return
    }
    void run(() => onPublish(trimmed), () => {
      setMessage('')
      setMode('view')
    })
  }

  return (
    <article className="rounded-[9px] border border-border p-4" aria-labelledby={`${idPrefix}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id={`${idPrefix}-title`} className="m-0 text-sm font-bold text-navy">
            {action.title}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {linkedIssue ? `Linked issue: ${linkedIssue}` : 'Linked issue unavailable'}
            {action.responsible_department && ` · ${action.responsible_department}`}
            {action.responsible_person ? ` · Owner: ${action.responsible_person}` : ' · No owner yet'}
            {action.deadline && ` · Due ${formatShortDate(action.deadline)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {overdue && (
            <span className="inline-block rounded-full bg-soft-red px-2 py-1 text-[11px] font-bold text-danger">
              Overdue
            </span>
          )}
          <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${badgeClass(action.status)}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          label="Progress"
          value={PROGRESS_BY_STATUS[action.status] ?? 0}
          valueText={statusLabel}
        />
      </div>

      {/* Quick progress update */}
      <fieldset className="mt-3 flex flex-wrap items-center gap-2 border-0 p-0" disabled={busy}>
        <legend className="mb-1.5 text-xs font-bold text-ocean">Update progress</legend>
        {statusOptions.map((status) => {
          const active = action.status === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => handleStatusChange(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
                active
                  ? 'border-teal-dark bg-teal-dark text-white'
                  : 'border-border bg-white text-ocean hover:bg-ivory'
              }`}
            >
              {ACTION_STATUS_LABELS[status]}
            </button>
          )
        })}
      </fieldset>

      {/* Follow-up history */}
      <div className="mt-3 rounded-lg bg-[#F7FAF9] p-3">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-xs text-ocean">Student follow-ups</strong>
          <span className="text-xs text-muted">
            {updates.filter((u) => u.is_published).length} published
          </span>
        </div>
        {visibleUpdates.length > 0 ? (
          <ul className="mt-2 grid list-none gap-2 p-0">
            {visibleUpdates.map((update) => (
              <li key={update.id} className="border-l-2 border-aqua pl-2.5">
                <p dir="auto" className="m-0 text-[13px] leading-relaxed text-text">
                  {update.student_facing_message}
                </p>
                <span className="text-[11px] text-muted">
                  {update.is_published && update.published_at
                    ? `Published ${formatShortDate(update.published_at)}`
                    : `Draft · ${formatShortDate(update.created_at)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-xs text-muted">
            Students have not received a follow-up for this action yet.
          </p>
        )}
        {sortedUpdates.length > 2 && (
          <button
            type="button"
            className="mt-2 text-xs font-bold text-teal-dark hover:underline"
            onClick={() => setShowAllUpdates((v) => !v)}
          >
            {showAllUpdates ? 'Show fewer' : `Show all ${sortedUpdates.length}`}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-soft-red px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}

      {mode === 'view' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startEdit}
            disabled={busy}
            className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ocean transition-colors hover:bg-ivory disabled:opacity-60"
          >
            Edit action
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode('follow-up')
            }}
            disabled={busy}
            className="rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
          >
            Publish follow-up
          </button>
          {busy && <span className="self-center text-xs text-muted" role="status">Saving…</span>}
        </div>
      )}

      {mode === 'edit' && (
        <form className="mt-3 grid gap-3 rounded-lg border border-border p-3" onSubmit={handleEditSubmit}>
          <strong className="text-sm text-navy">Edit action</strong>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
              Action title
              <input
                type="text"
                required
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold">
              Status
              <select
                value={values.status}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ActionStatus }))}
                className={INPUT_CLASS}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {ACTION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold">
              Deadline
              <input
                type="date"
                value={values.deadline}
                onChange={(e) => setValues((v) => ({ ...v, deadline: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold">
              Responsible person
              <input
                type="text"
                value={values.responsible_person}
                onChange={(e) => setValues((v) => ({ ...v, responsible_person: e.target.value }))}
                className={INPUT_CLASS}
              />
            </label>
            {adminFields && (
              <label className="grid gap-1.5 text-[13px] font-bold">
                Responsible department
                <input
                  type="text"
                  value={values.responsible_department}
                  onChange={(e) => setValues((v) => ({ ...v, responsible_department: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </label>
            )}
            {adminFields && (
              <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
                Internal action note{' '}
                <span className="font-normal text-muted">(staff only, never shown to students)</span>
                <textarea
                  value={values.internal_note}
                  onChange={(e) => setValues((v) => ({ ...v, internal_note: e.target.value }))}
                  className={`${INPUT_CLASS} min-h-[70px] resize-y`}
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null)
                setMode('view')
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ocean hover:bg-ivory disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'follow-up' && (
        <form className="mt-3 grid gap-2.5 rounded-lg border border-border p-3" onSubmit={handlePublishSubmit}>
          <label className="grid gap-1.5 text-[13px] font-bold text-navy">
            Follow-up message for affected students
            <span className="text-xs font-normal text-muted">
              Visible to students whose feedback is linked to this issue. Any language is fine.
            </span>
            <textarea
              dir="auto"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="For example: Extra tutorial sessions start next Monday in Room 4."
              className={`${INPUT_CLASS} min-h-[80px] resize-y`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
            >
              {busy ? 'Publishing…' : 'Publish to students'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null)
                setMode('view')
              }}
              className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ocean hover:bg-ivory disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
