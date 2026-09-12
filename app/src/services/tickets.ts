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
  TicketsSettings,
} from '@/types/api'
import {
  normalizeTranscriptDetail,
  normalizeTranscriptSummary,
  asScoreKey,
} from '@/lib/transcripts'
import type {
  TicketRating,
  TicketRatingsFilters,
  TicketRatingsResponse,
  TicketRatingsSummary,
  TranscriptDetail,
  TranscriptListFilters,
  TranscriptListResponse,
} from '@/types/transcripts'

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
  panels: readonly TicketPanel[],
  settings: TicketsSettings
): Promise<TicketsSaveResult> {
  return splitApply(
    await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify(serializeTicketsConfig(panels, settings)),
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

// ─── Archives et notes (lecture seule) ───────────────────────────────────────
//
// Le backend n'écrit **jamais** ces tables : pas de création, pas d'édition, pas
// de suppression. Le seul levier côté dashboard est la rétention, dans les
// réglages du module — et elle est appliquée par le bot.

function queryString(filters: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * Archives, les plus récemment fermées d'abord. **Une ligne par fermeture** :
 * un ticket rouvert puis refermé apparaît deux fois, et les deux archives
 * restent lisibles.
 *
 * `settings` est servi **avec** la liste pour qu'un vide s'explique — archives
 * coupées, ou rétention déjà passée. Sans lui, l'écran dirait « aucune archive »
 * sans dire pourquoi.
 */
export async function getTicketTranscripts(
  guildId: string | number,
  filters: TranscriptListFilters = {}
): Promise<TranscriptListResponse> {
  const raw = (await api(
    `/guilds/${guildId}/tickets/transcripts${queryString(filters)}`
  )) as Record<string, unknown>

  const settings = (raw.settings ?? {}) as Record<string, unknown>
  const days = Number(settings.transcript_retention_days)

  return {
    guild_id: String(raw.guild_id ?? guildId),
    settings: {
      transcripts_enabled: settings.transcripts_enabled !== false,
      transcript_retention_days: Number.isFinite(days) ? days : 0,
      rating_enabled: settings.rating_enabled !== false,
    },
    transcripts: (Array.isArray(raw.transcripts) ? raw.transcripts : []).map((item) =>
      normalizeTranscriptSummary((item ?? {}) as Record<string, unknown>)
    ),
    total: Number(raw.total ?? 0),
    limit: Number(raw.limit ?? 25),
    offset: Number(raw.offset ?? 0),
  }
}

/**
 * Corps d'une archive. Route **hors `/guilds`** : le bot donne ce lien au salon
 * de journal (l'équipe) *et* au DM de fermeture (l'auteur du ticket), qui n'est
 * pas forcément administrateur d'un serveur.
 *
 * `404` = clé inconnue, mal formée, **ou** lecteur non autorisé : les trois sont
 * volontairement indistinguables (confirmer qu'une clé existe est déjà une
 * fuite). `422` = l'archive existe et le lecteur y a droit, mais son corps n'est
 * pas rendable — ni à rejouer, ni à traiter comme un refus d'accès.
 */
export async function getTranscript(key: string): Promise<TranscriptDetail> {
  return normalizeTranscriptDetail(
    (await api(`/transcripts/${encodeURIComponent(key)}`)) as Record<string, unknown>
  )
}

function normalizeRatingRow(raw: Record<string, unknown>): TicketRating {
  const snowflake = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
  const score = Number(raw.score ?? 0)
  return {
    id: Number(raw.id ?? 0),
    ticket_number: Number(raw.ticket_number ?? 0),
    category_id: snowflake(raw.category_id),
    category_name: snowflake(raw.category_name),
    channel_id: snowflake(raw.channel_id),
    transcript_key: snowflake(raw.transcript_key),
    rated_staff_id: snowflake(raw.rated_staff_id),
    rated_by: snowflake(raw.rated_by),
    score: Number.isFinite(score) ? score : 0,
    score_key: asScoreKey(raw.score_key, score),
    comment: snowflake(raw.comment),
    trigger: (raw.trigger as TicketRating['trigger']) ?? 'self_close',
    created_at: String(raw.created_at ?? ''),
  }
}

export async function getTicketRatings(
  guildId: string | number,
  filters: TicketRatingsFilters = {}
): Promise<TicketRatingsResponse> {
  const raw = (await api(
    `/guilds/${guildId}/tickets/ratings${queryString(filters)}`
  )) as Record<string, unknown>

  return {
    guild_id: String(raw.guild_id ?? guildId),
    ratings: (Array.isArray(raw.ratings) ? raw.ratings : []).map((r) =>
      normalizeRatingRow((r ?? {}) as Record<string, unknown>)
    ),
    total: Number(raw.total ?? 0),
    limit: Number(raw.limit ?? 50),
    offset: Number(raw.offset ?? 0),
  }
}

/**
 * Agrégats — exactement ceux de `/ticket stats` côté Discord. `by_staff` arrive
 * **classé par volume** : ne jamais le re-trier par moyenne, un unique 5/5 ne
 * doit pas devancer cinquante tickets.
 */
export async function getTicketRatingsSummary(
  guildId: string | number,
  days = 30
): Promise<TicketRatingsSummary> {
  const raw = (await api(
    `/guilds/${guildId}/tickets/ratings/summary?days=${days}`
  )) as Record<string, unknown>

  const guild = (raw.guild ?? {}) as Record<string, unknown>
  const average = Number(guild.average)

  return {
    guild_id: String(raw.guild_id ?? guildId),
    window_days: Number(raw.window_days ?? days),
    score_keys: (raw.score_keys ?? {}) as TicketRatingsSummary['score_keys'],
    guild: {
      ratings: Number(guild.ratings ?? 0),
      // `null` quand aucune note n'a été laissée — surtout pas un `0`, qui se
      // lirait comme « tout le monde déteste ».
      average: guild.average === null || !Number.isFinite(average) ? null : average,
      negative: Number(guild.negative ?? 0),
      distribution: (guild.distribution ?? {}) as Record<string, number>,
    },
    by_staff: (Array.isArray(raw.by_staff) ? raw.by_staff : []).map((s) => {
      const row = (s ?? {}) as Record<string, unknown>
      const avg = Number(row.average)
      return {
        staff_id: String(row.staff_id ?? ''),
        ratings: Number(row.ratings ?? 0),
        average: row.average === null || !Number.isFinite(avg) ? null : avg,
        negative: Number(row.negative ?? 0),
        handled: Number(row.handled ?? 0),
        low_sample: row.low_sample === true,
      }
    }),
  }
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
