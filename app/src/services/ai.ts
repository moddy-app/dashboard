/**
 * Service Brocoli. Les endpoints JSON passent par `api()` (qui gère le 401, les
 * snowflakes et les logs) ; les deux endpoints de tour passent par `streamPost`
 * parce qu'ils rendent un `text/event-stream`.
 */

import { api } from '@/lib/auth'
import { streamPost } from '@/lib/ai-stream'
import { isAiMode } from '@/types/ai'
import type {
  AiConversation,
  AiConversationDetail,
  AiDecision,
  AiMode,
  AiQuota,
  AiStatus,
  AiTranscriptMessage,
  RawSseEvent,
} from '@/types/ai'

const BASE = '/ai'

// ─── Normalisation ────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeQuota(raw: unknown): AiQuota {
  const q = asRecord(raw)
  return {
    // Redis indisponible → le backend répond `{available: true, detail: …}`
    // sans compteurs. L'absence de `available` ne doit pas bloquer la saisie :
    // le quota est vérifié côté backend de toute façon.
    available: q.available !== false,
    detail: asStringOrNull(q.detail),
    messages_used_today: asNumberOrNull(q.messages_used_today),
    messages_limit: asNumberOrNull(q.messages_limit),
    guild_messages_used_today: asNumberOrNull(q.guild_messages_used_today),
    guild_messages_limit: asNumberOrNull(q.guild_messages_limit),
    resets_in_seconds: asNumberOrNull(q.resets_in_seconds),
  }
}

function normalizeStatus(raw: unknown): AiStatus {
  const s = asRecord(raw)
  const modes = Array.isArray(s.modes) ? s.modes.filter(isAiMode) : []
  const defaultMode = isAiMode(s.default_mode) ? s.default_mode : 'ask'
  return {
    // `enabled` n'est vrai que si le backend le dit explicitement : un payload
    // inattendu masque l'entrée plutôt que d'offrir un bouton qui répond 503.
    enabled: s.enabled === true,
    model: asStringOrNull(s.model),
    // Le sélecteur est alimenté par `modes`, jamais par une liste en dur ; le
    // repli n'existe que pour ne pas rendre un sélecteur vide.
    modes: modes.length > 0 ? modes : ['read_only', 'ask', 'auto'],
    default_mode: defaultMode,
    quota: normalizeQuota(s.quota),
  }
}

function normalizeConversation(raw: unknown): AiConversation {
  const c = asRecord(raw)
  const kind = c.kind
  return {
    id: String(c.id ?? ''),
    kind:
      kind === 'guild_config' || kind === 'support_user' || kind === 'support_staff'
        ? kind
        : 'guild_config',
    mode: isAiMode(c.mode) ? c.mode : 'ask',
    // Snowflakes : conservés en chaînes, jamais passés par `Number()`.
    guild_id: asStringOrNull(c.guild_id),
    user_id: String(c.user_id ?? ''),
    subject_user_id: asStringOrNull(c.subject_user_id),
    subject_guild_id: asStringOrNull(c.subject_guild_id),
    actor_is_staff: c.actor_is_staff === true,
    title: asStringOrNull(c.title),
    created_at: String(c.created_at ?? ''),
    updated_at: String(c.updated_at ?? ''),
    archived_at: asStringOrNull(c.archived_at),
  }
}

function normalizeMessage(raw: unknown): AiTranscriptMessage | null {
  const m = asRecord(raw)
  const role = m.role
  if (role !== 'user' && role !== 'assistant' && role !== 'action') return null
  return {
    id: Number(m.id ?? 0),
    seq: Number(m.seq ?? 0),
    role,
    content: asRecord(m.content),
    tokens_in: asNumberOrNull(m.tokens_in),
    tokens_out: asNumberOrNull(m.tokens_out),
    created_at: String(m.created_at ?? ''),
  }
}

// ─── Endpoints JSON ───────────────────────────────────────────────────────────

/**
 * Disponibilité et quota. **Répond toujours**, même assistant coupé — c'est ce
 * qui permet de masquer l'entrée plutôt que d'offrir un bouton qui répond 503.
 */
export async function getAiStatus(): Promise<AiStatus> {
  return normalizeStatus(await api(`${BASE}/status`))
}

/** Les 30 conversations non archivées de l'appelant, `updated_at` décroissant. */
export async function listConversations(): Promise<AiConversation[]> {
  const raw = asRecord(await api(`${BASE}/conversations`))
  const list = Array.isArray(raw.conversations) ? raw.conversations : []
  return list.map(normalizeConversation)
}

/**
 * Ouvre une conversation. `kind` vaut `guild_config` par défaut et exige
 * `guild_id` — le backend le revérifie contre l'authentification à **chaque**
 * requête, un admin qui perd l'accès reçoit un `403` sur une conversation
 * ouverte avant.
 */
export async function createConversation(params: {
  guildId: string
  mode: AiMode
  title?: string | null
}): Promise<AiConversation> {
  return normalizeConversation(
    await api(`${BASE}/conversations`, {
      method: 'POST',
      body: JSON.stringify({
        kind: 'guild_config',
        guild_id: params.guildId,
        mode: params.mode,
        ...(params.title ? { title: params.title } : {}),
      }),
    })
  )
}

/**
 * Conversation et transcript affichable. C'est **la** façon de reprendre après
 * une coupure ou un rechargement : le travail déjà fait est persisté côté
 * backend, y compris une éventuelle action en attente.
 */
export async function getConversation(conversationId: string): Promise<AiConversationDetail> {
  const raw = asRecord(await api(`${BASE}/conversations/${conversationId}`))
  const messages = Array.isArray(raw.messages) ? raw.messages : []
  return {
    conversation: normalizeConversation(raw.conversation),
    messages: messages
      .map(normalizeMessage)
      .filter((m): m is AiTranscriptMessage => m !== null)
      .sort((a, b) => a.seq - b.seq),
  }
}

/** Change le mode et/ou le titre. Un champ absent n'est pas modifié. */
export async function patchConversation(
  conversationId: string,
  patch: { mode?: AiMode; title?: string }
): Promise<AiConversation> {
  return normalizeConversation(
    await api(`${BASE}/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  )
}

/** Archive la conversation (sortie du listing). Rien n'est supprimé. */
export async function archiveConversation(conversationId: string): Promise<void> {
  await api(`${BASE}/conversations/${conversationId}`, { method: 'DELETE' })
}

// ─── Endpoints SSE ────────────────────────────────────────────────────────────

/**
 * Envoie un message et consomme le flux du tour.
 *
 * ⚠️ **Ne jamais rejouer automatiquement un envoi en échec** : le message a
 * peut-être été enregistré et le tour lancé. Un `mode` passé ici est *persisté*
 * sur la conversation avant le tour.
 */
export function sendMessage(
  conversationId: string,
  params: { message: string; mode?: AiMode },
  onEvent: (event: RawSseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    `${BASE}/conversations/${conversationId}/messages`,
    params.mode ? { message: params.message, mode: params.mode } : { message: params.message },
    onEvent,
    { signal }
  )
}

/**
 * Approuve ou refuse une action en attente. La réponse est **un nouveau flux** :
 * Brocoli reprend son tour là où il s'était arrêté et peut d'ailleurs redemander
 * une confirmation dans la foulée — d'où le même gestionnaire d'événements que
 * pour un message.
 */
export function decideAction(
  conversationId: string,
  actionId: string,
  decision: AiDecision,
  onEvent: (event: RawSseEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  return streamPost(
    `${BASE}/conversations/${conversationId}/actions/${actionId}/decision`,
    { decision },
    onEvent,
    { signal }
  )
}
