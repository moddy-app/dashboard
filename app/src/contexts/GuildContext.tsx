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
import type { GuildDetail, Channel, Role, ModuleConfig, GuildStats } from '@/types/api'
import {
  getGuildDiscordData,
  getGuild,
  getChannels,
  getRoles,
  getModules,
  getGuildStats,
  updateModule as apiUpdateModule,
  disableModule as apiDisableModule,
} from '@/services/guilds'
import { ApiError } from '@/lib/auth'

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
  isLoadingGuild: boolean
  guildError: string | null
  // Actions
  refreshGuildData: () => Promise<void>
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
  const [isLoadingGuild, setIsLoadingGuild] = useState(false)
  const [guildError, setGuildError] = useState<string | null>(null)

  // Charge les données du serveur sélectionné
  const loadGuildData = useCallback(async (guildId: string) => {
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
          // Guild pas en base → on récupère juste les infos de base Discord
          guildInfo = await getGuild(guildId)
          // Channels et roles peuvent ne pas être disponibles non plus
          try {
            [channelList, roleList] = await Promise.all([
              getChannels(guildId),
              getRoles(guildId),
            ])
          } catch {
            // Pas grave si channels/roles ne chargent pas
          }
        } else {
          throw e
        }
      }

      // Modules et stats — pas critiques, on les charge en parallèle
      const [modulesData, statsData] = await Promise.allSettled([
        getModules(guildId),
        getGuildStats(guildId),
      ])

      setGuildDetail(guildInfo)
      setChannels(channelList)
      setRoles(roleList)
      setModules(modulesData.status === 'fulfilled' ? (modulesData.value ?? {}) : {})
      setStats(statsData.status === 'fulfilled' ? statsData.value : null)
    } catch (e) {
      setGuildError(e instanceof Error ? e.message : 'Failed to load guild data')
      setGuildDetail(null)
      setChannels([])
      setRoles([])
      setModules({})
      setStats(null)
    } finally {
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
      loadGuildData(selectedGuildId)
    } else {
      setGuildDetail(null)
      setChannels([])
      setRoles([])
      setModules({})
      setStats(null)
    }
  }, [selectedGuildId, loadGuildData])

  const selectGuild = useCallback(
    (id: string) => {
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
      await loadGuildData(selectedGuildId)
    }
  }, [selectedGuildId, loadGuildData])

  const updateModule = useCallback(
    async (moduleId: string, config: Record<string, unknown>) => {
      if (!selectedGuildId) return
      await apiUpdateModule(selectedGuildId, moduleId, config)
      setModules((prev) => ({ ...prev, [moduleId]: config as unknown as ModuleConfig }))
    },
    [selectedGuildId]
  )

  const disableModule = useCallback(
    async (moduleId: string) => {
      if (!selectedGuildId) return
      await apiDisableModule(selectedGuildId, moduleId)
      setModules((prev) => {
        const next = { ...prev }
        delete next[moduleId]
        return next
      })
    },
    [selectedGuildId]
  )

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
        isLoadingGuild,
        guildError,
        refreshGuildData,
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
