import { Outlet } from 'react-router-dom'
import { BarChart3, CircleCheckBig, MessageSquareText, TrendingUp } from 'lucide-react'
import { Logo } from '../Logo'

/**
 * Split layout for authentication pages (login, register, forgot-password).
 *
 * - Left panel: navy gradient with product message, logo, and language note.
 * - Right panel: ivory background with centred form card.
 *
 * Matches the login_wireframe.html visual design.
 * Child routes render via <Outlet /> in the right panel.
 */
export function AuthLayout() {
  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[45%_55%]">
      {/* Left — brand panel */}
      <section
        className="flex flex-col px-12 py-12 max-md:min-h-[430px] max-md:border-b-2 max-md:border-border md:border-r md:border-border"
        style={{
          background: `
            radial-gradient(circle at 15% 15%, rgba(118,199,192,0.16), transparent 32%),
            linear-gradient(145deg, #0B1F33 0%, #12344D 100%)
          `,
        }}
      >
        <Logo className="text-white" />

        <div className="mx-auto my-auto max-w-[520px] text-center">
          <h1 className="mb-[18px] text-[40px] leading-[1.2] text-white max-md:text-[30px]">
            Student voice. Clear insight.
            <span className="block text-[#18D0C2]">Visible action.</span>
          </h1>
          <p className="text-[18px] leading-[1.6] text-[#D6E3E8]">
            EduInSight converts multilingual student feedback into
            evidence-backed academic and institutional improvements.
          </p>

          {/* Process flow */}
          <div className="mt-[45px] flex items-start justify-center gap-3 max-sm:gap-1">
            {([
              ['Feedback', MessageSquareText],
              ['Insight', BarChart3],
              ['Action', CircleCheckBig],
              ['Progress', TrendingUp],
            ] as const).map(([step, Icon], i) => (
              <span key={step} className="flex items-center gap-3 max-sm:gap-1">
                <span className="grid min-w-[82px] justify-items-center gap-3 text-sm font-semibold text-white max-sm:min-w-[65px]">
                  <span className="grid h-16 w-16 place-items-center rounded-full border border-aqua/50 bg-white/[0.04] text-[#18D0C2] max-sm:h-12 max-sm:w-12">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  {step}
                </span>
                {i < 3 && <span className="mt-6 text-aqua/60">→</span>}
              </span>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-[#C4D9DF]">
          English · Urdu · Roman Urdu · Mixed Urdu–English
        </p>
      </section>

      {/* Right — form panel */}
      <section className="grid place-items-center bg-ivory px-10 py-10 max-md:px-4 max-md:py-6">
        <div className="w-full max-w-[500px]">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
