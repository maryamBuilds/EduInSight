import { useState, useCallback, useRef, useEffect, useMemo, type FormEvent } from 'react'
import {
  FileText,
  AlertTriangle,
  Flag,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type { TeacherClusterRow, TeacherFeedbackRow, TeacherActionRow } from '@/lib/types'
import {
  PRIORITY_LABELS,
  TREND_LABELS,
  TREND_ARROWS,
  TREND_COLOURS,
  ACTION_STATUS_LABELS,
} from '@/lib/constants'
import {
  MetricCard,
  Panel,
  PriorityBadge,
  FilterButtons,
  ProgressBar,
  EvidenceQuote,
  PriorityReasons,
  OverlayDialog,
  Toast,
} from '@/components'
import { supabase } from '@/lib/supabase'
import { callRpc, callRpcNoArgs, friendlyError } from '@/lib/rpc'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Filter constants
// ---------------------------------------------------------------------------

type TeacherFilter = 'all' | 'high' | 'medium'
export type TeacherDashboardView = 'overview' | 'insights' | 'feedback' | 'actions'

const VIEW_COPY: Record<TeacherDashboardView, { title: string; description: string }> = {
  overview: {
    title: 'Teaching Overview',
    description: 'A summary of feedback, learning concerns, and action progress.',
  },
  insights: {
    title: 'Learning Insights',
    description: 'Explore recurring learning bottlenecks, priorities, and recent trends.',
  },
  feedback: {
    title: 'Student Feedback',
    description: 'Review anonymised feedback from the course sections assigned to you.',
  },
  actions: {
    title: 'Teaching Actions',
    description: 'Track the improvements created in response to student feedback.',
  },
}

const FILTER_OPTIONS: { value: TeacherFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
]

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ---------------------------------------------------------------------------
// Teacher Dashboard
// ---------------------------------------------------------------------------

export default function TeacherDashboard({
  view = 'overview',
}: {
  view?: TeacherDashboardView
}) {
  const { loading: authLoading, profile } = useAuth()

  // ── Data state ──────────────────────────────────────────────────────────
  const [clusters, setClusters] = useState<TeacherClusterRow[]>([])
  const [feedbacks, setFeedbacks] = useState<TeacherFeedbackRow[]>([])
  const [actions, setActions] = useState<TeacherActionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── UI state ────────────────────────────────────────────────────────────
  const [priorityFilter, setPriorityFilter] = useState<TeacherFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedCluster, setSelectedCluster] = useState<TeacherClusterRow | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [actionFormOpen, setActionFormOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formStatus, setFormStatus] = useState('Planned')
  const [formUpdate, setFormUpdate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const actionPanelRef = useRef<HTMLElement>(null)

  // ── Fetch data from Supabase (after auth ready + teacher role) ─────
  useEffect(() => {
    let cancelled = false

    if (authLoading) return
    if (!profile || profile.role !== 'teacher') return

    async function load() {
      setLoading(true)
      setError(null)

      const [clustersRes, feedbackRes, actionsRes] = await Promise.all([
        supabase
          .from('clusters_for_teacher')
          .select('*')
          .order('priority_score', { ascending: false }),
        supabase
          .from('feedback_for_teacher')
          .select('*')
          .order('submitted_at', { ascending: false }),
        callRpcNoArgs('teacher_read_my_actions'),
      ])

      if (cancelled) return

      if (clustersRes.error || feedbackRes.error || actionsRes.error) {
        setError(
          friendlyError(
            clustersRes.error?.message ??
              feedbackRes.error?.message ??
              actionsRes.error?.message ??
              'Failed to load dashboard data.',
          ),
        )
        setLoading(false)
        return
      }

      setClusters(clustersRes.data ?? [])
      setFeedbacks(feedbackRes.data ?? [])
      setActions(actionsRes.data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, profile])

  // ── Computed: metric counts ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalFeedback = feedbacks.length
    let learningConcerns = 0
    for (const f of feedbacks) {
      if (f.feedback_types.includes('Learning difficulty')) learningConcerns++
    }
    let highPriority = 0
    let resolved = 0
    for (const c of clusters) {
      if (c.priority_level === 'high') highPriority++
      if (c.status === 'closed') resolved++
    }
    return { totalFeedback, learningConcerns, highPriority, resolved }
  }, [feedbacks, clusters])

  // ── Computed: trend bars (last 7 days) ──────────────────────────────────
  const trendBars = useMemo(() => {
    const counts = new Array<number>(7).fill(0)
    const now = new Date()
    for (const f of feedbacks) {
      const diff = Math.floor(
        (now.getTime() - new Date(f.submitted_at).getTime()) / 86_400_000,
      )
      if (diff >= 0 && diff < 7) {
        counts[new Date(f.submitted_at).getDay()]++
      }
    }
    const maxCount = Math.max(...counts, 1)
    return counts.map((count, i) => ({
      label: DAY_LABELS[i],
      height: Math.round((count / maxCount) * 100),
      count,
    }))
  }, [feedbacks])

  // ── Computed: distribution by feedback area ─────────────────────────────
  const distributions = useMemo(() => {
    const areaCounts: Record<string, number> = {}
    for (const f of feedbacks) {
      const key = f.feedback_area || f.university_service || 'Other'
      areaCounts[key] = (areaCounts[key] ?? 0) + 1
    }
    const total = feedbacks.length || 1
    return Object.entries(areaCounts)
      .map(([label, count]) => ({
        label,
        percent: Math.round((count / total) * 100),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [feedbacks])

  // ── Filtered bottlenecks ────────────────────────────────────────────────
  const filteredBottlenecks = useMemo(() => {
    return clusters.filter((c) => {
      const matchPriority =
        priorityFilter === 'all' || c.priority_level === priorityFilter
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase())
      return matchPriority && matchSearch
    })
  }, [clusters, priorityFilter, search])

  // ── Cluster evidence (feedback matching the selected cluster's topic) ──
  const clusterEvidence = useMemo(() => {
    if (!selectedCluster) return []
    const tag = selectedCluster.canonical_tag
    const topic = selectedCluster.feedback_area ?? ''
    return feedbacks
      .filter(
        (f) =>
          f.topic?.toLowerCase().includes(tag.toLowerCase()) ||
          f.feedback_area === topic,
      )
      .slice(0, 4)
  }, [selectedCluster, feedbacks])

  // ── Priority reasons (built from cluster metadata) ─────────────────────
  const priorityReasons = useMemo(() => {
    if (!selectedCluster) return []
    const reasons: string[] = []
    reasons.push(`${selectedCluster.report_count} related submissions`)
    if (selectedCluster.trend === 'increasing') {
      reasons.push('Reports have been increasing recently')
    } else if (selectedCluster.trend === 'stable') {
      reasons.push('The issue has been persistent')
    } else {
      reasons.push('Reports are improving')
    }
    if (selectedCluster.feedback_share != null) {
      reasons.push(
        `Represents ${Math.round(selectedCluster.feedback_share * 100)}% of related feedback`,
      )
    }
    if (selectedCluster.ai_suggested_department) {
      reasons.push(
        `Affects ${selectedCluster.ai_suggested_department}`,
      )
    }
    return reasons
  }, [selectedCluster])

  // ── Handlers ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }, [])

  const openDialog = useCallback((cluster: TeacherClusterRow) => {
    setSelectedCluster(cluster)
    setAcknowledged(cluster.status === 'acknowledged' || cluster.status === 'action_created')
    setActionFormOpen(false)
    setFormTitle('')
    setFormStatus('Planned')
    setFormUpdate('')
  }, [])

  const closeDialog = useCallback(() => {
    setSelectedCluster(null)
    setActionFormOpen(false)
  }, [])

  const handleAcknowledge = useCallback(async () => {
    if (!selectedCluster || submitting) return
    setSubmitting(true)
    const { error: err } = await callRpc('teacher_acknowledge_cluster', {
      p_cluster_id: selectedCluster.id,
    })
    setSubmitting(false)
    if (err) {
      showToast(friendlyError(err.message))
      return
    }
    setAcknowledged(true)
    setClusters((prev) =>
      prev.map((c) =>
        c.id === selectedCluster.id ? { ...c, status: 'acknowledged' } : c,
      ),
    )
    showToast('Issue acknowledged.')
  }, [selectedCluster, submitting, showToast])

  const handleActionSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!selectedCluster || submitting) return
      setSubmitting(true)

      // 1. Create the teaching action
      const { data: actionData, error: createErr } = await callRpc(
        'teacher_create_action',
        {
          p_cluster_id: selectedCluster.id,
          p_title: formTitle,
        },
      )
      if (createErr || !actionData?.length) {
        setSubmitting(false)
        showToast(friendlyError(createErr?.message ?? 'Could not create action'))
        return
      }

      const actionId = actionData[0].id

      // 2. Update status if not default ('planned')
      if (formStatus !== 'Planned') {
        const statusMap: Record<string, string> = {
          'In progress': 'in_progress',
          Completed: 'completed',
        }
        await callRpc('teacher_update_my_action', {
          p_action_id: actionId,
          p_status: statusMap[formStatus] ?? null,
        })
      }

      // 3. Publish student-facing update if provided
      if (formUpdate.trim()) {
        const { error: pubErr } = await callRpc('teacher_publish_update', {
          p_action_id: actionId,
          p_student_facing_message: formUpdate.trim(),
        })
        if (pubErr) {
          setSubmitting(false)
          showToast(`Action created but update failed: ${friendlyError(pubErr.message)}`)
          return
        }
      }

      // 4. Refresh actions list
      const { data: refreshed } = await callRpcNoArgs('teacher_read_my_actions')
      if (refreshed) setActions(refreshed)

      setSubmitting(false)
      setActionFormOpen(false)
      showToast('Action saved successfully.')
      setTimeout(closeDialog, 700)
    },
    [selectedCluster, formTitle, formStatus, formUpdate, submitting, showToast, closeDialog],
  )

  const scrollToActions = useCallback(() => {
    actionPanelRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ── Auth / role guard (render-time, no setState) ───────────────────────
  if (!authLoading && (!profile || profile.role !== 'teacher')) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-xl border border-danger/20 bg-soft-red p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-bold text-navy">Teacher access required</h2>
          <p className="text-sm text-muted">
            You must be signed in with a teacher account to view this dashboard.
          </p>
        </div>
      </div>
    )
  }

  // ── Loading state ───────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
          <p className="text-sm">Loading teaching analytics…</p>
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-xl border border-danger/20 bg-soft-red p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-bold text-navy">Unable to load dashboard</h2>
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    )
  }

  // ── Populated dashboard ─────────────────────────────────────────────────
  const topCluster = clusters[0] ?? null
  const hasData = feedbacks.length > 0

  return (
    <>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-navy">{VIEW_COPY[view].title}</h2>
        <p className="mt-1 text-sm text-muted">{VIEW_COPY[view].description}</p>
      </div>

      {/* ── Status banner ── */}
      {!hasData && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-soft-amber px-4 py-2 text-center text-sm font-semibold text-warning">
          No feedback data available for your assigned sections yet.
        </div>
      )}

      {/* ── Metric cards ── */}
      {view === 'overview' && (
        <section id="teacher-overview" className="mb-5 scroll-mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={<FileText className="h-5 w-5" />} label="Total Feedback" value={metrics.totalFeedback} iconBg="bg-soft-blue" iconColour="text-ocean" />
          <MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="Learning Concerns" value={metrics.learningConcerns} iconBg="bg-soft-amber" iconColour="text-[#B66A00]" />
          <MetricCard icon={<Flag className="h-5 w-5" />} label="High Priority" value={metrics.highPriority} iconBg="bg-soft-red" iconColour="text-danger" />
          <MetricCard icon={<CheckCircle className="h-5 w-5" />} label="Resolved" value={metrics.resolved} iconBg="bg-soft-teal" iconColour="text-teal-dark" />
        </section>
      )}

      {/* ── Dashboard grid ── */}
      <div className={`grid grid-cols-1 gap-5 ${view === 'overview' || view === 'insights' || view === 'feedback' ? 'xl:grid-cols-[1.25fr_0.75fr]' : ''}`}>

        {/* ── Top Learning Bottlenecks ── */}
        {(view === 'overview' || view === 'insights') && (
        <section id="teacher-insights" className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-[18px]">
            <h3 className="m-0 text-[19px] text-navy">Top Learning Bottlenecks</h3>
            <FilterButtons options={FILTER_OPTIONS} active={priorityFilter} onChange={setPriorityFilter} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Learning problem', 'Reports', 'Share', 'Trend', 'Priority'].map((h) => (
                    <th key={h} className="border-b border-[#E8E2D9] px-3 py-3.5 text-left text-[12px] uppercase text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBottlenecks.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer transition-colors hover:bg-[#F7FAF9]"
                    onClick={() => openDialog(c)}
                  >
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm font-bold text-ocean">{c.title}</td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm">{c.report_count}</td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm">
                      {c.feedback_share != null ? `${Math.round(c.feedback_share * 100)}%` : '—'}
                    </td>
                    <td className={`border-b border-[#E8E2D9] px-3 py-3.5 text-sm font-semibold ${TREND_COLOURS[c.trend]}`}>
                      {TREND_ARROWS[c.trend]} {TREND_LABELS[c.trend]}
                    </td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                      <PriorityBadge level={c.priority_level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBottlenecks.length === 0 && (
              <p className="py-7 text-center text-muted">
                {clusters.length === 0
                  ? 'No learning bottlenecks identified yet.'
                  : 'No matching learning problems.'}
              </p>
            )}
          </div>
          {/* Search row below table */}
          <div className="border-t border-border px-5 py-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by topic…"
              className="h-9 w-full rounded-lg border border-[#CAD3D6] bg-white px-3 text-sm text-text outline-none transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)]"
            />
          </div>
        </section>
        )}

        {/* ── Feedback Trend ── */}
        {(view === 'overview' || view === 'insights' || view === 'feedback') && (
        <Panel title="Feedback Trend">
          {/* Bar chart */}
          <div className="flex items-end gap-3 border-b border-[#CCD6D9] pb-3" style={{ height: 185 }}>
            {trendBars.map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center text-[11px] text-muted">
                <div
                  className="mb-1.5 w-full rounded-t-md bg-gradient-to-b from-aqua to-teal"
                  style={{ height: `${bar.height}%`, minHeight: bar.count > 0 ? 8 : 0 }}
                />
                {bar.label}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Feedback received by day · last 7 days</p>

          {/* AI Insight */}
          {topCluster && (
            <div className="mt-4 rounded-[10px] border border-[#A9DDD7] px-4 py-4" style={{ background: 'linear-gradient(135deg, #F3FBF9, #EAF5F7)' }}>
              <strong className="text-teal-dark">✦ AI Insight</strong>
              <p className="mt-2 leading-relaxed text-text">
                {topCluster.ai_suggested_response ?? topCluster.summary}
              </p>
              <button
                type="button"
                className="font-bold text-teal-dark hover:underline"
                onClick={() => openDialog(topCluster)}
              >
                View evidence →
              </button>
            </div>
          )}
        </Panel>
        )}

        {/* ── Feedback Distribution ── */}
        {(view === 'overview' || view === 'feedback') && (
        <Panel title="Feedback Distribution">
          {distributions.length > 0 ? (
            <div className="grid gap-3">
              {distributions.map((d) => (
                <ProgressBar key={d.label} label={d.label} value={d.percent} valueText={`${d.percent}% (${d.count})`} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted">No feedback data yet.</p>
          )}
        </Panel>
        )}

        {view === 'feedback' && (
          <section className="overflow-hidden rounded-xl border border-border bg-white xl:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-[18px]">
              <h3 className="m-0 text-[19px] text-navy">Recent Feedback</h3>
              <span className="text-sm font-semibold text-muted">
                {feedbacks.length} {feedbacks.length === 1 ? 'submission' : 'submissions'}
              </span>
            </div>
            <div className="divide-y divide-border">
              {feedbacks.length > 0 ? (
                feedbacks.map((feedback) => (
                  <article key={feedback.id} className="p-5">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-ocean">
                          {feedback.feedback_area || feedback.university_service || 'General feedback'}
                        </strong>
                        {feedback.language_detected && (
                          <span className="rounded-full bg-soft-blue px-2 py-1 text-xs font-semibold text-ocean">
                            {feedback.language_detected}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted">
                        {new Date(feedback.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="leading-relaxed text-text">{feedback.original_text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {feedback.feedback_types.map((type) => (
                        <span key={type} className="rounded-full bg-soft-teal px-2.5 py-1 text-xs font-semibold text-teal-dark">
                          {type}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted">Reference: {feedback.reference_number}</p>
                  </article>
                ))
              ) : (
                <p className="p-8 text-center text-sm text-muted">
                  No feedback is available for your assigned sections yet.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Action Progress ── */}
        {(view === 'overview' || view === 'actions') && (
        <section id="teacher-actions" ref={actionPanelRef} className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-[18px]">
            <h3 className="m-0 text-[19px] text-navy">Action Progress</h3>
            {view === 'overview' && (
              <button type="button" className="font-bold text-teal-dark hover:underline" onClick={scrollToActions}>
                View all →
              </button>
            )}
          </div>
          <div className="grid gap-3 p-5">
            {actions.length > 0 ? (
              actions.map((a) => {
                const linkedCluster = clusters.find((c) => c.id === a.cluster_id)
                const actionStatusLabel =
                  ACTION_STATUS_LABELS[a.status as keyof typeof ACTION_STATUS_LABELS] ?? a.status
                return (
                  <div key={a.id} className="rounded-[9px] border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{a.title}</strong>
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${
                          a.status === 'completed'
                            ? 'bg-soft-teal text-success'
                            : a.status === 'in_progress'
                              ? 'bg-soft-amber text-warning'
                              : 'bg-soft-blue text-ocean'
                        }`}
                      >
                        {actionStatusLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted">
                      Linked issue: {linkedCluster?.title ?? 'Unknown'}
                    </p>
                    <ProgressBar
                      value={
                        a.status === 'completed' ? 100 : a.status === 'in_progress' ? 60 : 20
                      }
                    />
                  </div>
                )
              })
            ) : (
              <p className="py-4 text-center text-sm text-muted">
                No teaching actions created yet.
              </p>
            )}
          </div>
        </section>
        )}
      </div>

      {/* ── Issue Detail Dialog ── */}
      <OverlayDialog
        open={!!selectedCluster}
        onClose={closeDialog}
        title={selectedCluster?.title ?? ''}
        subtitle="Learning bottleneck"
        maxWidth="min(760px, 100%)"
        footer={
          <>
            <button
              type="button"
              disabled={acknowledged || submitting}
              onClick={handleAcknowledge}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-bold text-ocean transition-colors hover:bg-ivory disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : acknowledged
                  ? '✓ Acknowledged'
                  : 'Acknowledge'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setActionFormOpen((v) => !v)}
              className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
            >
              {actionFormOpen ? 'Close Form' : 'Create Action'}
            </button>
          </>
        }
      >
        {selectedCluster && (
          <div className="space-y-5">
            {/* Summary */}
            <p className="leading-relaxed text-text">{selectedCluster.summary}</p>

            {/* Summary grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Related feedback</small>
                <strong className="mt-1 block">{selectedCluster.report_count} reports</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Feedback share</small>
                <strong className="mt-1 block">
                  {selectedCluster.feedback_share != null
                    ? `${Math.round(selectedCluster.feedback_share * 100)}% of learning feedback`
                    : '—'}
                </strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Priority</small>
                <strong className={`mt-1 block ${TREND_COLOURS[selectedCluster.priority_level === 'high' ? 'increasing' : selectedCluster.priority_level === 'medium' ? 'stable' : 'improving']}`}>
                  {PRIORITY_LABELS[selectedCluster.priority_level]}
                </strong>
              </div>
            </div>

            {/* Evidence */}
            {clusterEvidence.length > 0 && (
              <>
                <h4 className="text-ocean">Supporting evidence</h4>
                {clusterEvidence.map((ev) => (
                  <EvidenceQuote
                    key={ev.id}
                    text={ev.original_text}
                    language={ev.language_detected ?? undefined}
                  />
                ))}
              </>
            )}

            {/* Priority reasons */}
            {priorityReasons.length > 0 && (
              <PriorityReasons reasons={priorityReasons} />
            )}

            {/* AI suggestion */}
            {selectedCluster.ai_suggested_response && (
              <div>
                <h4 className="mb-2 text-ocean">AI-suggested response</h4>
                <div className="rounded-[9px] bg-soft-teal p-3.5 leading-relaxed text-text">
                  {selectedCluster.ai_suggested_response}
                </div>
              </div>
            )}

            {/* Action form (toggle) */}
            {actionFormOpen && (
              <form className="grid gap-2.5 rounded-[9px] border border-border p-4" onSubmit={handleActionSubmit}>
                <strong className="text-navy">Create teaching action</strong>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Action title"
                  className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm outline-none focus:border-teal"
                />
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm outline-none focus:border-teal"
                >
                  <option>Planned</option>
                  <option>In progress</option>
                  <option>Completed</option>
                </select>
                <textarea
                  value={formUpdate}
                  onChange={(e) => setFormUpdate(e.target.value)}
                  placeholder="Student-facing update…"
                  className="min-h-[80px] w-full resize-y rounded-lg border border-[#C9D2D5] p-2.5 text-sm outline-none focus:border-teal"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Save Action'}
                </button>
              </form>
            )}
          </div>
        )}
      </OverlayDialog>

      {/* ── Toast ── */}
      <Toast open={toastOpen} message={toastMsg} onClose={() => setToastOpen(false)} />
    </>
  )
}
