// Types du système de modération « Cases » (cf. docs/backend-integration — Cases & Profils).
// Toutes les IDs Discord (subject_id, scope_id, issuer_id, author_id, …) sont des STRINGS.
// Les timestamps sont des strings ISO 8601 UTC ou null.

// ─── Enums ──────────────────────────────────────────────────────────────────────

export const CASE_TYPES = ['global', 'network', 'guild', 'platform', 'external'] as const
export type CaseType = (typeof CASE_TYPES)[number]

export const SUBJECT_TYPES = ['discord_user', 'discord_guild', 'moddy_user', 'external'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export const ISSUER_TYPES = ['discord_user', 'moddy_staff', 'automod', 'system', 'external'] as const
export type IssuerType = (typeof ISSUER_TYPES)[number]

export const SCOPE_TYPES = ['discord_guild', 'network', 'platform', 'external_service'] as const
export type ScopeType = (typeof SCOPE_TYPES)[number]

export const SANCTION_ACTIONS = ['warn', 'mute', 'ban', 'kick', 'restrict', 'revoke_access'] as const
export type SanctionAction = (typeof SANCTION_ACTIONS)[number]

export const SANCTION_STATUSES = ['active', 'expired', 'revoked'] as const
export type SanctionStatus = (typeof SANCTION_STATUSES)[number]

export const CASE_STATUSES = ['open', 'closed'] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const EVENT_TYPES = [
  'comment',
  'evidence',
  'note',
  'sanction_added',
  'sanction_revoked',
  'sanction_expired',
  'status_change',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const AUTHOR_TYPES = ['discord_user', 'moddy_staff', 'system'] as const
export type AuthorType = (typeof AUTHOR_TYPES)[number]

export const APPEAL_ROUTES = ['server', 'team'] as const
export type AppealRoute = (typeof APPEAL_ROUTES)[number]

export const APPEAL_STATUSES = ['pending', 'accepted', 'refused', 'transformed', 'cancelled'] as const
export type AppealStatus = (typeof APPEAL_STATUSES)[number]

// ─── Objets ─────────────────────────────────────────────────────────────────────

export interface Case {
  id: string
  reference: string
  type: CaseType
  subject_type: SubjectType
  subject_id: string
  issuer_type: IssuerType
  issuer_id: string | null
  scope_type: ScopeType
  scope_id: string | null
  reason: string
  status: CaseStatus
  status_locked: boolean
  group_id: string | null
  created_at: string
  updated_at: string
}

/** Objet renvoyé en liste (GET /cases) — ajoute deux champs agrégés. */
export interface CaseListItem extends Case {
  actions: string[]
  has_active: boolean
}

export interface Sanction {
  id: string
  case_id: string
  action: SanctionAction
  expires_at: string | null
  status: SanctionStatus
  issued_by_type: IssuerType
  issued_by_id: string | null
  note: string | null
  created_at: string
  revoked_at: string | null
  revoked_by_type: IssuerType | null
  revoked_by_id: string | null
}

/** payload variable selon `type` — on ne suppose jamais un schéma fixe (défensif). */
export interface CaseEvent {
  id: string
  case_id: string
  type: EventType
  author_type: AuthorType | null
  author_id: string | null
  content: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export interface Appeal {
  id: string
  case_id: string
  sanction_id: string | null
  subject_id: string
  guild_id: string | null
  action: SanctionAction
  route: AppealRoute
  status: AppealStatus
  reason: string
  new_action: SanctionAction | null
  created_at: string
  decided_at: string | null
  // Champs caviardés en vue « sujet » (peuvent être absents / null).
  decided_by_type?: IssuerType | null
  decided_by_id?: string | null
  decision_note?: string | null
  claimed_by_id?: string | null
  claimed_at?: string | null
  dm_channel_id?: string | null
  dm_message_id?: string | null
  review_channel_id?: string | null
  review_message_id?: string | null
}

/** Réponse détail GET /cases/{id} — case + relations. */
export interface CaseDetail extends Case {
  sanctions: Sanction[]
  events: CaseEvent[]
  appeals: Appeal[]
}

// ─── Meta (GET /cases/meta) ──────────────────────────────────────────────────────

export interface CasesMeta {
  case_type_actions: Record<string, SanctionAction[]>
  temporary_actions: SanctionAction[]
  writable_case_types: CaseType[]
  enums: {
    case_type: CaseType[]
    subject_type: SubjectType[]
    scope_type: ScopeType[]
    sanction_action: SanctionAction[]
    sanction_status: SanctionStatus[]
    case_status: CaseStatus[]
    event_type: EventType[]
    appeal_route: AppealRoute[]
    appeal_status: AppealStatus[]
  }
}

// ─── Filtres & entrées ───────────────────────────────────────────────────────────

export interface CaseFilters {
  subject_type?: SubjectType
  subject_id?: string
  scope_type?: ScopeType
  scope_id?: string
  type?: CaseType
  status?: CaseStatus
  action?: SanctionAction
  issuer_type?: string
  issuer_id?: string
  group_id?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

export interface CaseCreateInput {
  case_type: 'global' | 'network'
  subject_type: SubjectType
  subject_id: string
  scope_type: ScopeType
  scope_id?: string | null
  reason: string
  action: SanctionAction
  expires_at?: string | null
  note?: string
  group_id?: string
}

export interface SanctionCreateInput {
  action: SanctionAction
  expires_at?: string | null
  note?: string
}

export interface CasePatchInput {
  reason?: string
  status?: CaseStatus
}

// ─── Profils (GET /users/{id}/profile, GET /guilds/{id}/profile) ─────────────────

export interface DiscordUserProfile {
  user_id: string
  username: string
  global_name: string | null
  discriminator: string | null
  avatar: string | null
  avatar_url: string | null
  banner: string | null
  banner_url: string | null
  accent_color: number | null
  public_flags: number | null
  badges: string[]
  bot: boolean
  display_name: string
  is_premium: boolean
  is_beta: boolean
  is_staff: boolean
  staff_roles: string[]
  in_database: boolean
}

export interface DiscordGuildProfile {
  guild_id: string
  name: string
  icon: string | null
  banner: string | null
  splash: string | null
  description: string | null
  member_count: number | null
  presence_count: number | null
  features: string[]
  vanity_url_code: string | null
  is_premium: boolean
  is_beta: boolean
  in_database: boolean
}
