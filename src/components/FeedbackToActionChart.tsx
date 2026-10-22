import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ACTION_STATUS_LABELS } from '@/lib/constants'
import type {
  Action,
  ActionStatus,
  ActionUpdate,
  DetectedLanguage,
  Feedback,
  IssueCluster,
} from '@/lib/types'

interface FeedbackToActionChartProps {
  clusters: IssueCluster[]
  feedbacks: Feedback[]
  actions: Action[]
  updates: ActionUpdate[]
}

type LanguageKey = DetectedLanguage | 'unknown'

/** Fixed language order and colours (validated for colour-vision deficiency). */
const LANGUAGE_SERIES: { key: LanguageKey; label: string; colour: string }[] = [
  { key: 'en', label: 'English', colour: '#1F6A99' },
  { key: 'ur', label: 'Urdu', colour: '#2A9D8F' },
  { key: 'roman_ur', label: 'Roman Urdu', colour: '#B9852F' },
  { key: 'mixed', label: 'Mixed Urdu–English', colour: '#8B6BB8' },
  { key: 'unknown', label: 'Not yet detected', colour: '#B8C2C6' },
]

const MAX_ROWS = 6

interface Row {
  id: string
  title: string
  total: number
  byLanguage: Record<LanguageKey, number>
  actionStatus: ActionStatus | null
}

/**
 * Admin overview chart showing how many individual submissions the
 * analysis has grouped into recurring issues, which languages they were
 * written in, and whether each issue has an owned action yet.
 * Counts come only from real cluster_feedback links.
 */
