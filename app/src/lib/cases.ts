import {
  AlertTriangleIcon,
  BanIcon,
  MicOffIcon,
  DoorOpenIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
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
  // Aucune action de case n'est « verte » — ce ton sert au niveau *sain* des
  // sanctions globales (`LEVEL_TONE.none`), qui partage cette palette pour que
  // les deux vues aient exactement les mêmes couleurs.
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    softBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900',
    dot: 'bg-emerald-500',
  },
} as const

export function actionTone(action: SanctionAction) {
  return ACTION_TONE[ACTION_META[action].tone]
}

// ─── Niveaux de sanction globale (source unique) ─────────────────────────────

/**
 * Ton et icône des quatre niveaux de sanction globale. Ils vivent ici, avec
 * `ACTION_TONE`, parce que **deux** consommateurs en dépendent et doivent
 * s'accorder au pixel : `LEVEL_TONE` (`lib/sanctions.ts`) pour les pastilles de
 * niveau, et `ActionChip` pour les mesures d'un dossier global. Sans source
 * unique, une « limitation » finit violette à côté d'un « limité » orange.
 */
export const SANCTION_LEVEL_HUE = {
  none: 'emerald',
  warn: 'amber',
  limited: 'orange',
  suspended: 'red',
} as const satisfies Record<string, keyof typeof ACTION_TONE>

export const SANCTION_LEVEL_ICON = {
  none: ShieldCheckIcon,
  warn: ShieldAlertIcon,
  limited: ShieldMinusIcon,
  suspended: BanIcon,
}

/** Niveau porté par une mesure globale. Les autres actions n'existent pas en global. */
const GLOBAL_ACTION_LEVEL = {
  warn: 'warn',
  restrict: 'limited',
  ban: 'suspended',
} as const

/**
 * Apparence d'une action : ton + icône. Sur un dossier **global**, une mesure
 * emprunte celles de son niveau — une suspension est rouge comme le niveau
 * « suspendu », une limitation orange comme « limité ». Ailleurs, elle garde
 * l'apparence de l'action de modération correspondante.
 */
export function actionAppearance(action: SanctionAction, caseType?: CaseType | null) {
  const level = GLOBAL_ACTION_LEVEL[action as keyof typeof GLOBAL_ACTION_LEVEL]
  if (isGlobalCaseType(caseType) && level) {
    return { tone: ACTION_TONE[SANCTION_LEVEL_HUE[level]], icon: SANCTION_LEVEL_ICON[level] }
  }
  return { tone: actionTone(action), icon: ACTION_META[action].icon }
}

// ─── Vocabulaire : modération de serveur vs sanction globale ─────────────────

/**
 * Les cases `global` et `network` portent des **sanctions globales** — les
 * mêmes que celles de `/violations`. Leur vocabulaire doit donc être celui-là :
 * un `ban` global est une « suspension », pas un « bannissement ». Sans ça, le
 * même dossier se lit différemment selon la page où on le regarde.
 */
export function isGlobalCaseType(type: CaseType | null | undefined): boolean {
  return type === 'global' || type === 'network'
}

/**
 * Clé i18n du libellé d'une action, selon la portée du dossier.
 * `violations.action.*` ne couvre que `warn` / `restrict` / `ban` : les autres
 * actions n'existent pas en global et gardent le libellé de modération.
 */
export function actionLabelKey(
  action: SanctionAction,
  caseType?: CaseType | null
): string {
  const isGlobalAction = action === 'warn' || action === 'restrict' || action === 'ban'
  return isGlobalCaseType(caseType) && isGlobalAction
    ? `violations.action.${action}`
    : `cases.action.${action}`
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
export function relativeTime(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return '—'
  const diffMs = Date.now() - ms
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
export function absoluteTime(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Durée jusqu'à échéance, ou « permanent » si null. */
export function formatExpiry(expiresAt: string | null, locale = 'en'): string | null {
  if (!expiresAt) return null
  return absoluteTime(expiresAt, locale)
}
