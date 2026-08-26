import { Outlet } from 'react-router-dom'
import { Logo } from '../Logo'

/**
 * Centred card layout for minimal pages (404, unauthorised, etc.).
 *
 * Displays the logo and an <Outlet /> card on an ivory background.
 */
export function MinimalLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-4">
      <Logo className="mb-8 text-navy" />
      <div className="w-full max-w-[480px] rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <Outlet />
      </div>
    </div>
  )
}
