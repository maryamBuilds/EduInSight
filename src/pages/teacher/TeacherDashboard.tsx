import { useState, useCallback, useRef, type FormEvent } from 'react'
import {
  FileText,
  AlertTriangle,
  Flag,
  CheckCircle,
} from 'lucide-react'
import type { PriorityLevel, TrendDirection, DetectedLanguage } from '@/lib/types'
import {
  PRIORITY_LABELS,
  TREND_LABELS,
  TREND_ARROWS,
  TREND_COLOURS,
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

// ---------------------------------------------------------------------------
// Local demo types
// ---------------------------------------------------------------------------

interface DemoBottleneck {
  id: string
  topic: string
  reportCount: number
  sharePercent: number
  trend: TrendDirection
  priority: PriorityLevel
  summary: string
  evidence: { text: string; language: DetectedLanguage }[]
  priorityReasons: string[]
  aiSuggestion: string
}

interface DemoDistribution {
  label: string
  percent: number
  count: number
}

interface DemoAction {
  id: string
  title: string
  status: string
  linkedIssue: string
  progress: number
}

interface DemoBarPoint {
  label: string
  height: number
}

// ---------------------------------------------------------------------------
// Synthetic demonstration data
// ---------------------------------------------------------------------------

const DEMO_BOTTLENECKS: DemoBottleneck[] = [
  {
    id: 'b1',
    topic: 'Pointers with abstraction',
    reportCount: 12,
    sharePercent: 25,
    trend: 'increasing',
    priority: 'high',
    summary:
      'Students appear to understand pointers and abstraction separately, but several comments suggest difficulty connecting them during runtime polymorphism.',
    evidence: [
      { text: 'Pointers aur abstract classes ka relation samajh nahi aa raha.', language: 'roman_ur' },
      { text: 'I understand pointers separately but cannot apply them in polymorphism.', language: 'en' },
      { text: 'Base-class pointer derived object ko call kese karta hai?', language: 'roman_ur' },
    ],
    priorityReasons: [
      '12 related submissions',
      'Reports increased after the relevant lecture',
      'The issue affects understanding of later polymorphism concepts',
      'The same concern appears in two sections',
    ],
    aiSuggestion:
      'Use a visual base-pointer/derived-object diagram, demonstrate one short virtual-function example and collect follow-up feedback after a focused clarification session. Teacher review is required.',
  },
  {
    id: 'b2',
    topic: 'Runtime polymorphism',
    reportCount: 9,
    sharePercent: 19,
    trend: 'stable',
    priority: 'medium',
    summary:
      'Students struggle with dynamic dispatch and virtual function tables. Confusion often overlaps with pointer-abstraction difficulties.',
    evidence: [
      { text: 'Virtual functions ka concept clear nahi hai.', language: 'roman_ur' },
      { text: 'I cannot differentiate between compile-time and run-time polymorphism.', language: 'en' },
    ],
    priorityReasons: [
      '9 related submissions',
      'Stable trend indicates a persistent gap',
      'Overlaps with the pointer-abstraction bottleneck',
    ],
    aiSuggestion:
      'Add a step-by-step walkthrough of vtable resolution with live coding examples and a short practice quiz.',
  },
  {
    id: 'b3',
    topic: 'Exception handling',
    reportCount: 7,
    sharePercent: 15,
    trend: 'increasing',
    priority: 'medium',
    summary:
      'Several students find try-catch blocks confusing, especially when combining custom exceptions with resource management.',
    evidence: [
      { text: 'Try-catch samajh nahi aata kab use karna hai.', language: 'roman_ur' },
      { text: 'Custom exceptions seem unnecessary compared to simple if-checks.', language: 'en' },
    ],
    priorityReasons: [
      '7 related submissions',
      'Reports increased after the exception-handling lab',
      'Concept is foundational for later file-I/O topics',
    ],
    aiSuggestion:
      'Introduce a real-world error-handling scenario (file parsing) and compare if-check vs exception approaches side by side.',
  },
  {
    id: 'b4',
    topic: 'File handling',
    reportCount: 5,
    sharePercent: 10,
    trend: 'improving',
    priority: 'low',
    summary:
      'A smaller group of students report difficulty with file streams and error recovery during read/write operations.',
    evidence: [
      { text: 'File streams ka syntax yaad nahi rehta.', language: 'roman_ur' },
      { text: 'I forget to close files and get runtime errors.', language: 'en' },
    ],
    priorityReasons: [
      '5 related submissions',
      'Trend is improving after the practice session',
      'Lower share of total feedback',
    ],
    aiSuggestion:
      'Provide a short cheat-sheet of file-stream patterns and a sandbox exercise with deliberate errors to fix.',
  },
]

const DEMO_DISTRIBUTIONS: DemoDistribution[] = [
  { label: 'Academic learning difficulties', percent: 40, count: 48 },
  { label: 'Teaching delivery', percent: 22, count: 26 },
  { label: 'Assessment and assignments', percent: 18, count: 22 },
  { label: 'Learning resources', percent: 12, count: 14 },
]

const DEMO_ACTIONS: DemoAction[] = [
  { id: 'a1', title: 'Pointer–object visual recap', status: 'In progress', linkedIssue: 'Pointers with abstraction', progress: 60 },
  { id: 'a2', title: 'Exception-flow practice session', status: 'Completed', linkedIssue: 'Exception handling', progress: 100 },
]

const DEMO_BARS: DemoBarPoint[] = [
  { label: 'Mon', height: 35 },
  { label: 'Tue', height: 48 },
  { label: 'Wed', height: 70 },
  { label: 'Thu', height: 54 },
  { label: 'Fri', height: 44 },
  { label: 'Sat', height: 61 },
  { label: 'Sun', height: 82 },
]

type TeacherFilter = 'all' | 'high' | 'medium'

const FILTER_OPTIONS: { value: TeacherFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
]

// ---------------------------------------------------------------------------
// Teacher Dashboard
// ---------------------------------------------------------------------------

export default function TeacherDashboard() {
  const [priorityFilter, setPriorityFilter] = useState<TeacherFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<DemoBottleneck | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [actionFormOpen, setActionFormOpen] = useState(false)
  const [actions, setActions] = useState<DemoAction[]>(DEMO_ACTIONS)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const actionPanelRef = useRef<HTMLElement>(null)

  // Helpers
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }, [])

  const filteredBottlenecks = DEMO_BOTTLENECKS.filter((b) => {
    const matchPriority = priorityFilter === 'all' || b.priority === priorityFilter
    const matchSearch = b.topic.toLowerCase().includes(search.toLowerCase())
    return matchPriority && matchSearch
  })

  // Action form state
  const [formTitle, setFormTitle] = useState('')
  const [formStatus, setFormStatus] = useState('Planned')
  const [formUpdate, setFormUpdate] = useState('')

  const openDialog = useCallback((issue: DemoBottleneck) => {
    setSelectedIssue(issue)
    setAcknowledged(false)
    setActionFormOpen(false)
    setFormTitle('Pointer–object visual recap')
    setFormStatus('Planned')
    setFormUpdate('An additional explanation and practice session will be conducted.')
  }, [setFormTitle, setFormStatus, setFormUpdate])

  const closeDialog = useCallback(() => {
    setSelectedIssue(null)
    setActionFormOpen(false)
  }, [])

  const handleAcknowledge = useCallback(() => {
    setAcknowledged(true)
    showToast('Issue acknowledged.')
  }, [showToast])

  const handleActionSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const progressMap: Record<string, number> = { Planned: 20, 'In progress': 60, Completed: 100 }
      const newAction: DemoAction = {
        id: `a${Date.now()}`,
        title: formTitle,
        status: formStatus,
        linkedIssue: selectedIssue?.topic ?? '',
        progress: progressMap[formStatus] ?? 20,
      }
      setActions((prev) => [newAction, ...prev])
      setActionFormOpen(false)
      showToast('Action saved successfully.')
      setTimeout(closeDialog, 700)
    },
    [formTitle, formStatus, selectedIssue, showToast, closeDialog],
  )

  const scrollToActions = useCallback(() => {
    actionPanelRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <>
      {/* ── Demo banner ── */}
      <div className="mb-4 rounded-lg border border-amber-300 bg-soft-amber px-4 py-2 text-center text-sm font-semibold text-warning">
        Demonstration data — synthetic content for UI validation only
      </div>

      {/* ── Metric cards ── */}
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileText className="h-5 w-5" />} label="Total Feedback" value={120} iconBg="bg-soft-blue" iconColour="text-ocean" />
        <MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="Learning Concerns" value={48} iconBg="bg-soft-amber" iconColour="text-[#B66A00]" />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="High Priority" value={3} iconBg="bg-soft-red" iconColour="text-danger" />
        <MetricCard icon={<CheckCircle className="h-5 w-5" />} label="Resolved" value={18} iconBg="bg-soft-teal" iconColour="text-teal-dark" />
      </section>

      {/* ── Dashboard grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">

        {/* ── Top Learning Bottlenecks ── */}
        <section className="overflow-hidden rounded-xl border border-border bg-white">
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
                {filteredBottlenecks.map((b) => (
                  <tr
                    key={b.id}
                    className="cursor-pointer transition-colors hover:bg-[#F7FAF9]"
                    onClick={() => openDialog(b)}
                  >
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm font-bold text-ocean">{b.topic}</td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm">{b.reportCount}</td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-sm">{b.sharePercent}%</td>
                    <td className={`border-b border-[#E8E2D9] px-3 py-3.5 text-sm font-semibold ${TREND_COLOURS[b.trend]}`}>
                      {TREND_ARROWS[b.trend]} {TREND_LABELS[b.trend]}
                    </td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                      <PriorityBadge level={b.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredBottlenecks.length === 0 && (
              <p className="py-7 text-center text-muted">No matching learning problems.</p>
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

        {/* ── Feedback Trend ── */}
        <Panel title="Feedback Trend">
          {/* Bar chart */}
          <div className="flex items-end gap-3 border-b border-[#CCD6D9] pb-3" style={{ height: 185 }}>
            {DEMO_BARS.map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center text-[11px] text-muted">
                <div
                  className="mb-1.5 w-full rounded-t-md bg-gradient-to-b from-aqua to-teal"
                  style={{ height: `${bar.height}%`, minHeight: 8 }}
                />
                {bar.label}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Feedback received by day · prototype data</p>

          {/* AI Insight */}
          <div className="mt-4 rounded-[10px] border border-[#A9DDD7] px-4 py-4" style={{ background: 'linear-gradient(135deg, #F3FBF9, #EAF5F7)' }}>
            <strong className="text-teal-dark">✦ AI Insight</strong>
            <p className="mt-2 leading-relaxed text-text">
              Students understand pointers and abstraction separately but struggle to connect them in runtime polymorphism.
            </p>
            <button
              type="button"
              className="font-bold text-teal-dark hover:underline"
              onClick={() => openDialog(DEMO_BOTTLENECKS[0])}
            >
              View evidence →
            </button>
          </div>
        </Panel>

        {/* ── Feedback Distribution ── */}
        <Panel title="Feedback Distribution">
          <div className="grid gap-3">
            {DEMO_DISTRIBUTIONS.map((d) => (
              <ProgressBar key={d.label} label={d.label} value={d.percent} valueText={`${d.percent}% (${d.count})`} />
            ))}
          </div>
        </Panel>

        {/* ── Action Progress ── */}
        <section ref={actionPanelRef} className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-[18px]">
            <h3 className="m-0 text-[19px] text-navy">Action Progress</h3>
            <button type="button" className="font-bold text-teal-dark hover:underline" onClick={scrollToActions}>
              View all →
            </button>
          </div>
          <div className="grid gap-3 p-5">
            {actions.map((a) => (
              <div key={a.id} className="rounded-[9px] border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{a.title}</strong>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${
                      a.status === 'Completed'
                        ? 'bg-soft-teal text-success'
                        : a.status === 'In progress'
                          ? 'bg-soft-amber text-warning'
                          : 'bg-soft-blue text-ocean'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">Linked issue: {a.linkedIssue}</p>
                <ProgressBar value={a.progress} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Issue Detail Dialog ── */}
      <OverlayDialog
        open={!!selectedIssue}
        onClose={closeDialog}
        title={selectedIssue?.topic ?? ''}
        subtitle="Learning bottleneck"
        maxWidth="min(760px, 100%)"
        footer={
          <>
            <button
              type="button"
              disabled={acknowledged}
              onClick={handleAcknowledge}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-bold text-ocean transition-colors hover:bg-ivory disabled:opacity-60"
            >
              {acknowledged ? '✓ Acknowledged' : 'Acknowledge'}
            </button>
            <button
              type="button"
              onClick={() => setActionFormOpen((v) => !v)}
              className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark"
            >
              {actionFormOpen ? 'Close Form' : 'Create Action'}
            </button>
          </>
        }
      >
        {selectedIssue && (
          <div className="space-y-5">
            {/* Summary */}
            <p className="leading-relaxed text-text">{selectedIssue.summary}</p>

            {/* Summary grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Related feedback</small>
                <strong className="mt-1 block">{selectedIssue.reportCount} reports</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Feedback share</small>
                <strong className="mt-1 block">{selectedIssue.sharePercent}% of learning feedback</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Priority</small>
                <strong className={`mt-1 block ${TREND_COLOURS[selectedIssue.priority === 'high' ? 'increasing' : selectedIssue.priority === 'medium' ? 'stable' : 'improving']}`}>
                  {PRIORITY_LABELS[selectedIssue.priority]}
                </strong>
              </div>
            </div>

            {/* Evidence */}
            <h4 className="text-ocean">Supporting evidence</h4>
            {selectedIssue.evidence.map((ev, i) => (
              <EvidenceQuote key={i} text={ev.text} language={ev.language} />
            ))}

            {/* Priority reasons */}
            <PriorityReasons reasons={selectedIssue.priorityReasons} />

            {/* AI suggestion */}
            <div>
              <h4 className="mb-2 text-ocean">AI-suggested response</h4>
              <div className="rounded-[9px] bg-soft-teal p-3.5 leading-relaxed text-text">
                {selectedIssue.aiSuggestion}
              </div>
            </div>

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
                <button type="submit" className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark">
                  Save Action
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
