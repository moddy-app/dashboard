import {
  BanIcon,
  ShieldAlertIcon,
  ShieldMinusIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react'
import { ApiError } from '@/lib/auth'
import type {
  Enforcement,
  SanctionErrorPayload,
  SanctionLevel,
  SubjectSanctionStatus,
  ViolationGroup,
} from '@/types/violations'

/** Page publique où déposer un appel (il n'existe aucun endpoint d'appel). */
export const APPEAL_URL = 'https://moddy.app/support'

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

export interface LevelTone {
  icon: LucideIcon
  text: string
  softBg: string
  border: string
  dot: string
  /** Fond des blocs pleins (bandeaux, médaillons d'en-tête). */
  bg: string
}

export const LEVEL_TONE: Record<SanctionLevel, LevelTone> = {
  none: {
    icon: ShieldCheckIcon,
    text: 'text-green-600 dark:text-green-400',
    softBg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-200 dark:border-green-900',
    dot: 'bg-green-500',
    bg: 'bg-green-100 dark:bg-green-950/60',
  },
  warn: {
    icon: ShieldAlertIcon,
    text: 'text-amber-600 dark:text-amber-400',
    softBg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
  },
  limited: {
    icon: ShieldMinusIcon,
    text: 'text-orange-600 dark:text-orange-400',
    softBg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900',
    dot: 'bg-orange-500',
    bg: 'bg-orange-100 dark:bg-orange-950/60',
  },
  suspended: {
    icon: BanIcon,
    text: 'text-red-600 dark:text-red-400',
    softBg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    dot: 'bg-red-500',
    bg: 'bg-red-100 dark:bg-red-950/60',
  },
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
