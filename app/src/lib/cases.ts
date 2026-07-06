import {
  AlertTriangleIcon,
  BanIcon,
  MicOffIcon,
  DoorOpenIcon,
  ShieldMinusIcon,
  KeyRoundIcon,
  GavelIcon,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@/lib/auth'
import type {
  SanctionAction,
  CaseType,
  CaseStatus,
} from '@/types/cases'

// ─── Permissions ─────────────────────────────────────────────────────────────
// staff modérateur = staff avec un rôle Dev / Manager / Supervisor_Mod / Moderator
// (Dev = bypass total). Le back-end reste l'autorité (403) — ceci ne fait que
// piloter l'affichage des contrôles d'écriture.

export const MODERATOR_ROLES = ['Dev', 'Manager', 'Supervisor_Mod', 'Moderator']

export function canModerateCases(user: Pick<User, 'is_staff' | 'staff_roles'> | null | undefined): boolean {
  if (!user?.is_staff) return false
  return user.staff_roles.some((r) => MODERATOR_ROLES.includes(r))
}

// ─── Métadonnées d'action de sanction ────────────────────────────────────────
// Chaque action a une couleur d'accent (token Tailwind) et une icône.

interface ActionMeta {
  icon: LucideIcon
  /** Base de couleur pour construire les classes (voir ACTION_TONE). */
  tone: keyof typeof ACTION_TONE
  temporary: boolean
}

export const ACTION_META: Record<SanctionAction, ActionMeta> = {
  warn: { icon: AlertTriangleIcon, tone: 'amber', temporary: false },
  mute: { icon: MicOffIcon, tone: 'sky', temporary: true },
  ban: { icon: BanIcon, tone: 'red', temporary: true },
  kick: { icon: DoorOpenIcon, tone: 'orange', temporary: false },
  restrict: { icon: ShieldMinusIcon, tone: 'violet', temporary: true },
  revoke_access: { icon: KeyRoundIcon, tone: 'slate', temporary: false },
}

// Classes statiques par ton (Tailwind ne peut pas générer des noms dynamiques).
export const ACTION_TONE = {
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    softBg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
  },
  sky: {
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    softBg: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-900',
    dot: 'bg-sky-500',
  },
  red: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-950/60',
    softBg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    dot: 'bg-red-500',
  },
  orange: {
    text: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    softBg: 'bg-orange-50 dark:bg-orange-950/40',
    border: 'border-orange-200 dark:border-orange-900',
    dot: 'bg-orange-500',
  },
  violet: {
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-950/60',
    softBg: 'bg-violet-50 dark:bg-violet-950/40',
    border: 'border-violet-200 dark:border-violet-900',
    dot: 'bg-violet-500',
  },
  slate: {
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    softBg: 'bg-slate-50 dark:bg-slate-900/40',
    border: 'border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
  },
} as const

export function actionTone(action: SanctionAction) {
  return ACTION_TONE[ACTION_META[action].tone]
}

// ─── Métadonnées de type de case ─────────────────────────────────────────────

export const CASE_TYPE_TONE: Record<CaseType, keyof typeof ACTION_TONE> = {
  global: 'red',
  network: 'violet',
  guild: 'sky',
  platform: 'slate',
  external: 'orange',
}

export const GAVEL_ICON = GavelIcon

export function caseStatusIsOpen(status: CaseStatus): boolean {
  return status === 'open'
}

// ─── Accent « filtre » ────────────────────────────────────────────────────────
// Bleu distinct du bouton d'action principale (primary) : sert aux labels de
// filtre actifs et à l'état actif du bouton « filtrer ».

export const FILTER_ACCENT_CHIP =
  'border-blue-300 bg-blue-100/70 text-blue-700 hover:bg-blue-100 dark:border-blue-800/80 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/50'

export const FILTER_ACCENT_BUTTON =
  'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-800/80 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50'

/** Copie une valeur dans le presse-papiers (best-effort). */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

// ─── Formatage ────────────────────────────────────────────────────────────────

/** Temps relatif compact et localisé (ex. « 3d », « 2h », « just now »). */
export function relativeTime(iso: string, locale = 'en'): string {
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const sec = Math.round(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
  if (Math.abs(sec) < 60) return rtf.format(-sec, 'second')
  const min = Math.round(sec / 60)
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (Math.abs(hr) < 24) return rtf.format(-hr, 'hour')
  const day = Math.round(hr / 24)
  if (Math.abs(day) < 30) return rtf.format(-day, 'day')
  const month = Math.round(day / 30)
  if (Math.abs(month) < 12) return rtf.format(-month, 'month')
  return rtf.format(-Math.round(month / 12), 'year')
}

/** Date + heure absolues, localisées (pour les tooltips / propriétés). */
export function absoluteTime(iso: string, locale = 'en'): string {
  return new Date(iso).toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Durée jusqu'à échéance, ou « permanent » si null. */
export function formatExpiry(expiresAt: string | null, locale = 'en'): string | null {
  if (!expiresAt) return null
  return absoluteTime(expiresAt, locale)
}
