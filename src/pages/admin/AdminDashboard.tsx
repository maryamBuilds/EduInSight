import { useState, useCallback, type FormEvent } from 'react'
import {
  FileText,
  Flag,
  Clock,
  CheckCircle,
} from 'lucide-react'
import type { PriorityLevel, TrendDirection, DetectedLanguage } from '@/lib/types'
import {
  PRIORITY_LABELS,
  TREND_LABELS,
  TREND_ARROWS,
  TREND_COLOURS,
  ADMIN_DEPARTMENTS,
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

// ---------------------------------------------------------------------------
// Local demo types
// ---------------------------------------------------------------------------

interface DemoProblem {
  id: string
  title: string
  area: string
  reportCount: number
  trend: TrendDirection
  priority: PriorityLevel
  owner: string
  status: string
  assignment: 'assigned' | 'unassigned'
  summary: string
  evidence: { text: string; language: DetectedLanguage }[]
  priorityReasons: string[]
  aiSuggestion: { unit: string; support: string; step: string }
}

interface DemoDistribution {
  label: string
  percent: number
  count: number
}

interface DemoActivity {
  id: string
  title: string
  status: string
  meta: string
}

// ---------------------------------------------------------------------------
// Synthetic demonstration data
// ---------------------------------------------------------------------------

const DEMO_PROBLEMS: DemoProblem[] = [
  {
    id: 'p1',
    title: 'Unreliable Wi-Fi during online assessments',
    area: 'IT, Wi-Fi and LMS',
    reportCount: 34,
    trend: 'increasing',
    priority: 'high',
    owner: 'IT Department',
    status: 'In progress',
    assignment: 'assigned',
    summary:
      'Students report repeated Wi-Fi disconnections during online quizzes and assessments. The problem appears across several departments and has increased during the current assessment period.',
    evidence: [
      { text: 'Wi-Fi disconnects repeatedly during online quizzes.', language: 'en' },
      { text: 'Quiz ke waqt internet bar bar disconnect hota hai.', language: 'roman_ur' },
      { text: 'آن لائن امتحان کے دوران وائی فائی بار بار بند ہو جاتا ہے۔', language: 'ur' },
      { text: 'Online assessment mein Wi-Fi bilkul reliable nahi hai.', language: 'roman_ur' },
    ],
    priorityReasons: [
      '34 related feedback submissions',
      'Reports have increased during the assessment period',
      'The problem affects time-sensitive assessments',
      'Feedback appears across three departments',
    ],
    aiSuggestion: {
      unit: 'IT Department',
      support: 'Examination Office',
      step: 'Review peak-hour network capacity and access-point performance during scheduled online assessments.',
    },
  },
  {
    id: 'p2',
    title: 'Overlapping assignment deadlines',
    area: 'Academic programmes',
    reportCount: 28,
    trend: 'increasing',
    priority: 'high',
    owner: 'Not assigned',
    status: 'Unassigned',
    assignment: 'unassigned',
    summary:
      'Students from multiple programmes report that assignment deadlines cluster in the same week, causing excessive workload and reduced quality of submissions.',
    evidence: [
      { text: 'Three assignments due in the same week — impossible to do well.', language: 'en' },
      { text: 'Deadlines overlap karte hain, pressure bohot hota hai.', language: 'roman_ur' },
    ],
    priorityReasons: [
      '28 related feedback submissions',
      'Increasing trend during the current semester',
      'Affects academic performance across programmes',
    ],
    aiSuggestion: {
      unit: 'Academic Department',
      support: 'Student Affairs',
      step: 'Coordinate deadline calendars across courses and introduce a staggered submission policy.',
    },
  },
  {
    id: 'p3',
    title: 'Insufficient laboratory equipment',
    area: 'Laboratory facilities',
    reportCount: 23,
    trend: 'stable',
    priority: 'high',
    owner: 'Facilities Department',
    status: 'Under review',
    assignment: 'assigned',
    summary:
      'Students in engineering and science labs report that outdated or insufficient equipment hampers practical learning and experiment completion.',
    evidence: [
      { text: 'Lab equipment is outdated — we share one oscilloscope among ten students.', language: 'en' },
      { text: 'Lab mein instruments kam hain, experiment poora nahi hota.', language: 'roman_ur' },
    ],
    priorityReasons: [
      '23 related feedback submissions',
      'Stable but persistent issue',
      'Directly impacts hands-on learning quality',
    ],
    aiSuggestion: {
      unit: 'Facilities Department',
      support: 'Finance Department',
      step: 'Audit current lab inventory and prioritise procurement for high-enrolment courses.',
    },
  },
  {
    id: 'p4',
    title: 'Missing core-course library resources',
    area: 'Library and learning resources',
    reportCount: 18,
    trend: 'improving',
    priority: 'medium',
    owner: 'Library Management',
    status: 'In progress',
    assignment: 'assigned',
    summary:
      'Students cannot access required textbooks or digital resources for several core courses. The library is working on acquiring them.',
    evidence: [
      { text: 'Required textbook is not available in the library or online portal.', language: 'en' },
      { text: 'Kitaab mil nahi rahi library mein.', language: 'roman_ur' },
    ],
    priorityReasons: [
      '18 related feedback submissions',
      'Improving after recent procurement',
      'Affects exam preparation for core courses',
    ],
    aiSuggestion: {
      unit: 'Library Management',
      support: 'Academic Department',
      step: 'Fast-track acquisition of the top-5 requested titles and enable temporary digital access.',
    },
  },
  {
    id: 'p5',
    title: 'Delays in student-record correction',
    area: 'Student records',
    reportCount: 14,
    trend: 'stable',
    priority: 'medium',
    owner: 'Not assigned',
    status: 'Unassigned',
    assignment: 'unassigned',
    summary:
      'Students report long delays in correcting errors in their academic records, affecting transcript requests and scholarship applications.',
    evidence: [
      { text: 'I waited three weeks for a grade correction on my transcript.', language: 'en' },
      { text: 'Record correction mein bohot time lagta hai.', language: 'roman_ur' },
    ],
    priorityReasons: [
      '14 related feedback submissions',
      'Stable recurring issue',
      'Blocks scholarship and transcript processes',
    ],
    aiSuggestion: {
      unit: 'Student Affairs',
      support: 'University Administration',
      step: 'Introduce a tracked online correction request system with a defined SLA.',
    },
  },
]

const DEMO_DISTRIBUTIONS: DemoDistribution[] = [
  { label: 'Courses and Teaching', percent: 31, count: 212 },
  { label: 'IT, Wi-Fi and LMS', percent: 21, count: 144 },
  { label: 'Assessments and Examinations', percent: 18, count: 123 },
  { label: 'Laboratories and Facilities', percent: 14, count: 96 },
  { label: 'Library and Learning Resources', percent: 9, count: 62 },
]

const DEMO_ACTIVITIES: DemoActivity[] = [
  { id: 'ac1', title: 'Review peak-hour access-point capacity', status: 'In progress', meta: 'IT Department · Due 29 August' },
  { id: 'ac2', title: 'Purchase additional lab equipment', status: 'Under review', meta: 'Facilities Department · Due 5 September' },
  { id: 'ac3', title: 'Add requested digital library resources', status: 'Completed', meta: 'Library Management · Completed 20 August' },
]

type AdminFilter = 'all' | 'high' | 'medium' | 'unassigned'

const FILTER_OPTIONS: { value: AdminFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'unassigned', label: 'Unassigned' },
]

