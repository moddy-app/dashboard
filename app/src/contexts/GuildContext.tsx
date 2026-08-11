import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Guild, User } from '@/lib/auth'
import type { GuildDetail, Channel, Role, ModuleConfig, GuildStats, GuildPremium } from '@/types/api'
import {
  getGuildDiscordData,
  getGuild,
  getChannels,
  getRoles,
  getModules,
  getGuildStats,
  getGuildPremium,
  updateModule as apiUpdateModule,
  disableModule as apiDisableModule,
} from '@/services/guilds'
import { ApiError, refreshGuilds as apiRefreshGuilds } from '@/lib/auth'
import { usePremiumGuilds } from '@/hooks/usePremiumGuilds'
import { useSanctions } from '@/contexts/SanctionContext'
import { levelRank, sanctionBlockedError } from '@/lib/sanctions'
import { logger } from '@/lib/logger'

// ─── Types du contexte ────────────────────────────────────────────────────────

interface GuildContextValue {
  // Données globales
  guilds: Guild[]
  user: User
  // Serveur sélectionné
  selectedGuildId: string | null
  selectGuild: (id: string) => void
  // Données du serveur sélectionné
  guildDetail: GuildDetail | null
  channels: Channel[]
  roles: Role[]
  modules: Record<string, ModuleConfig>
  stats: GuildStats | null
  /** Serveur premium (attribut PREMIUM, stats, ou abonnement actif lié). */
  isPremium: boolean
  isLoadingGuild: boolean
  /**
   * `true` seulement quand les données du serveur *sélectionné* ont fini d'être
   * chargées (succès ou échec). Sert de garde aux pages de configuration : tant
   * que c'est `false`, elles ne doivent pas monter leurs formulaires, sinon
   * ceux-ci s'initialisent sur des `channels`/`modules` vides (cas typique :
   * arrivée directe sur l'URL d'un module).
   */
  isGuildReady: boolean
  guildError: string | null
  // Actions
  refreshGuildData: () => Promise<void>
  /** Rafraîchit la liste des guilds depuis Discord puis recharge la page */
  refreshGuildList: () => Promise<void>
  updateModule: (moduleId: string, config: Record<string, unknown>) => Promise<void>
  disableModule: (moduleId: string) => Promise<void>
}

const GuildContext = createContext<GuildContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

interface GuildProviderProps {
  guilds: Guild[]
  user: User
  children: ReactNode
}

