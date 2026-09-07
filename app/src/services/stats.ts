import { api } from '@/lib/auth'
import type {
  StatsAcquisition,
  StatsAi,
  StatsBreakdown,
  StatsCatalog,
  StatsGuildEvents,
  StatsHealth,
  StatsInstalls,
  StatsLifecycle,
  StatsOverview,
  StatsRetention,
  StatsSeries,
  StatsTopGuilds,
} from '@/types/stats'

/**
 * Statistiques internes — `GET /staff/stats/*`, toutes réservées au staff
 * (`403` sinon) et toutes en lecture seule.
 *
 * Le catalogue (`getStatsCatalog`) est l'allowlist du backend, pas seulement de
 * la documentation : une métrique qui n'y figure pas est un `422`.
 */

/**
 * Sérialise les paramètres communs. `dims` part en JSON encodé et **toutes** ses
 * valeurs doivent être des chaînes — `{"ok": true}` serait refusé en 422 parce
 * qu'il ne matcherait jamais rien.
 */
function statsQuery(params: {
  metric?: string
  by?: string
  days?: number
  scope?: 'global' | 'guild'
  scope_id?: string
  dims?: Record<string, string>
  limit?: number
  offset?: number
  guild_id?: string
  source?: string
  confirmed?: boolean
  event?: string
}): string {
  const query = new URLSearchParams()
  if (params.metric) query.set('metric', params.metric)
  if (params.by) query.set('by', params.by)
  if (params.days !== undefined) query.set('days', String(params.days))
  if (params.scope) query.set('scope', params.scope)
  if (params.scope_id) query.set('scope_id', params.scope_id)
  if (params.dims && Object.keys(params.dims).length > 0) {
    query.set('dims', JSON.stringify(params.dims))
  }
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset) query.set('offset', String(params.offset))
  if (params.guild_id) query.set('guild_id', params.guild_id)
  if (params.source) query.set('source', params.source)
  if (params.confirmed !== undefined) query.set('confirmed', String(params.confirmed))
  if (params.event) query.set('event', params.event)
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

export async function getStatsCatalog(): Promise<StatsCatalog> {
  return (await api('/staff/stats/catalog')) as StatsCatalog
}

export async function getStatsOverview(days = 30): Promise<StatsOverview> {
  return (await api(`/staff/stats/overview${statsQuery({ days })}`)) as StatsOverview
}

export async function getStatsSeries(params: {
  metric: string
  days?: number
  scope?: 'global' | 'guild'
  scope_id?: string
  dims?: Record<string, string>
}): Promise<StatsSeries> {
  return (await api(`/staff/stats/series${statsQuery(params)}`)) as StatsSeries
}

export async function getStatsBreakdown(params: {
  metric: string
  by: string
  days?: number
  scope?: 'global' | 'guild'
  scope_id?: string
  dims?: Record<string, string>
  limit?: number
}): Promise<StatsBreakdown> {
  return (await api(`/staff/stats/breakdown${statsQuery(params)}`)) as StatsBreakdown
}

export async function getTopGuilds(params: {
  metric?: string
  days?: number
  dims?: Record<string, string>
  limit?: number
}): Promise<StatsTopGuilds> {
  return (await api(`/staff/stats/top-guilds${statsQuery(params)}`)) as StatsTopGuilds
}

export async function getGuildsLifecycle(days = 30): Promise<StatsLifecycle> {
  return (await api(`/staff/stats/guilds/lifecycle${statsQuery({ days })}`)) as StatsLifecycle
}

export async function getGuildsRetention(): Promise<StatsRetention> {
  return (await api('/staff/stats/guilds/retention')) as StatsRetention
}

export async function getGuildsEvents(params: {
  guild_id?: string
  event?: 'join' | 'leave'
  limit?: number
  offset?: number
} = {}): Promise<StatsGuildEvents> {
  return (await api(`/staff/stats/guilds/events${statsQuery(params)}`)) as StatsGuildEvents
}

export async function getAcquisition(days = 30): Promise<StatsAcquisition> {
  return (await api(`/staff/stats/acquisition${statsQuery({ days })}`)) as StatsAcquisition
}

export async function getInstalls(params: {
  source?: string
  confirmed?: boolean
  days?: number
  limit?: number
  offset?: number
} = {}): Promise<StatsInstalls> {
  return (await api(`/staff/stats/installs${statsQuery(params)}`)) as StatsInstalls
}

export async function getAiUsage(params: { days?: number; guild_id?: string } = {}): Promise<StatsAi> {
  return (await api(`/staff/stats/ai${statsQuery(params)}`)) as StatsAi
}

export async function getStatsHealth(): Promise<StatsHealth> {
  return (await api('/staff/stats/health')) as StatsHealth
}
