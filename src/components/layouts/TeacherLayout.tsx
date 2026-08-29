import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { useAuth } from '@/context/AuthContext'
import { getTimeGreeting } from '@/lib/utils'

/**
 * Dashboard layout for teacher routes.
 *
 * Responsive behaviour:
 * - Mobile (<768px): single column, hamburger opens a navigation drawer.
 * - Tablet (≥768px): 78px icon-only sidebar + content.
 * - Desktop (≥1024px): 255px sidebar with labels + content.
 *
 */
export function TeacherLayout() {
  const { profile } = useAuth()
  const fullName = profile?.full_name ?? 'Teacher'
  const subtitle = profile?.programme
    ? `${profile.programme} · Teacher feedback workspace`
    : 'Teacher feedback workspace'

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
      <Sidebar role="teacher" fullName={fullName} />

      {/* Mobile navigation drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <Sidebar
            role="teacher"
            fullName={fullName}
            mobile
            onNavigate={closeDrawer}
            onClose={closeDrawer}
          />
        </>
      )}

      <section className="min-w-0">
        <Topbar
          greeting={`${getTimeGreeting()}, ${fullName}`}
          subtitle={subtitle}
          avatarName={fullName}
          onMenuClick={openDrawer}
          menuExpanded={drawerOpen}
          menuControlsId="mobile-nav-teacher"
        />
        <div className="mx-auto max-w-[1500px] px-8 py-6 max-md:p-4">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
