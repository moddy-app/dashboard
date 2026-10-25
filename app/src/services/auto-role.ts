import { api } from '@/lib/auth'

/** Réponse de `GET /guilds/{id}/modules/auto_role/tag`. */
export interface GuildTagInfo {
  /** `GUILD_TAGS` dans les features : le serveur peut définir un tag. `null` = Discord injoignable. */
  supported: boolean | null
  /** Texte du tag, connu seulement si l'utilisateur connecté le porte. */
  tag: string | null
}

export async function getGuildTag(guildId: string | number): Promise<GuildTagInfo> {
  const raw = (await api(`/guilds/${guildId}/modules/auto_role/tag`)) as Record<string, unknown>
  return {
    supported: typeof raw.supported === 'boolean' ? raw.supported : null,
    tag: typeof raw.tag === 'string' && raw.tag ? raw.tag : null,
  }
}
