// Module Candidatures (`member_applications`).
//
// Le dashboard **configure** et **consulte** : aucune route ne permet de
// décider d'une candidature, tout se tranche dans Discord (boutons de la carte
// d'examen). Les snowflakes restent des chaînes de bout en bout.

/**
 * Config éditable. **Pas de clé `enabled`** : le module est actif dès qu'un
 * salon est configuré — le dashboard n'écrit jamais cette clé.
 */
export interface MemberApplicationsConfig {
  /** Salon des cartes d'examen — texte ou annonces. `null` = module inactif. */
  channel_id: string | null
  ping_role_ids: string[]
  /** En plus des membres qui ont « Expulser des membres ». */
  reviewer_role_ids: string[]
  /** Visibles par le candidat refusé. */
  rejection_reasons: string[]
}

export interface MemberApplicationsLimits {
  ping_roles: number
  reviewer_roles: number
  rejection_reasons: number
  rejection_reason_length: number
}

export interface MemberApplicationsChannelCheck {
  channel_id: string
  exists: boolean
  unsupported_type: boolean
  /** `view_channel`, `send_messages`… */
  missing: string[]
}

export interface MemberApplicationsDiagnostics {
  guild_id: string
  enabled: boolean
  /** Calculé côté serveur. */
  active: boolean
  /** Réglage Discord « Adhésion ». `null` = inconnu (Discord n'a pas répondu). */
  manual_approval_enabled: boolean | null
  required_guild_permissions: string[]
  limits: MemberApplicationsLimits
  /** `false` = Discord n'a pas répondu : aucune alerte, ce n'est pas une erreur. */
  checked: boolean
  missing_guild_permissions: string[]
  channel: MemberApplicationsChannelCheck | null
}

export const APPLICATION_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export interface ApplicationUser {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
  public_flags?: number
}

/**
 * Réponse à une question du formulaire d'adhésion Discord. D'autres
 * `field_type` peuvent exister : ils retombent sur `unknown`, rendu avec le
 * libellé et la réponse brute — jamais un plantage.
 */
export type FormResponse =
  | { field_type: 'TERMS'; label: string; values: string[]; response: boolean }
  | { field_type: 'TEXT_INPUT' | 'PARAGRAPH'; label: string; response: string }
  | {
      field_type: 'MULTIPLE_CHOICE'
      label: string
      choices: string[]
      response: number | null
      /** `null` = réponse illisible : on ne devine jamais avec l'index. */
      response_label: string | null
    }
  | { field_type: 'unknown'; raw_type: string; label: string; response: unknown }

export interface Application {
  request_id: string
  guild_id: string
  user_id: string
  status: ApplicationStatus
  channel_id: string | null
  /** `null` sur une candidature en attente = l'envoi de la carte a échoué, le bot réessaie. */
  message_id: string | null
  /** `null` = modérateur inconnu, ou retrait. */
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  decided_in: 'moddy' | 'discord' | null
  submitted_at: string | null
  created_at: string
  updated_at: string
  /** Instantané pris au moment de la candidature. */
  user: ApplicationUser | null
  form_responses: FormResponse[]
}

export interface ApplicationsPage {
  applications: Application[]
  total: number
  limit: number
  offset: number
}

export interface ApplicationReviewerStats {
  user_id: string
  total: number
  approved: number
  rejected: number
}

export interface ApplicationStats {
  guild_id: string
  total: number
  pending: number
  by_status: Record<ApplicationStatus, number>
  by_origin: { moddy: number; discord: number }
  /** Triés par total décroissant côté backend — l'ordre est conservé. */
  reviewers: ApplicationReviewerStats[]
}
