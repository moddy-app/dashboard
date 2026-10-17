import { api } from '@/lib/auth'

/** Membre d'un serveur (`/guilds/{id}/members/*`). Ids toujours en chaînes. */
export interface GuildMember {
  id: string
  username: string
  global_name: string | null
  nick: string | null
  /** Ce que Discord affiche sur ce serveur : surnom, sinon nom global, sinon pseudo. */
  display_name: string
  avatar: string | null
  guild_avatar: string | null
  /** Déjà résolue (avatar de serveur > compte > défaut). */
  avatar_url: string
  bot: boolean
  role_ids: string[]
  joined_at: string | null
  premium_since: string | null
  pending: boolean
  communication_disabled_until: string | null
}

export interface MemberSearchResult {
  query: string
  match: 'name' | 'id'
  members: GuildMember[]
}

export interface MemberResolveResult {
  members: GuildMember[]
  not_found: string[]
  /** Discord n'a pas pu répondre : ne pas traiter ces ids comme absents. */
  unavailable: string[]
  partial: boolean
}

export const MEMBER_RESOLVE_BATCH = 25

/** Membres dont le pseudo ou le surnom commence par `q` (ou id / mention collés). */
export async function searchMembers(
  guildId: string,
  q: string,
  limit = 25
): Promise<MemberSearchResult> {
  const params = new URLSearchParams({ q: q.slice(0, 100), limit: String(limit) })
  return (await api(`/guilds/${guildId}/members/search?${params}`)) as MemberSearchResult
}

/** Résout des ids en membres, par lots de 25 (maximum de l'API). */
export async function resolveMembers(
  guildId: string,
  ids: string[]
): Promise<MemberResolveResult> {
  const unique = [...new Set(ids)]
  const merged: MemberResolveResult = { members: [], not_found: [], unavailable: [], partial: false }
  for (let i = 0; i < unique.length; i += MEMBER_RESOLVE_BATCH) {
    const chunk = unique.slice(i, i + MEMBER_RESOLVE_BATCH)
    const res = (await api(
      `/guilds/${guildId}/members/resolve?ids=${chunk.join(',')}`
    )) as MemberResolveResult
    merged.members.push(...res.members)
    merged.not_found.push(...res.not_found)
    merged.unavailable.push(...res.unavailable)
    merged.partial = merged.partial || res.partial
  }
  return merged
}
