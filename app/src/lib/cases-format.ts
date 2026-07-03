import type {
  AppealRoute,
  AppealStatus,
  CaseStatus,
  CaseType,
  SanctionAction,
  SanctionStatus,
  ScopeType,
  SubjectType,
} from "@/services/cases-types"

// ── Libellés FR ────────────────────────────────────────────────────

export const CASE_TYPE_LABEL: Record<CaseType, string> = {
  global: "Global",
  network: "Réseau",
  guild: "Serveur",
  platform: "Plateforme",
  external: "Externe",
}

export const CASE_TYPE_DESCRIPTION: Record<CaseType, string> = {
  global: "Sanction globale du réseau Moddy (un ban = blacklist)",
  network: "Sanction inter-serveurs",
  guild: "Sanction propre à un serveur (bot uniquement)",
  platform: "Niveau plateforme (système)",
  external: "Source externe",
}

export const SUBJECT_TYPE_LABEL: Record<SubjectType, string> = {
  discord_user: "Utilisateur",
  discord_guild: "Serveur",
  moddy_user: "Compte Moddy",
  external: "Externe",
}

export const SCOPE_TYPE_LABEL: Record<ScopeType, string> = {
  discord_guild: "Serveur",
  network: "Réseau",
  platform: "Plateforme",
  external_service: "Service externe",
}

export const ACTION_LABEL: Record<SanctionAction, string> = {
  warn: "Avertissement",
  mute: "Silence",
  ban: "Bannissement",
  kick: "Expulsion",
  restrict: "Restriction",
  revoke_access: "Révocation d'accès",
}

export const SANCTION_STATUS_LABEL: Record<SanctionStatus, string> = {
  active: "Active",
  expired: "Expirée",
  revoked: "Révoquée",
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Ouverte",
  closed: "Fermée",
}

export const APPEAL_STATUS_LABEL: Record<AppealStatus, string> = {
  pending: "En attente",
  accepted: "Accepté",
  refused: "Refusé",
  transformed: "Transformé",
  cancelled: "Annulé",
}

export const APPEAL_ROUTE_LABEL: Record<AppealRoute, string> = {
  server: "Modérateurs du serveur",
  team: "Équipe Moddy",
}

// ── Couleurs / tonalités ───────────────────────────────────────────
// Tonalité neutre = classes Tailwind cohérentes avec le design system.

type Tone = {
  dot: string
  text: string
  bg: string
  border: string
}

export const ACTION_TONE: Record<SanctionAction, Tone> = {
  ban: {
    dot: "bg-destructive",
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
  kick: {
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  mute: {
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  restrict: {
    dot: "bg-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  revoke_access: {
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  warn: {
    dot: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
}

export const SANCTION_STATUS_TONE: Record<SanctionStatus, Tone> = {
  active: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  expired: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
  revoked: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  },
}

// ── Dates ──────────────────────────────────────────────────────────

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" })

export function relativeTime(iso: string): string {
  const date = new Date(iso)
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const year = 365 * day

  if (abs < min) return "à l'instant"
  if (abs < hour) return rtf.format(Math.round(diff / min), "minute")
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour")
  if (abs < week) return rtf.format(Math.round(diff / day), "day")
  if (abs < month) return rtf.format(Math.round(diff / week), "week")
  if (abs < year) return rtf.format(Math.round(diff / month), "month")
  return rtf.format(Math.round(diff / year), "year")
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

/** Durée restante lisible avant une échéance (ex. « 3 j 4 h »). */
export function formatRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return "échéance atteinte"
  const min = Math.floor(diff / 60_000)
  const days = Math.floor(min / (60 * 24))
  const hours = Math.floor((min % (60 * 24)) / 60)
  const minutes = min % 60
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

export function initialsOf(name: string): string {
  const clean = name.trim()
  if (!clean) return "?"
  const parts = clean.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
