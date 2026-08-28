import { useState, useCallback, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { getTimeGreeting } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useStudentUpdates } from '@/hooks/useStudentUpdates'

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
  const { profile } = useAuth()
  const location = useLocation()
  const { unreadCount } = useStudentUpdates()
  const fullName = profile?.full_name ?? 'Student'
  const displayName = fullName.trim().split(/\s+/)[0] || 'Student'
  const subtitle = [profile?.programme, profile?.study_stage]
    .filter(Boolean)
    .join(' · ') || 'Student View'
  const isSubmitPage = location.pathname === '/student/submit'
  const isFeedbackHistory = location.pathname === '/student/feedback'
  const isFeedbackDetail = location.pathname.startsWith('/student/feedback/')
  const isUpdatesPage = location.pathname === '/student/updates'
  const isNotificationsPage = location.pathname === '/student/notifications'
  const isProfilePage = location.pathname === '/student/profile'
  const pageGreeting = isSubmitPage
    ? 'Submit Feedback'
    : isFeedbackHistory
      ? 'My Feedback'
      : isFeedbackDetail
        ? 'Feedback Details'
        : isUpdatesPage
          ? 'University Updates'
          : isNotificationsPage
            ? 'Notifications'
            : isProfilePage
              ? 'My Profile'
        : `${getTimeGreeting()}, ${displayName}`
  const pageSubtitle = isSubmitPage
    ? 'Help your university understand what needs attention.'
    : isFeedbackHistory
      ? 'Track your submissions and approved responses.'
      : isFeedbackDetail
        ? 'Review your original feedback and its progress.'
        : isUpdatesPage
          ? 'View approved responses and action announcements.'
          : isNotificationsPage
            ? 'See new responses connected to your feedback.'
            : isProfilePage
              ? 'Review your student account and educational details.'
        : subtitle

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
          greeting={pageGreeting}
          subtitle={pageSubtitle}
          avatarName={fullName}
          avatarHref="/student/profile"
          notificationCount={unreadCount}
          notificationHref="/student/notifications"
          actions={isSubmitPage ? (
            <Link
              to="/student"
              className="hidden items-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 font-semibold text-ocean hover:bg-gray-50 sm:flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Dashboard
            </Link>
          ) : undefined}
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
