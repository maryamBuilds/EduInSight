import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { getTimeGreeting } from '@/lib/utils'

/**
 * Dashboard layout for student routes.
 *
 * Responsive behaviour:
 * - Mobile (<768px): single column, hamburger opens a navigation drawer.
 * - Tablet (≥768px): 78px icon-only sidebar + content.
 * - Desktop (≥1024px): 255px sidebar with labels + content.
 *
 * Placeholder user data will be replaced by real auth context in Stage 4.
 */
export function StudentLayout() {
  const fullName = 'Sajda Maryam'
  const subtitle = 'BS Computer Science · Semester 3'

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
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[78px_1fr] lg:grid-cols-[255px_1fr]">
      {/* Desktop / tablet sidebar */}
      <Sidebar role="student" fullName={fullName} />

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <Sidebar
            role="student"
            fullName={fullName}
            mobile
            onNavigate={closeDrawer}
            onClose={closeDrawer}
          />
        </>
      )}

      <section className="min-w-0">
        <Topbar
          greeting={`${getTimeGreeting()}, S. Maryam`}
          subtitle={subtitle}
          avatarName={fullName}
          notificationCount={3}
          onMenuClick={openDrawer}
          menuExpanded={drawerOpen}
          menuControlsId="mobile-nav-student"
        />
        <div className="px-[30px] py-6 max-md:p-4">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