export function FeedbackToActionChart({
  clusters,
  feedbacks,
  actions,
  updates,
}: FeedbackToActionChartProps) {
  const [links, setLinks] = useState<{ cluster_id: string; feedback_id: string }[] | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<{ row: string; key: LanguageKey } | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('cluster_feedback')
      .select('cluster_id, feedback_id')
      .then(({ data, error }) => {
        if (cancelled) return
        setLinks(error ? [] : ((data ?? []) as { cluster_id: string; feedback_id: string }[]))
      })
    return () => {
      cancelled = true
    }
  }, [clusters])

  const { rows, linkedSubmissions, clustersWithLinks } = useMemo(() => {
    const feedbackById = new Map(feedbacks.map((f) => [f.id, f]))
    const statusByCluster = new Map<string, ActionStatus>()
    // Keep the most advanced action status for each cluster.
    const rank: Record<ActionStatus, number> = { planned: 0, assigned: 1, in_progress: 2, completed: 3 }
    for (const action of actions) {
      const current = statusByCluster.get(action.cluster_id)
      if (!current || rank[action.status] > rank[current]) {
        statusByCluster.set(action.cluster_id, action.status)
      }
    }

    const byCluster = new Map<string, Set<string>>()
    for (const link of links ?? []) {
      if (!byCluster.has(link.cluster_id)) byCluster.set(link.cluster_id, new Set())
      byCluster.get(link.cluster_id)!.add(link.feedback_id)
    }
    const linked = new Set((links ?? []).map((link) => link.feedback_id))

    const allRows: Row[] = clusters
      .filter((c) => byCluster.has(c.id))
      .map((c) => {
        const byLanguage = { en: 0, ur: 0, roman_ur: 0, mixed: 0, unknown: 0 } as Record<LanguageKey, number>
        const ids = byCluster.get(c.id)!
        for (const id of ids) {
          const lang = feedbackById.get(id)?.language_detected ?? 'unknown'
          byLanguage[lang]++
        }
        return {
          id: c.id,
          title: c.title,
          total: ids.size,
          byLanguage,
          actionStatus: statusByCluster.get(c.id) ?? null,
        }
      })
      .sort((a, b) => b.total - a.total)

    return {
      rows: allRows.slice(0, MAX_ROWS),
      linkedSubmissions: linked.size,
      clustersWithLinks: allRows.length,
    }
  }, [clusters, feedbacks, actions, links])

  const clustersWithAction = new Set(actions.map((a) => a.cluster_id)).size
  const publishedFollowUps = updates.filter((u) => u.is_published).length
  const maxTotal = Math.max(...rows.map((r) => r.total), 1)
  const languagesPresent = LANGUAGE_SERIES.filter((s) => rows.some((r) => r.byLanguage[s.key] > 0))

  const pipeline = [
    { label: 'Submissions received', value: feedbacks.length },
    { label: 'Linked to a recurring issue', value: linkedSubmissions },
    { label: 'Recurring issues found', value: clustersWithLinks },
    { label: 'Issues with an owned action', value: clustersWithAction },
    { label: 'Student follow-ups published', value: publishedFollowUps },
  ]

  return (
    <section
      id="admin-feedback-to-action"
      className="mb-5 overflow-hidden rounded-xl border border-border bg-white"
      aria-labelledby="feedback-to-action-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-[18px]">
        <div>
          <h3 id="feedback-to-action-title" className="m-0 text-[19px] text-navy">
            From Individual Feedback to Recurring Issues
          </h3>
          <p className="mt-1 text-xs text-muted">
            Instead of reading every form one by one, AI-assisted analysis groups multilingual
            submissions into shared issues that staff can own and answer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-ocean hover:bg-ivory"
        >
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {/* Pipeline summary */}
      <ol className="m-0 grid list-none grid-cols-2 gap-px bg-border p-0 sm:grid-cols-5">
        {pipeline.map((step, index) => (
          <li key={step.label} className="bg-[#F7FAF9] px-4 py-3 last:col-span-2 sm:last:col-span-1">
            <span className="text-[11px] font-bold uppercase text-muted">Step {index + 1}</span>
            <strong className="block text-2xl text-navy">{step.value}</strong>
            <span className="text-xs text-text">{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="p-5">
        {links === null ? (
          <p className="py-6 text-center text-sm text-muted">Loading linked evidence…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No submissions are linked to a recurring issue yet. Issues appear here once feedback
            has been analysed and grouped.
          </p>
        ) : showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">Linked submissions per recurring issue by language</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-[#E8E2D9] px-2 py-2 text-left text-[11px] uppercase text-muted">Issue</th>
                  {languagesPresent.map((s) => (
                    <th key={s.key} scope="col" className="border-b border-[#E8E2D9] px-2 py-2 text-right text-[11px] uppercase text-muted">{s.label}</th>
                  ))}
                  <th scope="col" className="border-b border-[#E8E2D9] px-2 py-2 text-right text-[11px] uppercase text-muted">Total</th>
                  <th scope="col" className="border-b border-[#E8E2D9] px-2 py-2 text-left text-[11px] uppercase text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="border-b border-[#E8E2D9] px-2 py-2 text-left font-semibold text-ocean">{row.title}</th>
                    {languagesPresent.map((s) => (
                      <td key={s.key} className="border-b border-[#E8E2D9] px-2 py-2 text-right tabular-nums">{row.byLanguage[s.key]}</td>
                    ))}
                    <td className="border-b border-[#E8E2D9] px-2 py-2 text-right font-bold tabular-nums">{row.total}</td>
                    <td className="border-b border-[#E8E2D9] px-2 py-2">
                      {row.actionStatus ? ACTION_STATUS_LABELS[row.actionStatus] : 'No action yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {/* Legend */}
            <ul className="m-0 mb-4 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs text-text" aria-label="Languages">
              {languagesPresent.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.colour }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>

            <ul className="m-0 grid list-none gap-3.5 p-0">
              {rows.map((row) => (
                <li key={row.id} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,14rem)_1fr_7.5rem] sm:items-center sm:gap-3">
                  <span className="truncate text-[13px] font-semibold text-ocean" title={row.title}>
                    {row.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className="motion-grow-x relative flex h-4 gap-[2px]"
                      style={{ width: `${(row.total / maxTotal) * 100}%`, minWidth: '0.5rem' }}
                      role="img"
                      aria-label={`${row.title}: ${row.total} linked submissions, ${LANGUAGE_SERIES.filter((s) => row.byLanguage[s.key] > 0)
                        .map((s) => `${row.byLanguage[s.key]} ${s.label}`)
                        .join(', ')}`}
                    >
                      {LANGUAGE_SERIES.filter((s) => row.byLanguage[s.key] > 0).map((s, index, list) => {
                        const active = hover?.row === row.id && hover.key === s.key
                        return (
                          <span
                            key={s.key}
                            className={`relative h-full ${index === list.length - 1 ? 'rounded-r' : ''}`}
                            style={{
                              flexGrow: row.byLanguage[s.key],
                              flexBasis: 0,
                              background: s.colour,
                              opacity: hover && hover.row === row.id && !active ? 0.55 : 1,
                            }}
                            onMouseEnter={() => setHover({ row: row.id, key: s.key })}
                            onMouseLeave={() => setHover(null)}
                          >
                            {active && (
                              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white shadow">
                                {s.label}: {row.byLanguage[s.key]}
                              </span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                    <span className="text-xs font-bold tabular-nums text-text">{row.total}</span>
                  </div>
                  <span
                    className={`justify-self-start rounded-full px-2 py-1 text-[11px] font-bold sm:justify-self-end ${
                      row.actionStatus === 'completed'
                        ? 'bg-soft-teal text-success'
                        : row.actionStatus
                          ? 'bg-soft-blue text-ocean'
                          : 'bg-soft-red text-danger'
                    }`}
                  >
                    {row.actionStatus ? ACTION_STATUS_LABELS[row.actionStatus] : 'No action yet'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              Bars count submissions actually linked to each issue. Showing the{' '}
              {rows.length === clustersWithLinks ? rows.length : `top ${rows.length} of ${clustersWithLinks}`}{' '}
              issues. AI grouping is a suggestion for staff to review.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
