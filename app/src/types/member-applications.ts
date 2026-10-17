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
