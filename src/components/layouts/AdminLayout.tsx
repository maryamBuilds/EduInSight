import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { SearchInput } from '../SearchInput'
import { PeriodSelector } from '../PeriodSelector'

/**
 * Dashboard layout for admin routes.
 *
 * Responsive behaviour:
 * - Mobile (<768px): single column, hamburger opens a navigation drawer.
 * - Tablet (≥768px): 78px icon-only sidebar + content.
 * - Desktop (≥1024px): 260px sidebar with labels + content.
 *
 * Placeholder user data will be replaced by real auth context in Stage 4.
 */
export function AdminLayout() {
  const fullName = 'Admin User'
  const subtitle = 'Demo University · Institutional feedback intelligence'

  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('Last 30 days')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen, closeDrawer])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (!drawerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [drawerOpen])

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[78px_1fr] lg:grid-cols-[260px_1fr]">
      {/* Desktop / tablet sidebar */}
      <Sidebar role="admin" fullName={fullName} />

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <Sidebar
            role="admin"
            fullName={fullName}
            mobile
            onNavigate={closeDrawer}
            onClose={closeDrawer}
          />
        </>
      )}

      <section className="min-w-0">
        <Topbar
          greeting="Administration Overview"
          subtitle={subtitle}
          avatarName={fullName}
          onMenuClick={openDrawer}
          menuExpanded={drawerOpen}
          menuControlsId="mobile-nav-admin"
          actions={
            <div className="flex items-center gap-2.5">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search problem or area..."
                className="w-[230px] max-md:hidden"
              />
              <PeriodSelector
                value={period}
                onChange={setPeriod}
                options={['Last 7 days', 'Last 30 days', 'This semester']}
              />
            </div>
          }
        />
        <div className="mx-auto max-w-[1500px] px-8 py-6 max-md:p-4">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
