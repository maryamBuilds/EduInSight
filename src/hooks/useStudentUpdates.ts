import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { PublishedActionUpdate } from '@/lib/types'

const CHANGE_EVENT = 'eduinsight:student-notifications-changed'

function storageKey(userId: string) {
  return `eduinsight:read-updates:${userId}`
}

function getReadIds(userId?: string) {
  if (!userId) return new Set<string>()
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(userId)) ?? '[]')
    return new Set<string>(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function uniqueUpdates(rows: PublishedActionUpdate[]) {
  const byId = new Map<string, PublishedActionUpdate>()
  rows.forEach((row) => {
    if (!byId.has(row.id)) byId.set(row.id, row)
  })
  return [...byId.values()]
}

export function useStudentUpdates() {
  const { user } = useAuth()
  const userId = user?.id
  const [updates, setUpdates] = useState<PublishedActionUpdate[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds(userId))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await supabase
      .from('published_action_updates')
      .select('*')
      .order('published_at', { ascending: false })

    if (result.error) {
      setError('Published updates could not be loaded. Please try again.')
    } else {
      setUpdates(uniqueUpdates((result.data ?? []) as PublishedActionUpdate[]))
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)
    const refresh = () => setReadIds(getReadIds(userId))
    const refreshOnFocus = () => void load()
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearTimeout(request)
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [load, userId])

  useEffect(() => {
    const request = window.setTimeout(() => setReadIds(getReadIds(userId)), 0)
    return () => window.clearTimeout(request)
  }, [userId])

  const saveReadIds = useCallback((next: Set<string>) => {
    if (!userId) return
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...next]))
    setReadIds(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [userId])

  const markRead = useCallback((updateId: string) => {
    const next = getReadIds(userId)
    next.add(updateId)
    saveReadIds(next)
  }, [saveReadIds, userId])

  const markAllRead = useCallback(() => {
    const next = getReadIds(userId)
    updates.forEach((update) => next.add(update.id))
    saveReadIds(next)
  }, [saveReadIds, updates, userId])

  const unreadCount = useMemo(
    () => updates.filter((update) => !readIds.has(update.id)).length,
    [readIds, updates],
  )

  return { updates, readIds, unreadCount, loading, error, reload: load, markRead, markAllRead }
}
