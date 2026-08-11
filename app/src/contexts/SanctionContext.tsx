import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@/lib/auth'
import { getViolationStatus, getViolations } from '@/services/violations'
import {
  effectiveStatus,
  guildLevelsFromGroups,
  levelRank,
  noSanction,
  SANCTION_REFRESH_EVENT,
} from '@/lib/sanctions'
import { logger } from '@/lib/logger'
import type {
  SanctionLevel,
  SubjectSanctionStatus,
  ViolationGroup,
} from '@/types/violations'
import { SuspendedScreen } from '@/pages/SuspendedPage'

// Le back-end cache le niveau résolu 60 s : ré-interroger plus souvent ne
// rafraîchirait rien. On aligne le cache client sur cette fenêtre.
const STATUS_TTL_MS = 60_000

interface SanctionContextValue {
  /** Statut du compte connecté (jamais `null` — neutre tant que rien n'est chargé). */
  user: SubjectSanctionStatus
  /** Statut du serveur demandé, `null` tant qu'il n'a pas été chargé. */
  guildStatus: (guildId: string | null | undefined) => SubjectSanctionStatus | null
  /** Niveau connu d'un serveur, dérivé de la liste des infractions à défaut de statut. */
  guildLevel: (guildId: string | null | undefined) => SanctionLevel
  /** Déclenche (au besoin) le chargement du statut d'un serveur. */
  ensureGuild: (guildId: string | null | undefined) => void
  /** Recharge le statut du compte, la liste des infractions et un serveur donné. */
  refresh: (guildId?: string | null) => Promise<void>
  /** Groupes d'infractions visibles par l'utilisateur (compte + serveurs). */
  groups: ViolationGroup[]
  groupsLoading: boolean
  /**
   * Le staff n'est jamais bloqué par l'API : afficher un verrou lui donnerait
   * une UI plus restrictive que le back-end.
   */
  isExempt: boolean
}

const SanctionContext = createContext<SanctionContextValue | null>(null)

interface SanctionProviderProps {
  user: User
  children: ReactNode
}

