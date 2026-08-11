// Types des sanctions globales Moddy (cf. docs/backend-integration — Sanctions
// globales & /violations). Une sanction globale vise un utilisateur ou un
// serveur ; elle est *transverse* au dashboard, contrairement aux `cases` qui
// sont des dossiers de modération.
//
// ⚠️ `subject_id` est TOUJOURS une string (snowflake Discord) — jamais Number().

// ─── Niveaux ────────────────────────────────────────────────────────────────────

/** Niveau résolu d'un sujet. Ordre de sévérité : none < warn < limited < suspended. */
export const SANCTION_LEVELS = ['none', 'warn', 'limited', 'suspended'] as const
export type SanctionLevel = (typeof SANCTION_LEVELS)[number]

/** Action portée par la sanction globale (sous-ensemble des actions de case). */
export const GLOBAL_ACTIONS = ['warn', 'restrict', 'ban'] as const
export type GlobalAction = (typeof GLOBAL_ACTIONS)[number]

/** Sujet d'une sanction globale — un compte ou un serveur. */
export type ViolationSubjectType = 'discord_user' | 'discord_guild'

// ─── GET /violations/status ─────────────────────────────────────────────────────

/** Une sanction active telle que résumée par /violations/status. */
export interface SanctionSummary {
  case_id: string
  reference: string
  group_id: string
  action: GlobalAction
  level: SanctionLevel
  reason: string
  sanctioned_at: string | null
  expires_at: string | null
  expires_in_seconds: number | null
}

/**
 * Statut d'un sujet (compte connecté ou serveur).
 * `restricted` vaut `true` pour `limited` **et** `suspended` : c'est le drapeau
 * à tester pour verrouiller le premium et l'activation d'un nouveau module —
 * jamais `level === 'limited'`.
 */
export interface SubjectSanctionStatus {
  subject_type: ViolationSubjectType
  subject_id: string
  level: SanctionLevel
  action: GlobalAction | null
  suspended: boolean
  restricted: boolean
  sanctions: SanctionSummary[]
}

/** Réponse de `GET /violations/status` (la clé `guild` n'existe qu'avec `?guild_id=`). */
export interface ViolationStatusResponse {
  user: SubjectSanctionStatus
  guild?: SubjectSanctionStatus | null
}

// ─── Compte à rebours (enforcement) ─────────────────────────────────────────────

export const ENFORCEMENT_STATUSES = ['pending', 'halted', 'executed', 'cancelled'] as const
export type EnforcementStatus = (typeof ENFORCEMENT_STATUSES)[number]

/**
 * Délai avant application des conséquences (résiliation d'abonnement, départ du
 * bot…). `null` pour un `warn` : un avertissement n'a jamais de compte à rebours.
 */
export interface Enforcement {
  group_id: string
  level: SanctionLevel
  status: EnforcementStatus
  deadline: string | null
  /** Le sujet payait au moment de la sanction → résiliation sans remboursement. */
  premium: boolean
  notified: boolean
  halted_by: string | null
  halted_reason: string | null
  halted_at: string | null
  executed_at: string | null
}

// ─── GET /violations ────────────────────────────────────────────────────────────

export interface ViolationSubjectRef {
  subject_type: ViolationSubjectType
  subject_id: string
}

/**
 * L'unité d'affichage est le **groupe**, jamais la case : une même infraction
 * peut viser le compte ET ses serveurs, les séparer donnerait l'illusion de
 * plusieurs sanctions distinctes.
 */
export interface ViolationGroup {
  group_id: string
  /** `false` = ancienne sanction sans groupe (`group_id` = UUID de la case). */
  grouped: boolean
  /** Dérivé des sanctions **actives** — `none` si tout a été révoqué. */
  level: SanctionLevel
  /** Toutes les actions, y compris révoquées/expirées (historique). */
  actions: GlobalAction[]
  active_actions: GlobalAction[]
  active: boolean
  reason: string
  case_count: number
  references: string[]
  subjects: ViolationSubjectRef[]
  created_at: string
  updated_at: string
  enforcement: Enforcement | null
}

// ─── GET /violations/{group_id} ─────────────────────────────────────────────────

/** Sanction telle que portée par une case dans le détail d'une infraction. */
export interface ViolationCaseSanction {
  id?: string
  action: GlobalAction
  status: 'active' | 'expired' | 'revoked'
  expires_at: string | null
  created_at?: string | null
  note?: string | null
}

/** Case complète du détail — on ne suppose que le sous-ensemble qu'on affiche. */
export interface ViolationCase {
  id: string
  reference: string
  type?: string
  subject_type: ViolationSubjectType
  subject_id: string
  issuer_type?: string
  issuer_id?: string | null
  reason: string
  status?: string
  created_at: string
  updated_at?: string
  sanctions: ViolationCaseSanction[]
}

export interface ViolationDetail {
  group_id: string
  level: SanctionLevel
  actions: GlobalAction[]
  active_actions: GlobalAction[]
  active: boolean
  cases: ViolationCase[]
  enforcement: Enforcement | null
  appeal_url: string
}

// ─── Filtres de liste ───────────────────────────────────────────────────────────

export interface ViolationFilters {
  subject_type?: ViolationSubjectType
  subject_id?: string
  /** Filtre par action (`warn` | `restrict` | `ban`), pas par niveau résolu. */
  level?: GlobalAction
  limit?: number
  offset?: number
}

// ─── 403 de sanction ────────────────────────────────────────────────────────────

export const SANCTION_ERROR_CODES = [
  'user_suspended',
  'guild_suspended',
  'premium_blocked_user',
  'premium_blocked_guild',
  'new_module_blocked',
  'automod_ai_blocked',
] as const
export type SanctionErrorCode = (typeof SANCTION_ERROR_CODES)[number]

/**
 * Corps du champ `error` d'un 403 de sanction. Reconnaissable au fait que
 * `error` est un **objet** et non une chaîne — les autres 403 gardent la forme
 * historique `{"error": "message"}`.
 */
export interface SanctionErrorPayload {
  code: SanctionErrorCode | string
  level: SanctionLevel
  subject_type: ViolationSubjectType
  subject_id: string
  references: string[]
  expires_at: string | null
  message: string
  violations_url: string
}
