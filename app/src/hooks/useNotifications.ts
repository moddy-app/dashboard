import { useCallback, useEffect, useRef, useState } from 'react'

import { logger } from '@/lib/logger'
import {
  getReadState,
  isRead,
  markAllRead as persistAllRead,
  markRead as persistRead,
} from '@/lib/notification-read-state'
import { getNotifications } from '@/services/notifications'
import type { NotificationItem } from '@/types/notifications'

const PAGE_SIZE = 25

export interface InboxNotification extends NotificationItem {
  /** Dérivé de l'état local : le système n'a pas d'accusé de lecture côté API. */
  read: boolean
}

export interface NotificationsState {
  notifications: InboxNotification[]
  loading: boolean
  /** Chargement d'une page supplémentaire (le reste de la liste reste visible). */
  loadingMore: boolean
  /** Message d'erreur, seulement quand rien n'a pu être affiché. */
  error: string | null
  hasMore: boolean
  unreadCount: number
  refresh: () => void
  loadMore: () => void
  markRead: (id: string) => void
  markAllRead: () => void
}

/**
 * Boîte de réception du compte connecté. Pagination **keyset** (`before`), pas
 * d'`OFFSET` : l'index `(recipient_id, created_at DESC)` la rend constante à
 * n'importe quelle profondeur.
 *
 * Un échec ne vide jamais la liste déjà affichée — une notification lue reste
 * lisible même quand l'API tombe.
 */
export function useNotifications(): NotificationsState {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [readState, setReadState] = useState(() => getReadState())
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Une requête en vol à la fois : le tiroir peut être rouvert plusieurs fois
  // pendant qu'une page arrive, et deux réponses concurrentes se marcheraient
  // dessus (celle qui arrive en dernier n'est pas forcément la plus récente).
  const inflight = useRef(false)

  const fetchPage = useCallback(async (before: string | null) => {
    if (inflight.current) return
    inflight.current = true
    const append = before !== null
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const page = await getNotifications({ limit: PAGE_SIZE, before })
      setItems((prev) => {
        if (!append) return page.items
        // Dédoublonne : une notification arrivée entre deux pages décale le
        // curseur et peut se présenter deux fois.
        const seen = new Set(prev.map((n) => n.id))
        return [...prev, ...page.items.filter((n) => !seen.has(n.id))]
      })
      setCursor(page.next)
      setError(null)
      setLoaded(true)
    } catch (e) {
      logger.error('notifications', 'could not load the inbox', e)
      setError(e instanceof Error ? e.message : String(e))
      setLoaded(true)
    } finally {
      inflight.current = false
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (loaded) return
    void fetchPage(null)
  }, [loaded, fetchPage])

  const refresh = useCallback(() => {
    setCursor(null)
    void fetchPage(null)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!cursor) return
    void fetchPage(cursor)
  }, [cursor, fetchPage])

  const markRead = useCallback((id: string) => {
    setReadState(persistRead(id))
  }, [])

  const markAllRead = useCallback(() => {
    setReadState(persistAllRead())
  }, [])

  const notifications: InboxNotification[] = items.map((item) => ({
    ...item,
    read: isRead(readState, item.id, item.created_at),
  }))

  return {
    notifications,
    loading: loading && items.length === 0,
    loadingMore,
    error: items.length === 0 ? error : null,
    hasMore: cursor !== null,
    unreadCount: notifications.filter((n) => !n.read).length,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  }
}
