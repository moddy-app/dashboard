import { api } from '@/lib/auth'
import type {
  GuildListItem,
  GuildDetail,
  Channel,
  Role,
  ModuleConfig,
  GuildStats,
  LoggingConfig,
  SubscriptionData,
  SubscriptionServer,
  SubscriptionServersResponse,
} from '@/types/api'

// ─── Guilds ───────────────────────────────────────────────────────────────────

export async function getGuilds(): Promise<GuildListItem[]> {
  return (await api('/guilds')) as GuildListItem[]
}

export async function getGuild(guildId: string | number): Promise<GuildDetail> {
  return (await api(`/guilds/${guildId}`)) as GuildDetail
}

/**
 * Récupère guild + channels + roles en un seul appel.
 * Normalise la réponse : l'endpoint /discord retourne guild.id (string),
 * on le mappe vers guild_id pour cohérence avec le reste de l'app.
 */
export async function getGuildDiscordData(guildId: string | number): Promise<{
  guild: GuildDetail
  channels: Channel[]
  roles: Role[]
}> {
  const raw = (await api(`/guilds/${guildId}/discord`)) as {
    guild: Record<string, unknown>
    channels: Channel[]
    roles: Role[]
  }

  // L'endpoint /discord retourne { guild: { id: "...", ... } }
  // On normalise vers { guild_id: string, ... } pour rester cohérent
  const guild: GuildDetail = {
    ...(raw.guild as unknown as GuildDetail),
    guild_id: String(raw.guild.guild_id ?? raw.guild.id ?? guildId),
  }

  return { guild, channels: raw.channels, roles: raw.roles }
}

export async function getChannels(guildId: string | number): Promise<Channel[]> {
  return (await api(`/guilds/${guildId}/channels`)) as Channel[]
}

export async function getRoles(guildId: string | number): Promise<Role[]> {
  return (await api(`/guilds/${guildId}/roles`)) as Role[]
}

export async function updateGuildSettings(
  guildId: string | number,
  settings: Record<string, unknown>
): Promise<void> {
  await api(`/guilds/${guildId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export async function getModules(
  guildId: string | number
): Promise<Record<string, ModuleConfig>> {
  return (await api(`/guilds/${guildId}/modules`)) as Record<string, ModuleConfig>
}

export async function getModule(
  guildId: string | number,
  moduleId: string
): Promise<ModuleConfig> {
  return (await api(`/guilds/${guildId}/modules/${moduleId}`)) as ModuleConfig
}

export async function updateModule(
  guildId: string | number,
  moduleId: string,
  config: Record<string, unknown>
): Promise<void> {
  await api(`/guilds/${guildId}/modules/${moduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

export async function disableModule(
  guildId: string | number,
  moduleId: string
): Promise<void> {
  await api(`/guilds/${guildId}/modules/${moduleId}`, { method: 'DELETE' })
}

// ─── Logging (endpoint dédié) ─────────────────────────────────────────────────

export async function getLoggingConfig(
  guildId: string | number
): Promise<LoggingConfig> {
  const data = (await api(`/guilds/${guildId}/logging`)) as {
    guild_id: number
    config: LoggingConfig
  }
  return data.config
}

export async function updateLogging(
  guildId: string | number,
  config: LoggingConfig
): Promise<void> {
  await api(`/guilds/${guildId}/logging`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getGuildStats(
  guildId: string | number
): Promise<GuildStats> {
  return (await api(`/guilds/${guildId}/stats`)) as GuildStats
}

// ─── Stripe / Premium ─────────────────────────────────────────────────────────

export async function createCheckout(
  plan: 'monthly' | 'yearly' = 'monthly'
): Promise<string> {
  const returnUrl = `${window.location.origin}/premium`
  const { url } = (await api('/stripe/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, return_url: returnUrl }),
  })) as { url: string }
  return url
}

export async function openBillingPortal(): Promise<string> {
  const returnUrl = window.location.href
  const { url } = (await api('/stripe/portal', {
    method: 'POST',
    body: JSON.stringify({ return_url: returnUrl }),
  })) as { url: string }
  return url
}

export async function getSubscriptionStatus(): Promise<SubscriptionData> {
  return (await api('/stripe/subscription')) as SubscriptionData
}

export async function getSubscriptionServers(): Promise<SubscriptionServersResponse> {
  return (await api('/stripe/subscription/servers')) as SubscriptionServersResponse
}

export async function addSubscriptionServer(serverId: string): Promise<SubscriptionServer> {
  return (await api('/stripe/subscription/servers', {
    method: 'POST',
    body: JSON.stringify({ server_id: serverId }),
  })) as SubscriptionServer
}

export async function removeSubscriptionServer(serverId: string): Promise<{ server_id: string; removed: boolean }> {
  return (await api(`/stripe/subscription/servers/${serverId}`, {
    method: 'DELETE',
  })) as { server_id: string; removed: boolean }
}