/** Status badge colour class for admin action statuses. */
function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'in progress':
      return 'bg-soft-teal text-success'
    case 'under review':
      return 'bg-soft-amber text-[#8A5A16]'
    case 'completed':
      return 'bg-soft-teal text-success'
    case 'unassigned':
      return 'bg-soft-red text-danger'
    case 'assigned':
      return 'bg-soft-blue text-ocean'
    default:
      return 'bg-soft-blue text-ocean'
  }
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [priorityFilter, setPriorityFilter] = useState<AdminFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<DemoProblem | null>(null)
  const [underReview, setUnderReview] = useState(false)
  const [actionFormOpen, setActionFormOpen] = useState(false)
  const [activities, setActivities] = useState<DemoActivity[]>(DEMO_ACTIVITIES)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Admin action form state
  const [formDept, setFormDept] = useState('')
  const [formStatus, setFormStatus] = useState('Assigned')
  const [formTitle, setFormTitle] = useState('')
  const [formPerson, setFormPerson] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formStudentUpdate, setFormStudentUpdate] = useState('')

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastOpen(true)
  }, [])

  const filteredProblems = DEMO_PROBLEMS.filter((p) => {
    let matchFilter: boolean
    if (priorityFilter === 'all') matchFilter = true
    else if (priorityFilter === 'unassigned') matchFilter = p.assignment === 'unassigned'
    else matchFilter = p.priority === priorityFilter

    const haystack = `${p.title} ${p.area}`.toLowerCase()
    const matchSearch = haystack.includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const openDialog = useCallback((issue: DemoProblem) => {
    setSelectedIssue(issue)
    setUnderReview(false)
    setActionFormOpen(false)
    setFormDept('')
    setFormStatus('Assigned')
    setFormTitle('Review peak-hour network capacity')
    setFormPerson('')
    setFormDeadline('')
    setFormNote('')
    setFormStudentUpdate(
      'The university is reviewing this issue. It has been assigned to the relevant department.',
    )
  }, [])

  const closeDialog = useCallback(() => {
    setSelectedIssue(null)
    setActionFormOpen(false)
  }, [])

  const handleMarkReview = useCallback(() => {
    setUnderReview(true)
    showToast('Issue status changed to Under Review.')
  }, [showToast])

  const handleActionSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const newActivity: DemoActivity = {
        id: `ac${Date.now()}`,
        title: formTitle,
        status: formStatus,
        meta: `${formDept} · Owner: ${formPerson} · Deadline: ${formDeadline}`,
      }
      setActivities((prev) => [newActivity, ...prev])
      setActionFormOpen(false)
      showToast('Action assigned successfully. The student-facing update is ready to publish.')
      setTimeout(closeDialog, 1000)
    },
    [formTitle, formStatus, formDept, formPerson, formDeadline, showToast, closeDialog],
  )

  return (
    <>
      {/* ── Demo banner ── */}
      <div className="mb-4 rounded-lg border border-amber-300 bg-soft-amber px-4 py-2 text-center text-sm font-semibold text-warning">
        Demonstration data — synthetic content for UI validation only
      </div>

      {/* ── Metric cards ── */}
      <section className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<FileText className="h-5 w-5" />} label="Total Feedback" value={684} iconBg="bg-soft-blue" iconColour="text-ocean" />
        <MetricCard icon={<Flag className="h-5 w-5" />} label="High-Priority Issues" value={8} iconBg="bg-soft-red" iconColour="text-danger" />
        <MetricCard icon={<Clock className="h-5 w-5" />} label="Under Review" value={17} iconBg="bg-soft-amber" iconColour="text-[#D98200]" />
        <MetricCard icon={<CheckCircle className="h-5 w-5" />} label="Resolved" value={42} iconBg="bg-soft-teal" iconColour="text-teal-dark" />
      </section>

      {/* ── Dashboard grid ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.65fr]">

        {/* ── Priority Institutional Problems ── */}
        <section className="overflow-hidden rounded-xl border border-border bg-white">
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
                {filteredProblems.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer transition-colors hover:bg-[#F7FAF9]"
                    onClick={() => openDialog(p)}
                  >
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                      <span className="font-bold text-ocean">{p.title}</span>
                      <span className="mt-1 block text-[11px] text-muted">{p.area}</span>
                    </td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-[13px]">{p.reportCount}</td>
                    <td className={`border-b border-[#E8E2D9] px-3 py-3.5 text-[13px] font-semibold ${TREND_COLOURS[p.trend]}`}>
                      {TREND_ARROWS[p.trend]} {TREND_LABELS[p.trend]}
                    </td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                      <PriorityBadge level={p.priority} />
                    </td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5 text-[13px]">{p.owner}</td>
                    <td className="border-b border-[#E8E2D9] px-3 py-3.5">
                      <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProblems.length === 0 && (
              <p className="py-7 text-center text-muted">No matching institutional problems.</p>
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
          <section className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-[18px]">
              <h3 className="m-0 text-[19px] text-navy">Feedback by Responsible Area</h3>
            </div>
            <div className="grid gap-4 p-5">
              {DEMO_DISTRIBUTIONS.map((d) => (
                <ProgressBar key={d.label} label={d.label} value={d.percent} valueText={`${d.percent}% · ${d.count}`} />
              ))}
            </div>
          </section>

          {/* ── Institutional AI Summary ── */}
          <section className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-[18px]">
              <h3 className="m-0 text-[19px] text-navy">Institutional AI Summary</h3>
            </div>
            <div className="p-5">
              <div className="rounded-[10px] border border-[#A9DDD7] px-4 py-4" style={{ background: 'linear-gradient(135deg, #F3FBF9, #EAF5F7)' }}>
                <strong className="text-teal-dark">✦ Current institutional insight</strong>
                <p className="mt-2 leading-relaxed text-text">
                  Wi-Fi disruption during time-sensitive online assessments is the fastest-growing operational problem.
                  Reports appear across three academic departments and require coordinated review by IT and examination services.
                </p>
                <button
                  type="button"
                  className="font-bold text-teal-dark hover:underline"
                  onClick={() => openDialog(DEMO_PROBLEMS[0])}
                >
                  Review evidence →
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ── Recent Action Activity (full-width row) ── */}
        <section className="overflow-hidden rounded-xl border border-border bg-white xl:col-span-2">
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
            {activities.map((a) => (
              <div key={a.id} className="rounded-[9px] border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{a.title}</strong>
                  <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-bold ${statusBadgeClass(a.status)}`}>
                    {a.status}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{a.meta}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Issue Detail Dialog ── */}
      <OverlayDialog
        open={!!selectedIssue}
        onClose={closeDialog}
        title={selectedIssue?.title ?? ''}
        subtitle="Institutional problem cluster"
        maxWidth="min(820px, 100%)"
        footer={
          <>
            <button
              type="button"
              disabled={underReview}
              onClick={handleMarkReview}
              className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-bold text-ocean transition-colors hover:bg-ivory disabled:opacity-60"
            >
              {underReview ? '✓ Under Review' : 'Mark Under Review'}
            </button>
            <button
              type="button"
              onClick={() => setActionFormOpen((v) => !v)}
              className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark"
            >
              {actionFormOpen ? 'Close Form' : 'Assign Action'}
            </button>
          </>
        }
      >
        {selectedIssue && (
          <div className="space-y-5">
            {/* Summary */}
            <p className="leading-relaxed text-text">{selectedIssue.summary}</p>

            {/* Summary grid — 4 columns */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Related feedback</small>
                <strong className="mt-1 block">{selectedIssue.reportCount} reports</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Affected areas</small>
                <strong className="mt-1 block">3 departments</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Trend</small>
                <strong className={`mt-1 block ${TREND_COLOURS[selectedIssue.trend]}`}>{TREND_LABELS[selectedIssue.trend]}</strong>
              </div>
              <div className="rounded-lg bg-soft-blue p-3">
                <small className="text-muted">Priority</small>
                <strong className={`mt-1 block ${selectedIssue.priority === 'high' ? 'text-danger' : selectedIssue.priority === 'medium' ? 'text-warning' : 'text-success'}`}>
                  {PRIORITY_LABELS[selectedIssue.priority]}
                </strong>
              </div>
            </div>

            {/* Evidence */}
            <h4 className="text-ocean">Supporting multilingual evidence</h4>
            {selectedIssue.evidence.map((ev, i) => (
              <EvidenceQuote key={i} text={ev.text} language={ev.language} />
            ))}

            {/* Priority reasons */}
            <PriorityReasons reasons={selectedIssue.priorityReasons} />

            {/* AI suggestion */}
            <div>
              <h4 className="mb-2 text-ocean">AI-suggested routing and response</h4>
              <div className="rounded-[9px] bg-soft-teal p-3.5 leading-relaxed text-text">
                <strong>Suggested responsible unit:</strong> {selectedIssue.aiSuggestion.unit}
                <br /><br />
                <strong>Suggested supporting unit:</strong> {selectedIssue.aiSuggestion.support}
                <br /><br />
                <strong>Suggested next step:</strong> {selectedIssue.aiSuggestion.step}
                <br /><br />
                <span className="text-muted">
                  These are AI-generated suggestions. Final assignment and action decisions must be made by authorised staff.
                </span>
              </div>
            </div>

            {/* Action form (toggle) */}
            {actionFormOpen && (
              <form className="grid gap-3 rounded-[10px] border border-border p-4" onSubmit={handleActionSubmit}>
                <strong className="text-navy">Assign institutional action</strong>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Responsible department */}
                  <label className="grid gap-1.5 text-[13px] font-bold">
                    Responsible department
                    <select
                      required
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                      className="w-full rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    >
                      <option value="">Select responsible department</option>
                      {ADMIN_DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </label>

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

                  {/* Student-facing update (full width) */}
                  <label className="grid gap-1.5 text-[13px] font-bold sm:col-span-2">
                    Student-facing update
                    <textarea
                      value={formStudentUpdate}
                      onChange={(e) => setFormStudentUpdate(e.target.value)}
                      placeholder="Write the update students will be allowed to see…"
                      className="min-h-[90px] w-full resize-y rounded-lg border border-[#C9D2D5] p-2.5 text-sm font-normal outline-none focus:border-teal"
                    />
                  </label>
                </div>

                <button type="submit" className="rounded-lg bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-dark">
                  Save and Assign Action
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
