import { api, ApiError } from '@/lib/auth'
import { normalizeTicketsConfig, serializeTicketsConfig } from '@/lib/tickets'
import type {
  Ticket,
  TicketListFilters,
  TicketListResponse,
  TicketOrphansResponse,
  TicketPanel,
  TicketStats,
  TicketsApply,
  TicketsConfig,
  TicketsLimits,
  TicketsSaveResult,
} from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/tickets`

/**
 * Sépare la config de l'accusé du bot. `_apply` n'est jamais de la config : il
 * ne doit ni entrer dans l'état du formulaire, ni repartir dans le body suivant.
 */
function splitApply(body: unknown): TicketsSaveResult {
  const { _apply, ...rest } = (body ?? {}) as Record<string, unknown> & {
    _apply?: TicketsApply
  }
  return {
    config: normalizeTicketsConfig(rest),
    apply: _apply ?? null,
  }
}

/**
 * Config actuelle. Un `404` veut dire « jamais configuré » — ce n'est pas une
 * erreur : on renvoie `null` et l'appelant part d'une liste de panneaux vide.
 */
export async function getTicketsConfig(guildId: string | number): Promise<TicketsConfig | null> {
  try {
    return normalizeTicketsConfig((await api(BASE(guildId))) as Record<string, unknown>)
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * Sauvegarde. `PUT` et `PATCH` ont **exactement** la même sémantique : le corps
 * remplace tout l'objet, il n'y a pas de patch partiel — lire, muter, réécrire
 * en entier.
 *
 * Deux choses à savoir avant d'appeler :
 * - l'appel dure **plusieurs secondes** (jusqu'à ~25 s) : le backend attend que
 *   le bot ait republié les panneaux et écrit ses `message_id`. Aucun timeout
 *   n'est posé côté client ;
 * - un verrou Redis par serveur n'autorise **qu'une** sauvegarde en vol. Une
 *   seconde requête repart en `409` : l'appelant doit proposer un « Réessayer »,
 *   jamais boucler.
 *
 * La réponse porte les `message_id` frais : elle remplace l'état local.
 */
export async function saveTicketsConfig(
  guildId: string | number,
  panels: readonly TicketPanel[]
): Promise<TicketsSaveResult> {
  return splitApply(
    await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify(serializeTicketsConfig(panels)),
    })
  )
}

/**
 * Désactive le module et retire tous les messages de panneau de Discord.
 * **Ne ferme aucun ticket ouvert et ne supprime aucun salon** — les lignes de
 * la table `tickets` restent telles quelles.
 */
export async function deleteTicketsConfig(
  guildId: string | number
): Promise<TicketsApply | null> {
  return splitApply(await api(BASE(guildId), { method: 'DELETE' })).apply
}

/**
 * Quotas et consommation. À recharger **à l'ouverture de la page et après
 * chaque sauvegarde** : les compteurs changent. `premium` tient compte des
 * sanctions globales — un serveur sanctionné n'est plus premium, même payé.
 */
export async function getTicketsLimits(guildId: string | number): Promise<TicketsLimits> {
  const raw = (await api(`${BASE(guildId)}/limits`)) as Record<string, unknown>
  return {
    ...(raw as unknown as TicketsLimits),
    guild_id: String(raw.guild_id ?? guildId),
    categories: (raw.categories ?? {}) as Record<string, number>,
  }
}

// ─── Vues sur les tickets réels (lecture seule) ───────────────────────────────
//
// Ces trois routes lisent la table `tickets`, qui appartient au bot. Aucune
// écriture n'existe : pas de « fermer le ticket depuis le dashboard ».

export async function getTickets(
  guildId: string | number,
  filters: TicketListFilters = {}
): Promise<TicketListResponse> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  const raw = (await api(`/guilds/${guildId}/tickets${query ? `?${query}` : ''}`)) as TicketListResponse
  return { ...raw, tickets: (raw.tickets ?? []).map(normalizeTicket) }
}

export async function getTicketStats(
  guildId: string | number,
  days = 30
): Promise<TicketStats> {
  return (await api(`/guilds/${guildId}/tickets/stats?days=${days}`)) as TicketStats
}

/**
 * Tickets ouverts dont la catégorie a disparu de la config. Supprimer une
 * catégorie ne ferme pas ses tickets : ils restent ouverts et le bot répond
 * « catégorie disparue » à toute action dedans.
 */
export async function getOrphanTickets(
  guildId: string | number,
  limit = 100
): Promise<TicketOrphansResponse> {
  const raw = (await api(
    `/guilds/${guildId}/tickets/orphans?limit=${limit}`
  )) as TicketOrphansResponse
  return { ...raw, tickets: (raw.tickets ?? []).map(normalizeTicket) }
}

/** Les snowflakes restent des chaînes de bout en bout — jamais de `Number()`. */
function normalizeTicket(raw: Ticket): Ticket {
  const snowflake = (v: string | null | undefined) => (v == null ? null : String(v))
  return {
    ...raw,
    guild_id: String(raw.guild_id),
    channel_id: String(raw.channel_id),
    owner_id: String(raw.owner_id),
    claimed_by: snowflake(raw.claimed_by),
    pre_escalation_claim: snowflake(raw.pre_escalation_claim),
    staff_thread_id: snowflake(raw.staff_thread_id),
    close_requested_by: snowflake(raw.close_requested_by),
    closed_by: snowflake(raw.closed_by),
    participants: (raw.participants ?? []).map(String),
    participant_roles: (raw.participant_roles ?? []).map(String),
  }
}
