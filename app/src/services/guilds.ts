import { api } from '@/lib/auth'
import type {
  GuildListItem,
  GuildDetail,
  Channel,
  Role,
  GuildEmoji,
  ModuleConfig,
  GuildStats,
  GuildPremium,
  AdaptiveSlowmodeConfig,
  ChannelSlowmodeConfig,
  SubscriptionData,
  SubscriptionServer,
  SubscriptionServersResponse,
  SocialPlatform,
  SocialSubscription,
  SocialSubscriptionCreate,
  SocialSubscriptionUpdate,
  SocialSubscribeResult,
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

export async function getEmojis(guildId: string | number): Promise<GuildEmoji[]> {
  return (await api(`/guilds/${guildId}/emojis`)) as GuildEmoji[]
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

// ─── Adaptive Slowmode ────────────────────────────────────────────────────────

export async function getAdaptiveSlowmodeConfig(
  guildId: string | number
): Promise<AdaptiveSlowmodeConfig | null> {
  try {
    return (await api(`/guilds/${guildId}/modules/adaptive_slowmode`)) as AdaptiveSlowmodeConfig
  } catch {
    return null
  }
}

export async function upsertSlowmodeChannel(
  guildId: string | number,
  channelId: string,
  config: ChannelSlowmodeConfig
): Promise<void> {
  await api(`/guilds/${guildId}/modules/adaptive_slowmode/channels/${channelId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

export async function deleteSlowmodeChannel(
  guildId: string | number,
  channelId: string
): Promise<void> {
  await api(`/guilds/${guildId}/modules/adaptive_slowmode/channels/${channelId}`, {
    method: 'DELETE',
  })
}

export async function saveAdaptiveSlowmodeConfig(
  guildId: string | number,
  config: AdaptiveSlowmodeConfig
): Promise<void> {
  await api(`/guilds/${guildId}/modules/adaptive_slowmode`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

// ─── Social Notifications ──────────────────────────────────────────────────────

const SOCIAL_BASE = (guildId: string | number) =>
  `/guilds/${guildId}/modules/social_notifications`

/** Liste les abonnements de la guilde (optionnellement filtrés par plateforme). */
export async function getSocialSubscriptions(
  guildId: string | number,
  platform?: SocialPlatform
): Promise<SocialSubscription[]> {
  const query = platform ? `?platform=${platform}` : ''
  return (await api(`${SOCIAL_BASE(guildId)}/subscriptions${query}`)) as SocialSubscription[]
}

/**
 * Ajoute (ou ré-active) un abonnement. Appel synchrone côté backend (~2-12s) :
 * la réponse contient le target_id canonique et le display_name résolu par le bot.
 * Les snowflakes sont envoyés en string — Pydantic les coerce en int sans perte
 * de précision (contrairement à un Number() JS qui arrondirait au-delà de 2^53).
 */
export async function addSocialSubscription(
  guildId: string | number,
  input: SocialSubscriptionCreate
): Promise<SocialSubscribeResult> {
  return (await api(`${SOCIAL_BASE(guildId)}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify(input),
  })) as SocialSubscribeResult
}

/** Modifie un abonnement (PATCH partiel — seuls les champs fournis sont transmis). */
export async function updateSocialSubscription(
  guildId: string | number,
  platform: SocialPlatform,
  targetId: string,
  update: SocialSubscriptionUpdate
): Promise<void> {
  await api(`${SOCIAL_BASE(guildId)}/subscriptions/${platform}/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}

/** Supprime un abonnement. */
export async function deleteSocialSubscription(
  guildId: string | number,
  platform: SocialPlatform,
  targetId: string
): Promise<void> {
  await api(`${SOCIAL_BASE(guildId)}/subscriptions/${platform}/${targetId}`, {
    method: 'DELETE',
  })
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getGuildStats(
  guildId: string | number
): Promise<GuildStats> {
  return (await api(`/guilds/${guildId}/stats`)) as GuildStats
}

/** Statut premium d'un serveur (détecte aussi les serveurs liés à un abonnement
 *  actif même sans l'attribut PREMIUM). */
export async function getGuildPremium(
  guildId: string | number
): Promise<GuildPremium> {
  return (await api(`/guilds/${guildId}/premium`)) as GuildPremium
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
