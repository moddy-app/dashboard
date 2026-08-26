import { logger } from '@/lib/logger'

// État « lu / non lu » des notifications.
//
// Les quatre tables du système appartiennent au bot et le guide d'intégration
// interdit d'y ajouter une colonne : il n'existe donc **aucun** accusé de
// lecture côté API. Tant que le back-end n'expose pas de table à lui pour ça,
// l'état de lecture vit dans le navigateur — c'est un confort d'affichage, pas
// une donnée de référence, et il n'a pas à survivre à un changement d'appareil.

const STORAGE_KEY = 'moddy_notifications_read'
/** Au-delà, les plus anciens ids sont oubliés — `readBefore` les couvre déjà. */
const MAX_IDS = 300

interface ReadState {
  /** Tout ce qui est antérieur à cette date est lu (« tout marquer comme lu »). */
  readBefore: string | null
  /** Notifications marquées une par une, plus récentes que `readBefore`. */
  ids: string[]
}

const EMPTY: ReadState = { readBefore: null, ids: [] }

function read(): ReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<ReadState>
    return {
      readBefore: typeof parsed.readBefore === 'string' ? parsed.readBefore : null,
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : [],
    }
  } catch (e) {
    // Mode privé, quota, JSON corrompu : tout est lisible sans état de lecture.
    logger.warn('notifications', 'unreadable read-state, falling back to empty', e)
    return EMPTY
  }
}

function write(state: ReadState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, ids: state.ids.slice(0, MAX_IDS) })
    )
  } catch (e) {
    logger.warn('notifications', 'could not persist read-state', e)
  }
}

export function getReadState(): ReadState {
  return read()
}

/** Une notification est lue si elle est marquée, ou antérieure au « tout lu ». */
export function isRead(state: ReadState, id: string, createdAt: string): boolean {
  if (state.ids.includes(id)) return true
  if (!state.readBefore) return false
  const created = Date.parse(createdAt)
  const before = Date.parse(state.readBefore)
  return Number.isFinite(created) && Number.isFinite(before) && created <= before
}

export function markRead(id: string): ReadState {
  const state = read()
  if (state.ids.includes(id)) return state
  const next: ReadState = { ...state, ids: [id, ...state.ids].slice(0, MAX_IDS) }
  write(next)
  return next
}

/**
 * « Tout marquer comme lu » pose une borne temporelle plutôt que d'énumérer les
 * ids : les pages non encore chargées sont couvertes elles aussi.
 */
export function markAllRead(readBefore: Date = new Date()): ReadState {
  const next: ReadState = { readBefore: readBefore.toISOString(), ids: [] }
  write(next)
  return next
}
