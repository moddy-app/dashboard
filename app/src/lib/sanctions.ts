import { type LucideIcon } from 'lucide-react'
import { ApiError } from '@/lib/auth'
import { ACTION_TONE, SANCTION_LEVEL_HUE, SANCTION_LEVEL_ICON } from '@/lib/cases'
import type {
  Enforcement,
  GlobalAction,
  SanctionErrorPayload,
  SanctionLevel,
  SubjectSanctionStatus,
  ViolationGroup,
} from '@/types/violations'

/**
 * Serveur de support Moddy — c'est là, et nulle part ailleurs, qu'un appel se
 * dépose : il n'existe aucun endpoint d'appel côté API.
 */
export const APPEAL_URL = 'https://moddy.app/support'

/** Conditions d'utilisation — ce qu'une sanction globale sanctionne. */
export const TERMS_URL = 'https://moddy.app/terms'

/** Route interne de la page des infractions. */
export const VIOLATIONS_PATH = '/violations'

// ─── Sévérité ─────────────────────────────────────────────────────────────────

const RANK: Record<SanctionLevel, number> = {
  none: 0,
  warn: 1,
  limited: 2,
  suspended: 3,
}

export function levelRank(level: SanctionLevel | null | undefined): number {
  return RANK[level ?? 'none'] ?? 0
}

/**
 * Niveau effectif d'une action dans un serveur : **le plus sévère** entre le
 * compte connecté et le serveur. Un compte sain dans un serveur limité est
 * traité comme limité, et inversement.
 */
export function effectiveStatus(
  user: SubjectSanctionStatus | null,
  guild: SubjectSanctionStatus | null
): SubjectSanctionStatus | null {
  if (!user) return guild
  if (!guild) return user
  return levelRank(user.level) >= levelRank(guild.level) ? user : guild
}

/** Statut neutre — sert de valeur par défaut tant que rien n'est chargé. */
export function noSanction(
  subject_type: SubjectSanctionStatus['subject_type'],
  subject_id: string
): SubjectSanctionStatus {
  return {
    subject_type,
    subject_id,
    level: 'none',
    action: null,
    suspended: false,
    restricted: false,
    sanctions: [],
  }
}

// ─── Apparence ────────────────────────────────────────────────────────────────

/**
 * Les tons viennent de `ACTION_TONE` (`lib/cases.ts`), pas d'une palette
 * parallèle : les infractions se lisent comme les dossiers de modération, avec
 * les mêmes rouges et les mêmes ambres. Seuls l'icône et l'anneau d'avatar sont
 * propres aux niveaux.
 */
export interface LevelTone {
  icon: LucideIcon
  text: string
  softBg: string
  border: string
  dot: string
  bg: string
  /** Anneau autour d'un avatar — l'écran de suspension s'en sert. */
  ring: string
}

const LEVEL_RING: Record<SanctionLevel, string> = {
  none: 'ring-emerald-200 dark:ring-emerald-900',
  warn: 'ring-amber-200 dark:ring-amber-900',
  limited: 'ring-orange-200 dark:ring-orange-900',
  suspended: 'ring-red-200 dark:ring-red-900',
}

// Ton et icône viennent de `lib/cases` : `ActionChip` s'en sert aussi pour les
// mesures d'un dossier global. Une seule source, donc jamais deux couleurs pour
// la même idée.
const LEVEL_ICON = SANCTION_LEVEL_ICON as Record<SanctionLevel, LucideIcon>
const LEVEL_HUE = SANCTION_LEVEL_HUE as Record<SanctionLevel, keyof typeof ACTION_TONE>

export const LEVEL_TONE = Object.fromEntries(
  (Object.keys(LEVEL_HUE) as SanctionLevel[]).map((level) => [
    level,
    { ...ACTION_TONE[LEVEL_HUE[level]], icon: LEVEL_ICON[level], ring: LEVEL_RING[level] },
  ])
) as Record<SanctionLevel, LevelTone>

// ─── Niveau d'un jeu de mesures ───────────────────────────────────────────────

const ACTION_LEVEL: Record<GlobalAction, SanctionLevel> = {
  warn: 'warn',
  restrict: 'limited',
  ban: 'suspended',
}

/**
 * Niveau résolu d'un jeu de mesures — **le plus sévère** des mesures actives.
 *
 * ⚠️ Un groupe d'infraction peut mélanger les niveaux : un avertissement pour le
 * compte, une limitation sur un serveur, une suspension sur un autre. Le
 * `level` du groupe est donc un *résumé* (le pire), jamais ce qui s'applique à
 * un sujet donné. Pour ça, on repasse par cette fonction avec les mesures du
 * sujet — c'est ce que fait la vue détail, sujet par sujet.
 */