export function SanctionProvider({ user, children }: SanctionProviderProps) {
  const isExempt = user.is_staff === true

  const [userStatus, setUserStatus] = useState<SubjectSanctionStatus>(
    () => user.sanction ?? noSanction('discord_user', user.user_id)
  )
  const [guildStatuses, setGuildStatuses] = useState<Record<string, SubjectSanctionStatus>>({})
  const [groups, setGroups] = useState<ViolationGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)

  // Dernier chargement par sujet — évite les rafales quand plusieurs composants
  // demandent le même serveur, et respecte la fenêtre de cache du back-end.
  const fetchedAt = useRef<Map<string, number>>(new Map())
  const inflight = useRef<Set<string>>(new Set())

  const loadStatus = useCallback(
    async (guildId?: string | null, force = false) => {
      const key = guildId ? `guild:${guildId}` : 'user'
      const last = fetchedAt.current.get(key) ?? 0
      if (!force && Date.now() - last < STATUS_TTL_MS) return
      if (inflight.current.has(key)) return
      inflight.current.add(key)
      try {
        const status = await getViolationStatus(guildId ?? undefined)
        fetchedAt.current.set(key, Date.now())
        setUserStatus(status.user)
        const guildStatus = status.guild
        if (guildId && guildStatus) {
          setGuildStatuses((prev) => ({ ...prev, [String(guildId)]: guildStatus }))
        }
      } catch (e) {
        // Un échec ici ne doit jamais casser le dashboard : sans statut, l'UI
        // reste ouverte et le back-end fait foi via ses 403.
        logger.warn('sanctions', `Failed to load status${guildId ? ` for guild ${guildId}` : ''}`, e)
      } finally {
        inflight.current.delete(key)
      }
    },
    []
  )

  const loadGroups = useCallback(async () => {
    try {
      const data = await getViolations({ limit: 100 })
      setGroups(data)
    } catch (e) {
      logger.warn('sanctions', 'Failed to load violations list', e)
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  // Chargement initial. `/auth/me` renvoie déjà le statut du compte sous
  // `sanction` : on ne rappelle `/violations/status` que s'il est absent.
  useEffect(() => {
    if (isExempt) {
      setGroupsLoading(false)
      return
    }
    if (user.sanction === undefined) void loadStatus()
    else fetchedAt.current.set('user', Date.now())
    void loadGroups()
  }, [isExempt, user.sanction, loadStatus, loadGroups])

  // Un 403 de sanction (émis par `showSanctionToast`) veut dire que notre statut
  // est périmé : on le recharge en forçant, sans attendre la fenêtre de 60 s.
  useEffect(() => {
    if (isExempt) return
    const handler = () => void loadStatus(undefined, true)
    window.addEventListener(SANCTION_REFRESH_EVENT, handler)
    return () => window.removeEventListener(SANCTION_REFRESH_EVENT, handler)
  }, [isExempt, loadStatus])

  const ensureGuild = useCallback(
    (guildId: string | null | undefined) => {
      if (!guildId || isExempt) return
      void loadStatus(String(guildId))
    },
    [isExempt, loadStatus]
  )

  const refresh = useCallback(
    async (guildId?: string | null) => {
      if (isExempt) return
      await Promise.all([loadStatus(guildId ?? undefined, true), loadGroups()])
    },
    [isExempt, loadStatus, loadGroups]
  )

  const guildLevels = useMemo(() => guildLevelsFromGroups(groups), [groups])

  const value = useMemo<SanctionContextValue>(() => {
    const neutral = noSanction('discord_user', user.user_id)
    const resolvedUser = isExempt ? neutral : userStatus

    const guildStatus = (guildId: string | null | undefined) =>
      guildId && !isExempt ? guildStatuses[String(guildId)] ?? null : null

    const guildLevel = (guildId: string | null | undefined): SanctionLevel => {
      if (!guildId || isExempt) return 'none'
      const status = guildStatuses[String(guildId)]
      if (status) return status.level
      return guildLevels.get(String(guildId)) ?? 'none'
    }

    return {
      user: resolvedUser,
      guildStatus,
      guildLevel,
      ensureGuild,
      refresh,
      groups,
      groupsLoading,
      isExempt,
    }
  }, [
    user.user_id,
    isExempt,
    userStatus,
    guildStatuses,
    guildLevels,
    ensureGuild,
    refresh,
    groups,
    groupsLoading,
  ])

  // Compte suspendu → écran dédié, jamais un dashboard grisé : tous les autres
  // appels renverraient 403 de toute façon.
  if (!isExempt && userStatus.suspended) {
    return (
      <SanctionContext.Provider value={value}>
        <SuspendedScreen status={userStatus} user={user} />
      </SanctionContext.Provider>
    )
  }

  return <SanctionContext.Provider value={value}>{children}</SanctionContext.Provider>
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSanctions(): SanctionContextValue {
  const ctx = useContext(SanctionContext)
  if (!ctx) throw new Error('useSanctions must be used within SanctionProvider')
  return ctx
}

/** Statut du serveur (chargé à la demande). */
export function useGuildSanction(guildId: string | null | undefined): SubjectSanctionStatus | null {
  const { guildStatus, ensureGuild } = useSanctions()
  useEffect(() => {
    ensureGuild(guildId)
  }, [guildId, ensureGuild])
  return guildStatus(guildId)
}

export interface SanctionGates {
  /** Statut du compte. */
  user: SubjectSanctionStatus
  /** Statut du serveur (peut être `null` tant qu'il n'est pas chargé). */
  guild: SubjectSanctionStatus | null
  /** Le plus sévère des deux — ce qui s'applique à une action dans ce serveur. */
  effective: SubjectSanctionStatus
  /** Souscrire à Moddy Max / lier un serveur à l'abonnement. */
  canSubscribe: boolean
  /** Lier **ce** serveur à l'abonnement. */
  canLinkGuild: boolean
  /** Activer un module qui n'existe pas encore sur ce serveur. */
  canEnableNewModule: boolean
  /** Écrire sur `automod_ai` — suit le **serveur**, jamais l'utilisateur. */
  canWriteAutomod: boolean
  /** Le serveur est suspendu : plus rien n'est accessible dessus. */
  guildSuspended: boolean
}

/**
 * Les verrous d'interface, dans un seul objet. Règle d'or : on teste
 * `restricted` (vrai pour `limited` **et** `suspended`), jamais `level`, et un
 * `warn` ne verrouille jamais rien.
 */
export function useSanctionGates(guildId?: string | null): SanctionGates {
  const { user, isExempt, guildLevel } = useSanctions()
  const guild = useGuildSanction(guildId)

  return useMemo(() => {
    const effective = effectiveStatus(user, guild) ?? user
    // Tant que le statut détaillé du serveur n'est pas chargé, la liste des
    // infractions donne déjà son niveau : on ne laisse pas une fenêtre où un
    // serveur suspendu paraîtrait sain.
    const knownGuildLevel = guild?.level ?? guildLevel(guildId)
    const guildRestricted = !isExempt && levelRank(knownGuildLevel) >= levelRank('limited')
    const guildSuspended = !isExempt && knownGuildLevel === 'suspended'
    const userRestricted = !isExempt && user.restricted

    return {
      user,
      guild,
      effective,
      canSubscribe: !userRestricted,
      canLinkGuild: !userRestricted && !guildRestricted,
      canEnableNewModule: !userRestricted && !guildRestricted,
      canWriteAutomod: !guildRestricted,
      guildSuspended,
    }
  }, [user, guild, guildId, guildLevel, isExempt])
}
