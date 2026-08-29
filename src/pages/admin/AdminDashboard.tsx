import { useState, useCallback, useEffect, useMemo, type FormEvent } from 'react'
import {
  FileText,
  Flag,
  Clock,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type { IssueCluster, Feedback, Action } from '@/lib/types'
import {
  PRIORITY_LABELS,
  TREND_LABELS,
  TREND_ARROWS,
  TREND_COLOURS,
  ACTION_STATUS_LABELS,
} from '@/lib/constants'
import {
  MetricCard,
  PriorityBadge,
  FilterButtons,
  ProgressBar,
  EvidenceQuote,
  PriorityReasons,
  OverlayDialog,
  Toast,
} from '@/components'
import { supabase } from '@/lib/supabase'
import {
  updateClusterStatus,
  callRpc,
  friendlyError,
} from '@/lib/rpc'
import { useAuth } from '@/context/AuthContext'

// ---------------------------------------------------------------------------
// Filter constants
// ---------------------------------------------------------------------------

type AdminFilter = 'all' | 'high' | 'medium' | 'unassigned'

const FILTER_OPTIONS: { value: AdminFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'unassigned', label: 'Unassigned' },
]

/** Status badge colour class for cluster and action statuses. */
function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, '_')
  switch (normalized) {
    case 'action_created':
    case 'in_progress':
    case 'completed':
      return 'bg-soft-teal text-success'
    case 'acknowledged':
      return 'bg-soft-amber text-[#8A5A16]'
    case 'open':
      return 'bg-soft-red text-danger'
    case 'assigned':
    case 'planned':
      return 'bg-soft-blue text-ocean'
    default:
      return 'bg-soft-blue text-ocean'
  }
}