export function GuildProvider({ guilds, user, children }: GuildProviderProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // Extrait le guildId depuis l'URL : /servers/:guildId/...
  const urlGuildId =
    location.pathname.match(/^\/servers\/(\d+)/)?.[1] ?? null

  const [selectedGuildId, setSelectedGuildId] = useState<string | null>(urlGuildId)
  const [guildDetail, setGuildDetail] = useState<GuildDetail | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [modules, setModules] = useState<Record<string, ModuleConfig>>({})
  const [stats, setStats] = useState<GuildStats | null>(null)
  const [premium, setPremium] = useState<GuildPremium | null>(null)
  // Démarre à `true` quand l'URL cible déjà un serveur : le chargement est lancé
  // dans un effet, donc sans ça le premier rendu passerait pour « chargé ».
  const [isLoadingGuild, setIsLoadingGuild] = useState(urlGuildId !== null)
  // Dernier serveur dont le chargement est allé au bout (succès ou erreur).
  const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null)
  const [guildError, setGuildError] = useState<string | null>(null)

  // Charge les données du serveur sélectionné
  const loadGuildData = useCallback(async (guildId: string) => {
    logger.event('guild', `Loading data for guild ${guildId}`)
    const start = performance.now()
    setIsLoadingGuild(true)
    setGuildError(null)
    try {
      // Essaie l'endpoint combiné /discord d'abord (guild + channels + roles en 1 appel)
      // Si 404 (guild pas en base), fallback sur les appels séparés
      let guildInfo = null
      let channelList: Channel[] = []
      let roleList: Role[] = []

      try {
        const discordData = await getGuildDiscordData(guildId)
        guildInfo = discordData.guild
        channelList = discordData.channels
        roleList = discordData.roles
      } catch (e) {
        if (e instanceof ApiError && e.isNotFound) {
          logger.warn('guild', `Guild ${guildId} not in DB — falling back to separate calls`)
          // Guild pas en base → on récupère juste les infos de base Discord
          guildInfo = await getGuild(guildId)
          // Channels et roles peuvent ne pas être disponibles non plus
          try {
            [channelList, roleList] = await Promise.all([
              getChannels(guildId),
              getRoles(guildId),
            ])
          } catch (err) {
            logger.warn('guild', `Channels/roles unavailable for ${guildId}`, err)
          }
        } else {
          throw e
        }
      }

      // Modules, stats et premium — pas critiques, on les charge en parallèle
      const [modulesData, statsData, premiumData] = await Promise.allSettled([
        getModules(guildId),
        getGuildStats(guildId),
        getGuildPremium(guildId),
      ])

      if (modulesData.status === 'rejected') logger.warn('guild', `Modules failed for ${guildId}`, modulesData.reason)
      if (statsData.status === 'rejected') logger.warn('guild', `Stats failed for ${guildId}`, statsData.reason)
      if (premiumData.status === 'rejected') logger.warn('guild', `Premium failed for ${guildId}`, premiumData.reason)

      setGuildDetail(guildInfo)
      setChannels(channelList)
      setRoles(roleList)
      const loadedModules = modulesData.status === 'fulfilled' ? (modulesData.value ?? {}) : {}
      setModules(loadedModules)
      setStats(statsData.status === 'fulfilled' ? statsData.value : null)
      setPremium(premiumData.status === 'fulfilled' ? premiumData.value : null)

      const duration = Math.round(performance.now() - start)
      logger.success('guild', `Loaded guild ${guildId} in ${duration}ms`, {
        channels: channelList.length,
        roles: roleList.length,
        modules: Object.keys(loadedModules).length,
        hasStats: statsData.status === 'fulfilled',
      })
    } catch (e) {
      const duration = Math.round(performance.now() - start)
      logger.error('guild', `Failed to load guild ${guildId} after ${duration}ms`, e)
      setGuildError(e instanceof Error ? e.message : 'Failed to load guild data')
      setGuildDetail(null)
      setChannels([])
      setRoles([])
      setModules({})
      setStats(null)
      setPremium(null)
    } finally {
      setLoadedGuildId(guildId)
      setIsLoadingGuild(false)
    }
  }, [])

  // Synchronise le guildId depuis l'URL
  useEffect(() => {
    if (urlGuildId !== selectedGuildId) {
      setSelectedGuildId(urlGuildId)
    }
  }, [urlGuildId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Charge les données quand le guildId change
  useEffect(() => {
    if (selectedGuildId) {
      setIsLoadingGuild(true)
      loadGuildData(selectedGuildId)
    } else {
      setLoadedGuildId(null)
      setGuildDetail(null)
      setChannels([])
      setRoles([])
      setModules({})
      setStats(null)
      setPremium(null)
    }
  }, [selectedGuildId, loadGuildData])

  const selectGuild = useCallback(
    (id: string) => {
      logger.event('guild', `Selecting guild ${id}`)
      setSelectedGuildId(id)
      // Préserve ?debug=true si présent dans l'URL actuelle
      const debugParam = new URLSearchParams(location.search).get('debug')
      const query = debugParam ? `?debug=${debugParam}` : ''
      navigate(`/servers/${id}${query}`)
    },
    [navigate, location.search]
  )

  const refreshGuildData = useCallback(async () => {
    if (selectedGuildId) {
      logger.event('guild', `Manually refreshing guild ${selectedGuildId}`)
      await loadGuildData(selectedGuildId)
    }
  }, [selectedGuildId, loadGuildData])

  const refreshGuildList = useCallback(async () => {
    logger.event('guild', 'Refreshing guild list from Discord')
    try {
      await apiRefreshGuilds()
      logger.success('guild', 'Guild list refreshed — reloading page')
      // Recharge la page pour que useAuth récupère les nouvelles guilds depuis /auth/me
      window.location.href = '/'
    } catch (e) {
      logger.error('guild', 'Guild list refresh failed — reloading anyway', e)
      // Si ça échoue, on recharge quand même pour avoir des données fraîches
      window.location.href = '/'
    }
  }, [])

  // ── Sanctions globales ──────────────────────────────────────────────────
  // Une sanction (compte OU serveur, le plus sévère des deux) interdit
  // *l'activation* d'un module qui n'existe pas encore. Un module déjà
  // configuré reste pleinement modifiable, sous-ressources comprises.
  const sanctions = useSanctions()
  const { ensureGuild } = sanctions

  // Le statut du serveur sélectionné est chargé dès qu'on entre dessus (cache
  // 60 s côté back-end comme côté client) : les verrous d'UI n'attendent pas
  // qu'un composant particulier le demande.
  useEffect(() => {
    ensureGuild(selectedGuildId)
  }, [selectedGuildId, ensureGuild])

  const newModuleBlock = useCallback(
    (moduleId: string) => {
      if (sanctions.isExempt || !selectedGuildId) return null
      if (modules[moduleId]) return null // déjà configuré → édition libre
      const guild = sanctions.guildStatus(selectedGuildId)
      const guildRestricted =
        levelRank(guild?.level ?? sanctions.guildLevel(selectedGuildId)) >= levelRank('limited')
      if (sanctions.user.restricted) return sanctions.user
      if (guildRestricted && guild) return guild
      if (guildRestricted) {
        return {
          subject_type: 'discord_guild' as const,
          subject_id: String(selectedGuildId),
          level: sanctions.guildLevel(selectedGuildId),
          action: null,
          suspended: sanctions.guildLevel(selectedGuildId) === 'suspended',
          restricted: true,
          sanctions: [],
        }
      }
      return null
    },
    [sanctions, selectedGuildId, modules]
  )

  const updateModule = useCallback(
    async (moduleId: string, config: Record<string, unknown>) => {
      if (!selectedGuildId) return
      // Sous sanction, on ne peut plus *créer* un module — l'éditer reste permis.
      // On refuse ici plutôt que d'attendre le 403 : le message est le même,
      // mais le formulaire n'est pas envoyé pour rien.
      const blocked = newModuleBlock(moduleId)
      if (blocked) {
        logger.warn('module', `Blocked new module ${moduleId} — global sanction`, blocked.level)
        throw sanctionBlockedError('new_module_blocked', blocked)
      }
      logger.event('module', `Updating ${moduleId} for guild ${selectedGuildId}`, config)
      try {
        await apiUpdateModule(selectedGuildId, moduleId, config)
        setModules((prev) => ({ ...prev, [moduleId]: config as unknown as ModuleConfig }))
        logger.success('module', `Updated ${moduleId} for guild ${selectedGuildId}`)
      } catch (e) {
        logger.error('module', `Failed to update ${moduleId} for guild ${selectedGuildId}`, e)
        throw e
      }
    },
    [selectedGuildId, newModuleBlock]
  )

  const disableModule = useCallback(
    async (moduleId: string) => {
      if (!selectedGuildId) return
      logger.event('module', `Disabling ${moduleId} for guild ${selectedGuildId}`)
      try {
        await apiDisableModule(selectedGuildId, moduleId)
        setModules((prev) => {
          const next = { ...prev }
          delete next[moduleId]
          return next
        })
        logger.success('module', `Disabled ${moduleId} for guild ${selectedGuildId}`)
      } catch (e) {
        logger.error('module', `Failed to disable ${moduleId} for guild ${selectedGuildId}`, e)
        throw e
      }
    },
    [selectedGuildId]
  )

  // Premium = le serveur est lié à l'abonnement Max actif de l'utilisateur
  // (cf. API_ENDPOINTS.md → GET /stripe/subscription). On n'utilise PAS l'attribut
  // PREMIUM de la guilde. `/guilds/{id}/premium` (jointure subscription_servers)
  // sert de signal de secours côté serveur.
  const premiumIds = usePremiumGuilds()
  const isPremium =
    (selectedGuildId != null && premiumIds.has(String(selectedGuildId))) ||
    premium?.is_premium === true

  return (
    <GuildContext.Provider
      value={{
        guilds,
        user,
        selectedGuildId,
        selectGuild,
        guildDetail,
        channels,
        roles,
        modules,
        stats,
        isPremium,
        isLoadingGuild,
        isGuildReady: selectedGuildId !== null && loadedGuildId === selectedGuildId,
        guildError,
        refreshGuildData,
        refreshGuildList,
        updateModule,
        disableModule,
      }}
    >
      {children}
    </GuildContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGuildContext() {
  const ctx = useContext(GuildContext)
  if (!ctx) throw new Error('useGuildContext must be used within GuildProvider')
  return ctx
}
