import { Outlet } from 'react-router-dom'
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
            Student voice. Clear insight. Visible action.
            <span className="mx-auto mt-[22px] block h-1 w-[75px] rounded-full bg-teal" />
          </h1>
          <p className="text-[18px] leading-[1.6] text-[#D6E3E8]">
            EduInSight converts multilingual student feedback into
            evidence-backed academic and institutional improvements.
          </p>

          {/* Process flow */}
          <div className="mt-[45px] flex items-center justify-center gap-3">
            {['Feedback', 'Insight', 'Action', 'Update'].map((step, i) => (
              <span key={step} className="flex items-center gap-3">
                <span className="min-w-[85px] rounded-lg border border-aqua/[0.55] bg-white/[0.07] px-2 py-3 text-sm font-bold text-white">
                  {step}
                </span>
                {i < 3 && <span className="text-aqua">→</span>}
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