/** Cluster status user-facing labels. */
const CLUSTER_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  action_created: 'Action Created',
  closed: 'Closed',
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { loading: authLoading, profile } = useAuth()

  // ── Data state ──────────────────────────────────────────────────────────
  const [clusters, setClusters] = useState<IssueCluster[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [actions, setActions] = useState<(Action & { issue_clusters: { title: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── UI state ────────────────────────────────────────────────────────────
  const [priorityFilter, setPriorityFilter] = useState<AdminFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedCluster, setSelectedCluster] = useState<IssueCluster | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [actionFormOpen, setActionFormOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Admin action form state
  const [formStatus, setFormStatus] = useState('Assigned')
  const [formTitle, setFormTitle] = useState('')
  const [formPerson, setFormPerson] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formStudentUpdate, setFormStudentUpdate] = useState('')

  // ── Fetch data from Supabase (after auth ready + admin role) ──────────
  useEffect(() => {
    let cancelled = false

    if (authLoading) return
    if (!profile || profile.role !== 'admin') return

    async function load() {
      setLoading(true)
      setError(null)

      const [clustersRes, feedbackRes, actionsRes] = await Promise.all([
        supabase
          .from('issue_clusters')
          .select('*')
          .order('priority_score', { ascending: false }),
        supabase.from('feedback').select('*'),
        supabase
          .from('actions')
          .select('*, issue_clusters(title)')
          .order('created_at', { ascending: false }),
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
      setActions((actionsRes.data ?? []) as (Action & { issue_clusters: { title: string } })[])
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
    let highPriority = 0
    let underReviewCount = 0
    let resolved = 0
    for (const c of clusters) {
      if (c.priority_level === 'high') highPriority++
      if (c.status === 'open' || c.status === 'acknowledged') underReviewCount++
      if (c.status === 'closed') resolved++
    }
    return { totalFeedback, highPriority, underReview: underReviewCount, resolved }
  }, [feedbacks, clusters])

  // ── Computed: distribution by university service ────────────────────────
  const distributions = useMemo(() => {
    const serviceCounts: Record<string, number> = {}
    for (const f of feedbacks) {
      const key = f.university_service || 'Other'
      serviceCounts[key] = (serviceCounts[key] ?? 0) + 1
    }
    const total = feedbacks.length || 1
    return Object.entries(serviceCounts)
      .map(([label, count]) => ({
        label,
        percent: Math.round((count / total) * 100),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [feedbacks])

  // ── Filtered problems ───────────────────────────────────────────────────
  const filteredProblems = useMemo(() => {
    return clusters.filter((c) => {
      let matchFilter: boolean
      if (priorityFilter === 'all') matchFilter = true
      else if (priorityFilter === 'unassigned') {
        matchFilter = c.status === 'open' && !c.ai_suggested_department
      } else matchFilter = c.priority_level === priorityFilter

      const haystack = `${c.title} ${c.feedback_area ?? ''} ${c.university_service ?? ''}`.toLowerCase()
      const matchSearch = haystack.includes(search.toLowerCase())
      return matchFilter && matchSearch
    })
  }, [clusters, priorityFilter, search])

  // ── Cluster evidence (feedback matching the selected cluster) ──────────
  const clusterEvidence = useMemo(() => {
    if (!selectedCluster) return []
    const tag = selectedCluster.canonical_tag
    const topic = selectedCluster.feedback_area ?? ''
    return feedbacks
      .filter(
        (f) =>
          f.topic?.toLowerCase().includes(tag.toLowerCase()) ||
          f.feedback_area === topic ||
          f.university_service === selectedCluster.university_service,
      )
      .slice(0, 5)
  }, [selectedCluster, feedbacks])

  // ── Priority reasons (built from cluster metadata) ─────────────────────
  const priorityReasons = useMemo(() => {
    if (!selectedCluster) return []
    const reasons: string[] = []
    reasons.push(`${selectedCluster.report_count} related feedback submissions`)
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
      reasons.push(`Affects ${selectedCluster.ai_suggested_department}`)
    }
    return reasons
  }, [selectedCluster])

  // ── Handlers ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }, [])

  const openDialog = useCallback((cluster: IssueCluster) => {
    setSelectedCluster(cluster)
    setAcknowledged(
      cluster.status === 'acknowledged' || cluster.status === 'action_created',
    )
    setActionFormOpen(false)
    setFormStatus('Assigned')
    setFormTitle('')
    setFormPerson('')
    setFormDeadline('')
    setFormNote('')
    setFormStudentUpdate('')
  }, [])

  const closeDialog = useCallback(() => {
    setSelectedCluster(null)
    setActionFormOpen(false)
  }, [])

  const handleAcknowledge = useCallback(async () => {
    if (!selectedCluster || submitting) return
    setSubmitting(true)
    const { error: err } = await updateClusterStatus(
      selectedCluster.id,
      'acknowledged',
    )
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

      const statusMap: Record<string, string> = {
        Assigned: 'assigned',
        'Under review': 'assigned',
        'In progress': 'in_progress',
        Completed: 'completed',
      }

      const { data: actionId, error: rpcErr } = await callRpc('admin_create_action', {
        p_cluster_id: selectedCluster.id,
        p_title: formTitle,
        p_status: statusMap[formStatus] ?? 'assigned',
        p_responsible_department: selectedCluster.ai_suggested_department ?? null,
        p_responsible_person: formPerson || null,
        p_deadline: formDeadline || null,
        p_internal_note: formNote || null,
        p_student_facing_message: formStudentUpdate.trim() || null,
      })

      if (rpcErr || !actionId) {
        setSubmitting(false)
        showToast(friendlyError(rpcErr?.message ?? 'Failed to create action.'))
        return
      }

      // Refresh actions list
      const { data: refreshed } = await supabase
        .from('actions')
        .select('*, issue_clusters(title)')
        .order('created_at', { ascending: false })
      if (refreshed) {
        setActions(refreshed as (Action & { issue_clusters: { title: string } })[])
      }

      // Update local state
      setAcknowledged(true)
      setClusters((prev) =>
        prev.map((c) =>
          c.id === selectedCluster.id ? { ...c, status: 'action_created' } : c,
        ),
      )

      setSubmitting(false)
      setActionFormOpen(false)
      showToast('Action assigned and cluster updated.')
      setTimeout(closeDialog, 1000)
    },
    [selectedCluster, formTitle, formStatus, formPerson, formDeadline, formNote, formStudentUpdate, submitting, showToast, closeDialog],
  )

  // ── Auth / role guard (render-time, no setState) ───────────────────────
  if (!authLoading && (!profile || profile.role !== 'admin')) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-xl border border-danger/20 bg-soft-red p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-danger" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-bold text-navy">Admin access required</h2>
          <p className="text-sm text-muted">
            You must be signed in with an administrator account to view this dashboard.
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
          <p className="text-sm">Loading institutional analytics…</p>
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

  // ── Populated dashboard ──────────────────────────────────────────────────
  const topCluster = clusters[0] ?? null
  const hasData = feedbacks.length > 0

  return (
    <>
      {/* ── Status banner ── */}
      {!hasData && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-soft-amber px-4 py-2 text-center text-sm font-semibold text-warning">
          No feedback data available yet.
        </div>
      )}

      {/* ── Metric cards ── */}
      <section id="admin-overview" className="mb-5 scroll-mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileText className="h-5 w-5" />} label="Total Feedback" value={metrics.totalFeedback} iconBg="bg-soft-blue" iconColour="text-ocean" />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="High-Priority Issues" value={metrics.highPriority} iconBg="bg-soft-red" iconColour="text-danger" />
        <MetricCard icon={<Clock className="h-5 w-5" />} label="Under Review" value={metrics.underReview} iconBg="bg-soft-amber" iconColour="text-[#D98200]" />
        <MetricCard icon={<CheckCircle className="h-5 w-5" />} label="Resolved" value={metrics.resolved} iconBg="bg-soft-teal" iconColour="text-teal-dark" />
      </section>

      {/* ── Dashboard grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">

        {/* ── Priority Institutional Problems ── */}
        <section id="admin-issues" className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-[18px]">
            <h3 className="m-0 text-[19px] text-navy">Priority Institutional Problems</h3>
            <FilterButtons options={FILTER_OPTIONS} active={priorityFilter} onChange={setPriorityFilter} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Problem', 'Reports', 'Trend', 'Priority', 'Owner', 'Status'].map((h) => (
                    <th key={h} className="border-b border-[#E8E2D9] px-3 py-3.5 text-left text-[11px] uppercase text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProblems.map((c) => {
                  const statusLabel =
                    CLUSTER_STATUS_LABELS[c.status] ??
                    ACTION_STATUS_LABELS[c.status as keyof typeof ACTION_STATUS_LABELS] ??
                    c.status
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer transition-colors hover:bg-[#F7FAF9]"
                      onClick={() => openDialog(c)}
                    >
                      <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                        <span className="font-bold text-ocean">{c.title}</span>
                        <span className="mt-1 block text-[11px] text-muted">
                          {c.feedback_area ?? c.university_service ?? '—'}
                        </span>
                      </td>
                      <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-[13px]">{c.report_count}</td>
                      <td className={`border-b border-[#E8E2D9] px-3 py-3.5 text-[13px] font-semibold ${TREND_COLOURS[c.trend]}`}>
                        {TREND_ARROWS[c.trend]} {TREND_LABELS[c.trend]}
                      </td>
                      <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                        <PriorityBadge level={c.priority_level} />
                      </td>
                      <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-[13px]">
                        {c.ai_suggested_department ?? 'Not assigned'}
                      </td>
                      <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                        <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(c.status)}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredProblems.length === 0 && (
              <p className="py-7 text-center text-muted">
                {clusters.length === 0
                  ? 'No institutional problems identified yet.'
                  : 'No matching institutional problems.'}
              </p>
            )}
          </div>
          {/* Search row */}
          <div className="border-t border-border px-5 py-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by problem or area…"
              className="h-9 w-full rounded-lg border border-[#CAD3D6] bg-white px-3 text-sm text-text outline-none transition-colors focus:border-teal focus:shadow-[0_0_0_4px_rgba(42,157,143,0.12)]"
            />
          </div>
        </section>

        {/* ── Feedback by Responsible Area ── */}
        <div className="flex flex-col gap-5">
          <section id="admin-departments" className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-[18px]">
              <h3 className="m-0 text-[19px] text-navy">Feedback by Responsible Area</h3>
            </div>
            <div className="grid gap-4 p-5">
              {distributions.length > 0 ? (
                distributions.map((d) => (
                  <ProgressBar key={d.label} label={d.label} value={d.percent} valueText={`${d.percent}% · ${d.count}`} />
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted">No feedback data yet.</p>
              )}
            </div>
          </section>

          {/* ── Institutional AI Summary ── */}
          <section className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-[18px]">
              <h3 className="m-0 text-[19px] text-navy">Institutional AI Summary</h3>
            </div>
            <div className="p-5">
              {topCluster ? (
                <div className="rounded-[10px] border border-[#A9DDD7] px-4 py-4" style={{ background: 'linear-gradient(135deg, #F3FBF9, #EAF5F7)' }}>
                  <strong className="text-teal-dark">✦ Current institutional insight</strong>
                  <p className="mt-2 leading-relaxed text-text">
                    {topCluster.ai_suggested_response ?? topCluster.summary}
                  </p>
                  <button
                    type="button"
                    className="font-bold text-teal-dark hover:underline"
                    onClick={() => openDialog(topCluster)}
                  >
                    Review evidence →
                  </button>
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted">
                  No institutional insights available yet.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ── Recent Action Activity (full-width row) ── */}
        <section id="admin-actions" className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-white xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-[18px]">
            <h3 className="m-0 text-[19px] text-navy">Recent Action Activity</h3>
            <button
              type="button"
              className="font-bold text-teal-dark hover:underline"
              onClick={() => document.getElementById('admin-actions-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View all →
            </button>
          </div>
          <div id="admin-actions-section" className="grid gap-3 p-5">
            {actions.length > 0 ? (
              actions.map((a) => {
                const statusLabel =
                  ACTION_STATUS_LABELS[a.status as keyof typeof ACTION_STATUS_LABELS] ?? a.status
                return (
                  <div key={a.id} className="rounded-[9px] border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm">{a.title}</strong>
                      <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(a.status)}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {a.responsible_department ?? 'Unassigned'}
                      {a.responsible_person && ` · ${a.responsible_person}`}
                      {a.deadline && ` · Due ${new Date(a.deadline).toLocaleDateString()}`}
                      {a.issue_clusters && ` · ${a.issue_clusters.title}`}
                    </p>
                  </div>
                )
              })
            ) : (
              <p className="py-4 text-center text-sm text-muted">
                No institutional actions created yet.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── Issue Detail Dialog ── */}
      <OverlayDialog
        open={!!selectedCluster}
        onClose={closeDialog}
        title={selectedCluster?.title ?? ''}
        subtitle="Institutional problem cluster"
        maxWidth="min(820px, 100%)"
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
                  : 'Acknowledge Issue'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setActionFormOpen((v) => !v)}
              className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
            >
              {actionFormOpen ? 'Close Form' : 'Assign Action'}
            </button>
          </>
        }
      >
        {selectedCluster && (
          <div className="space-y-5">
            {/* Summary */}
            <p className="leading-relaxed text-text">{selectedCluster.summary}</p>

            {/* Summary grid — 4 columns */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Related feedback</small>
                <strong className="mt-1 block">{selectedCluster.report_count} reports</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Trend</small>
                <strong className={`mt-1 block ${TREND_COLOURS[selectedCluster.trend]}`}>
                  {TREND_LABELS[selectedCluster.trend]}
                </strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Priority</small>
                <strong className={`mt-1 block ${selectedCluster.priority_level === 'high' ? 'text-danger' : selectedCluster.priority_level === 'medium' ? 'text-warning' : 'text-success'}`}>
                  {PRIORITY_LABELS[selectedCluster.priority_level]}
                </strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Suggested dept</small>
                <strong className="mt-1 block">
                  {selectedCluster.ai_suggested_department ?? '—'}
                </strong>
              </div>
            </div>

            {/* Evidence */}
            {clusterEvidence.length > 0 && (
              <>
                <h4 className="text-ocean">Supporting multilingual evidence</h4>
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
                <h4 className="mb-2 text-ocean">AI-suggested routing and response</h4>
                <div className="rounded-[9px] bg-soft-teal p-3.5 leading-relaxed text-text">
                  <strong>Suggested responsible unit:</strong>{' '}
                  {selectedCluster.ai_suggested_department ?? '—'}
                  <br />
                  <br />
                  <strong>Suggested next step:</strong> {selectedCluster.ai_suggested_response}
                  <br />
                  <br />
                  <span className="text-muted">
                    These are AI-generated suggestions. Final assignment and action decisions must
                    be made by authorised staff.
                  </span>
                </div>
              </div>
            )}

            {/* Action form (toggle) */}
            {actionFormOpen && (
              <form className="grid gap-3 rounded-[10px] border border-border p-4" onSubmit={handleActionSubmit}>
                <strong className="text-navy">Assign institutional action</strong>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Action status */}
                  <label className="grid gap-1.5 text-[13px] font-bold">
                    Action status
                    <select
                      required
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    >
                      <option>Assigned</option>
                      <option>Under review</option>
                      <option>In progress</option>
                      <option>Completed</option>
                    </select>
                  </label>

                  {/* Action title (full width) */}
                  <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
                    Action title
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>

                  {/* Responsible person */}
                  <label className="grid gap-1.5 text-[13px] font-bold">
                    Responsible person
                    <input
                      type="text"
                      required
                      value={formPerson}
                      onChange={(e) => setFormPerson(e.target.value)}
                      placeholder="Enter action owner"
                      className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>

                  {/* Deadline */}
                  <label className="grid gap-1.5 text-[13px] font-bold">
                    Deadline
                    <input
                      type="date"
                      required
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>

                  {/* Internal note (full width) */}
                  <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
                    Internal action note
                    <textarea
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="Describe the planned institutional response…"
                      className="min-h-[90px] w-full resize-y rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>

                  {/* Student-facing update (full width, optional) */}
                  <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
                    Student-facing update{' '}
                    <span className="font-normal text-muted">(optional)</span>
                    <textarea
                      value={formStudentUpdate}
                      onChange={(e) => setFormStudentUpdate(e.target.value)}
                      placeholder="Message visible to affected students…"
                      className="min-h-[70px] w-full resize-y rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark disabled:opacity-60"
                >
                  {submitting ? 'Saving…' : 'Save and Assign Action'}
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
