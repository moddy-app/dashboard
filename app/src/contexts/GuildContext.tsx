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
  getModules,
  getGuildStats,
  updateModule as apiUpdateModule,
  disableModule as apiDisableModule,
} from '@/services/guilds'

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
      const [discordData, modulesData, statsData] = await Promise.all([
        getGuildDiscordData(guildId),
        getModules(guildId),
        getGuildStats(guildId),
      ])
      setGuildDetail(discordData.guild)
      setChannels(discordData.channels)
      setRoles(discordData.roles)
      setModules(modulesData ?? {})
      setStats(statsData)
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
      navigate(`/servers/${id}`)
    },
    [navigate]
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
