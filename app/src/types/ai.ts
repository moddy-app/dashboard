/**
 * Brocoli — assistant IA du backend Moddy.
 *
 * Deux endpoints (`POST …/messages` et `POST …/decision`) répondent en
 * `text/event-stream`, pas en JSON : les types d'événements sont décrits plus
 * bas et consommés par `src/lib/ai-stream.ts`.
 *
 * ⚠️ Tous les identifiants Discord arrivent en **chaînes** (un snowflake de 19
 * chiffres déborde `Number`) — ils ne doivent jamais passer par `Number()`.
 */

// ─── Énumérations ─────────────────────────────────────────────────────────────

/** Mode d'une conversation. `ask` est le défaut côté backend. */
export type AiMode = 'read_only' | 'ask' | 'auto'

export const AI_MODES: readonly AiMode[] = ['read_only', 'ask', 'auto'] as const

export function isAiMode(value: unknown): value is AiMode {
  return value === 'read_only' || value === 'ask' || value === 'auto'
}

/**
 * Statut de fin de tour (`run_end`). Un tour arrêté sur
 * `awaiting_confirmation` **n'est pas terminé** : il reprend dans le flux de
 * `POST …/decision`.
 */
export type AiRunStatus = 'completed' | 'awaiting_confirmation' | 'error' | 'max_iterations'

/**
 * Niveau de risque d'une action soumise à confirmation.
 * - `low` — réversible d'un clic depuis le dashboard
 * - `high` — effet visible dans Discord, coûteux à défaire à la main
 * - `critical` — irréversible, financier, ou porteur d'autorité
 *
 * Une valeur inconnue (le backend peut en ajouter) est dégradée vers `high` par
 * `normalizeRisk()` : jamais vers `low`, qui minimiserait une action qu'on ne
 * sait pas classer.
 */
export type AiRisk = 'low' | 'high' | 'critical'

/** Cycle de vie d'une action. Seul `pending` est décidable. */
export type AiActionStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'executed'
  | 'failed'

/** Genre de conversation. Seul `guild_config` est branché au dashboard. */
export type AiConversationKind = 'guild_config' | 'support_user' | 'support_staff'

/** Codes portés par l'événement `error` du flux. */
export type AiStreamErrorCode =
  | 'timeout'
  | 'network'
  | 'rate_limited'
  | 'upstream'
  | 'bad_request'
  | 'stream_error'
  | 'ai_unavailable'
  | 'internal'

// ─── `GET /ai/status` ─────────────────────────────────────────────────────────

/**
 * Quota du jour. Redis indisponible → le backend renvoie
 * `{available: true, detail: "compteurs indisponibles"}` **sans les compteurs** :
 * d'où les `null` partout ailleurs. Un quota par utilisateur *et* un par
 * serveur ; le second est `null` hors contexte serveur.
 */
export interface AiQuota {
  available: boolean
  detail?: string | null
  messages_used_today: number | null
  messages_limit: number | null
  guild_messages_used_today: number | null
  guild_messages_limit: number | null
  /** Secondes jusqu'à la remise à zéro (minuit UTC). */
  resets_in_seconds: number | null
}

