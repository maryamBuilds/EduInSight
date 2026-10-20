import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CircleCheckBig,
  EyeOff,
  Languages,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UsersRound,
} from 'lucide-react'
import { Logo } from '@/components/Logo'

/**
 * Public landing page shown at "/" to signed-out visitors.
 *
 * Explains the problem EduInSight addresses and the feedback → insight →
 * action → progress journey before asking anyone to sign in. Every sample
 * quote and record on this page is labelled as illustrative; no real
 * submissions or institutional figures are shown.
 */

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-[9px] bg-teal-dark px-6 py-3.5 font-bold text-white shadow-[0_8px_20px_rgba(42,157,143,0.22)] transition-all hover:-translate-y-px hover:bg-ocean focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-aqua/60'
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-[9px] border border-white/40 px-6 py-3.5 font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-aqua/60'

const PROBLEMS = [
  {
    icon: EyeOff,
    title: 'Students never see what happened',
    text: 'End-of-semester forms disappear into a spreadsheet. Without a visible response, students stop believing feedback changes anything.',
  },
  {
    icon: Languages,
    title: 'Real feedback is multilingual',
    text: 'Students explain problems best in Urdu, Roman Urdu or a mix with English. English-only forms and keyword tools lose that meaning.',
  },
  {
    icon: UsersRound,
    title: 'Staff cannot read every comment',
    text: 'Hundreds of free-text answers arrive at once, with no grouping, no priority and no clear owner for each issue.',
  },
]

const STEPS = [
  {
    icon: MessageSquareText,
    title: 'Feedback',
    text: 'A student describes a concern in their own words and language. The original text is always kept.',
  },
  {
    icon: BarChart3,
    title: 'Insight',
    text: 'AI suggests the theme, urgency and similar concerns. Staff review every suggestion before acting on it.',
  },
  {
    icon: CircleCheckBig,
    title: 'Action',
    text: 'The responsible teacher or office owns an action with a status and a deadline, linked to the evidence.',
  },
  {
    icon: TrendingUp,
    title: 'Progress',
    text: 'Students who raised the concern receive the update, so they can see the result of speaking up.',
  },
]

const COMPARISON: [string, string, string][] = [
  ['Language', 'Usually English-only questions', 'English, Urdu, Roman Urdu and mixed text, original words kept'],
  ['Many responses', 'One long spreadsheet to read', 'Similar concerns grouped with the quotes behind them'],
  ['Ownership', 'No one is assigned', 'Each action has an owner, a status and a deadline'],
  ['Closing the loop', 'Students hear nothing back', 'Updates reach the students who raised the concern'],
  ['Privacy', 'Everyone with the sheet sees everything', 'Anonymous by default, staff see only their own scope'],
]

const EXAMPLES = [
  { language: 'English', text: 'The lab computers keep freezing during practical sessions.', dir: 'ltr' },
  { language: 'Urdu', text: 'لیکچر کی رفتار بہت تیز ہے، مثالیں زیادہ دی جائیں۔', dir: 'rtl' },
  { language: 'Roman Urdu', text: 'Assignment ki instructions clear nahi thi, deadline se pehle koi jawab nahi mila.', dir: 'ltr' },
  { language: 'Mixed', text: 'Database ka lecture fast hai, please normalization ke examples zyada karein.', dir: 'ltr' },
]

