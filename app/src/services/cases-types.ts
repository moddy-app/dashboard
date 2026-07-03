// Types du domaine « Cases » — alignés sur le contrat API Moddy.
// Réf : docs d'intégration Dashboard : Cases & Profils.

export type CaseType =
  | "global"
  | "network"
  | "guild"
  | "platform"
  | "external"

export type SubjectType =
  | "discord_user"
  | "discord_guild"
  | "moddy_user"
  | "external"

export type IssuerType =
  | "discord_user"
  | "moddy_staff"
  | "automod"
  | "system"
  | "external"

export type ScopeType =
  | "discord_guild"
  | "network"
  | "platform"
  | "external_service"

export type SanctionAction =
  | "warn"
  | "mute"
  | "ban"
  | "kick"
  | "restrict"
  | "revoke_access"

export type SanctionStatus = "active" | "expired" | "revoked"

export type CaseStatus = "open" | "closed"

export type EventType =
  | "comment"
  | "evidence"
  | "note"
  | "sanction_added"
  | "sanction_revoked"
  | "sanction_expired"
  | "status_change"

export type AuthorType = "discord_user" | "moddy_staff" | "system"

export type AppealRoute = "server" | "team"

export type AppealStatus =
  | "pending"
  | "accepted"
  | "refused"
  | "transformed"
  | "cancelled"

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

// GET /cases — objet Case + champs agrégés
export interface CaseListItem extends Case {
  actions: SanctionAction[]
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
  // Champs caviardés en vue « sujet »
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

// GET /cases/{id} — objet Case + relations
export interface CaseDetail extends Case {
  sanctions: Sanction[]
  events: CaseEvent[]
  appeals: Appeal[]
}

// GET /cases/meta
export interface CasesMeta {
  case_type_actions: Record<CaseType, SanctionAction[]>
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

// GET /staff/blacklist — projection aplatie
export interface BlacklistEntry {
  id: string
  reference: string
  type: CaseType
  subject_type: SubjectType
  subject_id: string
  issuer_type: IssuerType
  issuer_id: string | null
  reason: string
  status: CaseStatus
  created_at: string
  sanction_id: string
  action: SanctionAction
  expires_at: string | null
  sanctioned_at: string
  issued_by_type: IssuerType
  issued_by_id: string | null
}

export interface UserProfile {
  user_id: string
  username: string
  global_name: string | null
  discriminator: string | null
  avatar: string | null
  avatar_url: string | null
  banner: string | null
  banner_url: string | null
  accent_color: number | null
  avatar_decoration_data: unknown | null
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

export interface GuildProfile {
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

export interface CasesQuery {
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

export interface CreateCaseInput {
  case_type: "global" | "network"
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

export interface AddSanctionInput {
  action: SanctionAction
  expires_at?: string | null
  note?: string
}

export interface ApiError extends Error {
  status: number
  detail?: unknown
}