export interface AiStatus {
  /** `false` → l'entrée Brocoli est **masquée**, pas grisée. */
  enabled: boolean
  /** `null` quand `enabled` vaut `false`. */
  model: string | null
  modes: AiMode[]
  default_mode: AiMode
  quota: AiQuota
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface AiConversation {
  id: string
  kind: AiConversationKind
  mode: AiMode
  guild_id: string | null
  user_id: string
  subject_user_id: string | null
  subject_guild_id: string | null
  actor_is_staff: boolean
  title: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

/**
 * Message du transcript rendu par `GET /ai/conversations/{id}`. Seuls les rôles
 * `user`, `assistant` et `action` sont servis : les `tool_call` / `tool_result`
 * bruts ne sont pas renvoyés, inutile de les gérer à la relecture.
 */
export interface AiTranscriptMessage {
  id: number
  seq: number
  role: 'user' | 'assistant' | 'action'
  content: Record<string, unknown>
  tokens_in: number | null
  tokens_out: number | null
  created_at: string
}

export interface AiConversationDetail {
  conversation: AiConversation
  messages: AiTranscriptMessage[]
}

// ─── Action soumise à confirmation ────────────────────────────────────────────

/** Une entrée du diff. Liste **plate** : `path` est un chemin, pas une structure. */
export interface AiDiffEntry {
  path: string
  op: 'added' | 'removed' | 'changed'
  before: unknown
  after: unknown
}

/**
 * Aperçu de l'action.
 *
 * `summary` est le seul champ garanti : certaines natures d'action
 * (facturation, sanctions) ne se prévisualisent **pas** par un diff. Dans ce
 * cas `diff` est absent et il ne faut **rien inventer** à partir de `kind` —
 * mieux vaut « pas de détail disponible » qu'un aperçu faux sur une action
 * irréversible.
 */
export interface AiActionPreview {
  summary: string
  module_id?: string | null
  /** `false` → la config **ne passera pas** : « Appliquer » doit être grisé. */
  valid?: boolean | null
  errors?: string[] | null
  diff?: AiDiffEntry[] | null
}

export interface AiPermissionRequest {
  action_id: string
  kind: string
  risk: AiRisk
  status: AiActionStatus
  requires_confirmation: boolean
  /**
   * Au-delà, la décision répond `409`. `null` à la relecture du transcript :
   * le message de rôle `action` ne porte pas d'échéance — on n'affiche alors
   * simplement pas de compte à rebours.
   */
  expires_at: string | null
  preview: AiActionPreview
}

export type AiDecision = 'approve' | 'deny'

// ─── Événements du flux SSE ───────────────────────────────────────────────────

export interface AiUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

/**
 * Les sept événements du flux. `arguments` d'un `tool_call` est une **chaîne
 * JSON**, et c'est ce que Brocoli *demande*, pas ce qui a été fait : le
 * résultat, c'est `tool_result.ok` et, pour une écriture, l'action et son diff.
 */
export type AiStreamEvent =
  | { event: 'message_start'; data: { conversation_id: string } }
  | { event: 'text_delta'; data: { delta: string } }
  | { event: 'tool_call'; data: { call_id: string; name: string; arguments: string } }
  | { event: 'tool_result'; data: { call_id: string; name: string; ok: boolean } }
  | { event: 'permission_request'; data: AiPermissionRequest }
  | { event: 'run_end'; data: { status: AiRunStatus; usage?: AiUsage } }
  | { event: 'error'; data: { code: AiStreamErrorCode; message: string } }

/** Événement brut, avant discrimination (un nom inconnu est ignoré). */
export interface RawSseEvent {
  event: string
  data: unknown
}

// ─── Timeline affichée ────────────────────────────────────────────────────────

/**
 * Ce que la vue rend réellement. Distinct du transcript de l'API : un tour en
 * cours produit des étapes d'outil qui ne sont *pas* persistées côté backend et
 * disparaissent donc au rechargement — c'est voulu, elles n'ont d'intérêt que
 * pendant l'attente.
 */
export type BrocoliItem =
  | { kind: 'user'; id: string; text: string; created_at: string | null }
  | { kind: 'assistant'; id: string; text: string; streaming: boolean }
  | {
      kind: 'tool'
      id: string
      call_id: string
      name: string
      /** Chaîne JSON telle que reçue — affichée seulement en mode « détails ». */
      arguments: string
      state: 'running' | 'ok' | 'failed'
    }
  | {
      kind: 'action'
      id: string
      action: AiPermissionRequest
      /** Décision déjà envoyée depuis cet onglet (boutons verrouillés). */
      submitted: AiDecision | null
    }
  | { kind: 'notice'; id: string; code: AiStreamErrorCode | 'max_iterations'; message: string }

/** État global d'un tour, du point de vue de la saisie. */
export type BrocoliRunState = 'idle' | 'streaming' | 'awaiting_confirmation'
