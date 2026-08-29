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
 * `POST …/decision`. Idem pour `awaiting_answer`, qui reprend dans celui de
 * `POST …/questions/{id}/answer`.
 *
 * ⚠️ `awaiting_answer` doit être traité **explicitement** : un `default` qui
 * rend la main à la saisie ferait sortir de l'attente sans afficher le
 * formulaire, et la conversation resterait muette.
 */
export type AiRunStatus =
  | 'completed'
  | 'awaiting_confirmation'
  | 'awaiting_answer'
  | 'error'
  | 'max_iterations'

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
 * `user`, `assistant`, `action` et `question` sont servis : les `tool_call` /
 * `tool_result` bruts ne sont pas renvoyés, inutile de les gérer à la relecture.
 *
 * ⚠️ Une question répondue laisse **deux** lignes (`pending`, puis `answered`
 * ou `cancelled`) : les deux moments sont dans l'historique. Le regroupement
 * par `question_id` est fait par `itemsFromTranscript()`.
 */
export interface AiTranscriptMessage {
  id: number
  seq: number
  role: 'user' | 'assistant' | 'action' | 'question'
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

// ─── Question posée à l'utilisateur ───────────────────────────────────────────

/**
 * Nature de la réponse attendue — c'est elle, et elle seule, qui décide du
 * widget. Un champ texte de repli sur un `channel` annulerait tout l'intérêt de
 * la fonctionnalité : elle existe précisément pour éviter de faire recopier un
 * snowflake à la main.
 */
export type AiAnswerType = 'channel' | 'role' | 'choice' | 'text'

/** Une option de `answer_type: 'choice'` — 2 à 6 entrées. */
export interface AiQuestionOption {
  id: string
  label: string
  /** Ce qui est renvoyé dans la réponse. */
  value: string
  description: string | null
  /** Au plus une option la porte : c'est la valeur **présélectionnée**. */
  recommended: boolean
}

/**
 * Une question. Tout ce qui est du texte (`question`, `header`, `label`,
 * `description`, `recommendation_reason`) arrive **dans la langue de la
 * conversation** : rien n'est à traduire ici, et rien n'est à réécrire.
 */
export interface AiQuestion {
  /** `"q1"`, `"q2"`… — la clé pour répondre. */
  id: string
  /**
   * Étiquette courte. **Peut être vide** : le backend préfère ne rien mettre
   * plutôt qu'une puce en français sur une conversation en anglais. Vide → pas
   * de puce, jamais un libellé inventé côté front.
   */
  header: string
  question: string
  answer_type: AiAnswerType
  multi_select: boolean
  /** Uniquement pour `choice`. */
  options: AiQuestionOption[]
  /**
   * **Une valeur par défaut, pas un indice** : à présélectionner dans le
   * widget. Un identifiant pour `channel` / `role`, une valeur d'option pour
   * `choice`, du texte pour `text`. `null` = Brocoli n'a rien à proposer, et il
   * ne faut alors **rien fabriquer** à sa place.
   */
  recommended: string | null
  /** Nom lisible de `recommended` — repli d'affichage si l'id est introuvable. */
  recommended_label: string | null
  /** Une phrase, affichée sous le champ. */
  recommendation_reason: string | null
}

/**
 * Cycle de vie d'une question. Seul `pending` (et non expiré) ouvre le
 * formulaire ; un envoi hors de là répond `409`.
 */
export type AiQuestionStatus = 'pending' | 'answered' | 'cancelled' | 'expired'

/** Charge de l'événement `user_question`, et d'une ligne `question` du transcript. */
export interface AiQuestionRequest {
  question_id: string
  status: AiQuestionStatus
  /**
   * Échéance. Contrairement aux actions, la ligne du transcript **la porte**
   * aussi : c'est ce qui permet, après un rechargement, de savoir si le
   * formulaire est encore valide avant de le reproposer.
   */
  expires_at: string | null
  /** 1 à 4 questions. */
  questions: AiQuestion[]
}

/**
 * Une réponse. `values` prime sur `value`. `label` / `labels` sont le nom
 * lisible : **les renvoyer**, Brocoli les emploie dans sa phrase suivante au
 * lieu de relire les salons du serveur.
 */
export interface AiAnswer {
  question_id: string
  value?: string
  values?: string[]
  label?: string
  labels?: string[]
  /** Question laissée de côté. */
  skipped?: boolean
}

/**
 * Corps de `POST …/questions/{id}/answer`. `cancelled` ferme la question sans
 * y répondre — c'est ce que fait le bouton « Ignorer », sans lequel la seule
 * sortie d'une question mal posée serait d'y répondre n'importe quoi.
 */
export interface AiAnswerBody {
  answers?: AiAnswer[]
  cancelled?: boolean
}


// ─── Événements du flux SSE ───────────────────────────────────────────────────

export interface AiUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

/**
 * Les huit événements du flux. `arguments` d'un `tool_call` est une **chaîne
 * JSON**, et c'est ce que Brocoli *demande*, pas ce qui a été fait : le
 * résultat, c'est `tool_result.ok` et, pour une écriture, l'action et son diff.
 */
export type AiStreamEvent =
  | { event: 'message_start'; data: { conversation_id: string } }
  | { event: 'text_delta'; data: { delta: string } }
  | { event: 'tool_call'; data: { call_id: string; name: string; arguments: string } }
  | { event: 'tool_result'; data: { call_id: string; name: string; ok: boolean } }
  | { event: 'permission_request'; data: AiPermissionRequest }
  | { event: 'user_question'; data: AiQuestionRequest }
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
  | {
      kind: 'question'
      id: string
      request: AiQuestionRequest
      /** Formulaire déjà envoyé depuis cet onglet (champs et boutons verrouillés). */
      submitted: boolean
    }
  | { kind: 'notice'; id: string; code: AiStreamErrorCode | 'max_iterations'; message: string }

/** État global d'un tour, du point de vue de la saisie. */
export type BrocoliRunState =
  | 'idle'
  | 'streaming'
  | 'awaiting_confirmation'
  | 'awaiting_answer'