export function levelFromActions(actions: GlobalAction[]): SanctionLevel {
  return actions.reduce<SanctionLevel>(
    (worst, action) =>
      levelRank(ACTION_LEVEL[action]) > levelRank(worst) ? ACTION_LEVEL[action] : worst,
    'none'
  )
}

// ─── 403 de sanction ──────────────────────────────────────────────────────────

/**
 * Un 403 de sanction se reconnaît à son champ `error` **objet** (les autres 403
 * gardent `{"error": "message"}`). Retourne le payload, ou `null` si l'erreur
 * n'en est pas un — le handler générique reste intact.
 */
export function asSanctionError(error: unknown): SanctionErrorPayload | null {
  if (!(error instanceof ApiError)) return null
  const detail = error.detail
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return null
  const payload = detail as Partial<SanctionErrorPayload>
  if (typeof payload.code !== 'string' || !payload.code) return null
  return {
    code: payload.code,
    level: payload.level ?? 'limited',
    subject_type: payload.subject_type ?? 'discord_user',
    subject_id: payload.subject_id != null ? String(payload.subject_id) : '',
    references: Array.isArray(payload.references) ? payload.references.map(String) : [],
    expires_at: payload.expires_at ?? null,
    message: payload.message ?? error.message,
    violations_url: payload.violations_url ?? APPEAL_URL,
  }
}

/**
 * Erreur levée **côté client** quand l'UI sait déjà qu'une action est refusée
 * (bouton contourné, formulaire soumis au clavier…). Elle emprunte la forme
 * d'un 403 de sanction pour traverser `handleSaveError` sans cas particulier.
 */
export function sanctionBlockedError(
  code: SanctionErrorPayload['code'],
  status: SubjectSanctionStatus
): ApiError {
  const payload: SanctionErrorPayload = {
    code,
    level: status.level,
    subject_type: status.subject_type,
    subject_id: status.subject_id,
    references: status.sanctions.map((s) => s.reference),
    expires_at: status.sanctions[0]?.expires_at ?? null,
    message: '',
    violations_url: VIOLATIONS_PATH,
  }
  return new ApiError(403, code, payload)
}

// ─── Resynchronisation après un 403 ───────────────────────────────────────────

/**
 * Un 403 de sanction signifie que l'UI a une longueur de retard (sanction posée
 * entre-temps). Plutôt que de coupler le handler d'erreur au contexte React, on
 * émet un évènement : `SanctionProvider` l'écoute et recharge le statut.
 */
export const SANCTION_REFRESH_EVENT = 'moddy:sanction-refresh'

export function notifySanctionChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SANCTION_REFRESH_EVENT))
}

// ─── Formatage ────────────────────────────────────────────────────────────────

/** Date + heure locales lisibles (« 17 août 2026, 14:00 »). */
export function formatDeadline(iso: string | null | undefined, locale = 'en'): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Décompose une durée en jours / heures / minutes pour un compte à rebours.
 * Retourne `null` si l'échéance est passée ou absente.
 */
export function remainingParts(
  iso: string | null | undefined
): { days: number; hours: number; minutes: number; total: number } | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms) || ms <= 0) return null
  const totalMinutes = Math.floor(ms / 60000)
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
    total: ms,
  }
}

// ─── Agrégats de liste ────────────────────────────────────────────────────────

/**
 * Niveau par serveur déduit de la liste `GET /violations` : un seul appel suffit
 * à marquer le sélecteur de serveurs, là où `/violations/status` exigerait une
 * requête par guilde. Seuls les groupes **actifs** comptent.
 */
export function guildLevelsFromGroups(groups: ViolationGroup[]): Map<string, SanctionLevel> {
  const levels = new Map<string, SanctionLevel>()
  for (const group of groups) {
    if (!group.active || group.level === 'none') continue
    for (const subject of group.subjects) {
      if (subject.subject_type !== 'discord_guild') continue
      const id = String(subject.subject_id)
      const current = levels.get(id)
      if (!current || levelRank(group.level) > levelRank(current)) {
        levels.set(id, group.level)
      }
    }
  }
  return levels
}

/** `true` tant que le compte à rebours peut encore être stoppé par un appel. */
export function isEnforcementPending(enforcement: Enforcement | null | undefined): boolean {
  return enforcement?.status === 'pending'
}