function JourneyPreview() {
  return (
    <div
      className="relative rounded-[18px] border border-white/15 bg-white p-5 text-left shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
      aria-label="Illustrative example of one feedback journey"
    >
      <span className="absolute -top-3 right-5 rounded-full bg-soft-amber px-3 py-1 text-xs font-bold text-[#7A4D0F]">
        Illustrative example
      </span>
      <ol className="grid gap-3">
        <li className="rounded-xl border border-border bg-[#FCFCFA] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">1 · Students write, each in their own way</p>
          <ul className="mt-2 grid gap-1.5 text-[15px] leading-relaxed text-text">
            <li>“OS aur DBMS ka final ek hi din hai, tayyari kaise karein?”</li>
            <li dir="rtl" lang="ur" className="text-right">“دونوں پیپر ایک ہی دن رکھ دیے گئے ہیں۔”</li>
            <li>“Two finals on the same day again. Nobody is responding.”</li>
          </ul>
          <p className="mt-2 text-xs text-muted">Roman Urdu · Urdu · English · anonymous</p>
        </li>
        <li className="rounded-xl border border-border bg-soft-blue p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-ocean">2 · Staff see one reviewed issue</p>
          <p className="mt-2 font-semibold text-navy">Exam timetable clash · BS CS Semester 5</p>
          <p className="mt-1 text-sm text-text">38 students · 3 languages · grouped with the quotes behind it</p>
        </li>
        <li className="rounded-xl border border-border bg-soft-teal p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-dark">3 · An owned action</p>
          <p className="mt-2 font-semibold text-navy">Reschedule the Operating Systems final</p>
          <p className="mt-1 text-sm text-text">Examination Office · Completed before the timetable was final</p>
        </li>
        <li className="flex items-start gap-3 rounded-xl border border-border bg-white p-4">
          <CircleCheckBig className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-text">
            <strong className="text-navy">4 · Every student who raised it is told</strong>
            <span className="block">“The Operating Systems final has moved to Monday. Your timetable is updated.”</span>
          </p>
        </li>
      </ol>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-ivory text-text">
      {/* Hero */}
      <header
        className="text-white"
        style={{
          background: `
            radial-gradient(circle at 12% 18%, rgba(118,199,192,0.18), transparent 34%),
            linear-gradient(145deg, #0B1F33 0%, #12344D 100%)
          `,
        }}
      >
        <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-5 max-sm:px-4" aria-label="Main">
          <Link to="/" aria-label="EduInSight home" className="rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-aqua/60">
            <Logo className="text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-[9px] px-4 py-2.5 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-aqua/60"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-[9px] bg-white px-4 py-2.5 font-bold text-navy transition-colors hover:bg-ivory focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-aqua/60 max-sm:hidden"
            >
              Sign up
            </Link>
          </div>
        </nav>

        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 pb-20 pt-10 max-sm:px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <p className="mb-4 inline-block rounded-full border border-aqua/40 px-3 py-1 text-sm font-semibold text-[#9FE3DC]">
              Multilingual student feedback for universities
            </p>
            <h1 className="text-[46px] font-bold leading-[1.12] max-md:text-[34px]">
              Student voice. Clear insight.
              <span className="block text-[#18D0C2]">Visible action.</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-[18px] leading-[1.65] text-[#D6E3E8]">
              EduInSight lets students raise a concern in their own language, helps staff understand
              and own it, and shows the student what happened next.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className={primaryButton}>
                Create a student account <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link to="/login" className={secondaryButton}>
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-[#C4D9DF]">
              English · Urdu · Roman Urdu · Mixed Urdu–English
            </p>
          </div>
          <JourneyPreview />
        </div>
      </header>

      <main>
        {/* Problem */}
        <section className="mx-auto max-w-[1180px] px-6 py-16 max-sm:px-4" aria-labelledby="problem-heading">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-dark">The problem</p>
          <h2 id="problem-heading" className="mt-2 max-w-[720px] text-[32px] font-bold leading-tight text-navy max-md:text-[26px]">
            Students give feedback. Very little visibly changes.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-[14px] border border-border bg-white p-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-soft-red text-[#A33545]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-border bg-white" aria-labelledby="how-heading">
          <div className="mx-auto max-w-[1180px] px-6 py-16 max-sm:px-4">
            <p className="text-sm font-bold uppercase tracking-wide text-teal-dark">How it works</p>
            <h2 id="how-heading" className="mt-2 text-[32px] font-bold leading-tight text-navy max-md:text-[26px]">
              One concern, followed from start to finish
            </h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="rounded-[14px] border border-border bg-ivory p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-navy text-[#18D0C2]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-muted">Step {index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-navy">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Comparison with an ordinary form */}
        <section className="mx-auto max-w-[1180px] px-6 py-16 max-sm:px-4" aria-labelledby="compare-heading">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-dark">Why not a regular form?</p>
          <h2 id="compare-heading" className="mt-2 max-w-[720px] text-[32px] font-bold leading-tight text-navy max-md:text-[26px]">
            A form collects answers. EduInSight follows them through.
          </h2>
          <div className="mt-8 overflow-x-auto rounded-[14px] border border-border bg-white" tabIndex={0} role="region" aria-labelledby="compare-heading">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <caption className="sr-only">Comparison of an ordinary feedback form and EduInSight</caption>
              <thead>
                <tr className="bg-navy text-white">
                  <th scope="col" className="px-5 py-3.5 font-semibold"><span className="sr-only">Aspect</span></th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">Ordinary feedback form</th>
                  <th scope="col" className="px-5 py-3.5 font-semibold">EduInSight</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([aspect, form, eduinsight]) => (
                  <tr key={aspect} className="border-t border-border">
                    <th scope="row" className="px-5 py-4 font-bold text-navy">{aspect}</th>
                    <td className="px-5 py-4 text-muted">{form}</td>
                    <td className="px-5 py-4 font-semibold text-text">
                      <span className="flex items-start gap-2">
                        <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        {eduinsight}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Languages */}
        <section className="border-y border-border bg-white" aria-labelledby="language-heading">
          <div className="mx-auto max-w-[1180px] px-6 py-16 max-sm:px-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-teal-dark">Write naturally</p>
                <h2 id="language-heading" className="mt-2 text-[32px] font-bold leading-tight text-navy max-md:text-[26px]">
                  Students write the way they speak
                </h2>
              </div>
              <span className="rounded-full bg-soft-amber px-3 py-1 text-xs font-bold text-[#7A4D0F]">
                Illustrative examples, not real submissions
              </span>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {EXAMPLES.map((example) => (
                <li key={example.language} className="rounded-[14px] border-l-4 border-teal bg-ivory p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{example.language}</p>
                  <p
                    dir={example.dir}
                    lang={example.language === 'Urdu' ? 'ur' : undefined}
                    className={`mt-2 leading-relaxed text-text ${example.dir === 'rtl' ? 'text-right text-lg' : ''}`}
                  >
                    {example.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-[1180px] px-6 py-16 max-sm:px-4" aria-labelledby="roles-heading">
          <p className="text-sm font-bold uppercase tracking-wide text-teal-dark">Who uses it</p>
          <h2 id="roles-heading" className="mt-2 text-[32px] font-bold leading-tight text-navy max-md:text-[26px]">
            Three views, one shared record
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: MessageSquareText, title: 'Students', text: 'Submit feedback, track its status and read updates on actions taken.' },
              { icon: ListChecks, title: 'Teachers', text: 'See feedback for their own sections, grouped by theme, and respond with actions.' },
              { icon: UserCheck, title: 'Administrators', text: 'Review institution-wide issues, assign owners and publish updates to students.' },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-[14px] border border-border bg-white p-6">
                <Icon className="h-6 w-6 text-teal-dark" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold text-navy">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{text}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 flex items-start gap-2 text-sm leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-dark" aria-hidden="true" />
            Anyone can register as a student. Teacher and administrator roles are assigned only by an
            authorised university administrator. AI output is a suggestion that staff review.
          </p>
        </section>

        {/* Closing call to action */}
        <section className="bg-navy text-white" aria-labelledby="cta-heading">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 px-6 py-14 max-sm:px-4">
            <div>
              <h2 id="cta-heading" className="text-[28px] font-bold leading-tight">Have something to say about your studies?</h2>
              <p className="mt-2 text-[#D6E3E8]">Write in your own language. Submissions are anonymous by default.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className={primaryButton}>
                Create a student account <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link to="/login" className={secondaryButton}>
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted max-sm:px-4">
        <Logo className="text-navy" nameClassName="text-lg" />
        <p>Built for multilingual universities.</p>
      </footer>
    </div>
  )
}
