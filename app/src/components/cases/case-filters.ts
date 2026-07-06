import {
  UsersIcon,
  UserCogIcon,
  CircleDotIcon,
  GavelIcon,
  CalendarIcon,
  type LucideIcon,
} from "lucide-react"
import type { CaseStatus, SanctionAction } from "@/types/cases"

// ─── Modèle de filtres (partagé, sans JSX) ────────────────────────────────────

export type FilterKey = "subject" | "issuer" | "status" | "action" | "date"

export const DATE_PRESETS = ["today", "yesterday", "thisWeek", "last7", "last30", "thisMonth"] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

export interface CaseFilterValues {
  subject?: string
  issuer?: string
  status?: CaseStatus
  action?: SanctionAction
  since?: string
  until?: string
  /** Préréglage de date choisi (UI seulement — sert au libellé du chip). */
  datePreset?: DatePreset
}

export const ALL_FILTER_KEYS: FilterKey[] = ["subject", "issuer", "status", "action", "date"]

export const FILTER_META: Record<FilterKey, { icon: LucideIcon; labelKey: string }> = {
  subject: { icon: UsersIcon, labelKey: "cases.filters.subject" },
  issuer: { icon: UserCogIcon, labelKey: "cases.filters.issuer" },
  status: { icon: CircleDotIcon, labelKey: "cases.filters.status" },
  action: { icon: GavelIcon, labelKey: "cases.filters.action" },
  date: { icon: CalendarIcon, labelKey: "cases.filters.date" },
}

/** Convertit un préréglage en bornes `since`/`until` (ISO). */
export function datePresetRange(p: DatePreset): { since: string; until: string } {
  const start = new Date()
  const end = new Date()
  switch (p) {
    case "today":
      start.setHours(0, 0, 0, 0)
      break
    case "yesterday":
      start.setDate(start.getDate() - 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(end.getDate() - 1)
      end.setHours(23, 59, 59, 999)
      break
    case "thisWeek": {
      // Semaine ISO (lundi → aujourd'hui).
      const day = (start.getDay() + 6) % 7
      start.setDate(start.getDate() - day)
      start.setHours(0, 0, 0, 0)
      break
    }
    case "last7":
      start.setDate(start.getDate() - 7)
      break
    case "last30":
      start.setDate(start.getDate() - 30)
      break
    case "thisMonth":
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
  }
  return { since: start.toISOString(), until: end.toISOString() }
}

/** Un filtre est « renseigné » (a une valeur exploitable). */
export function hasValue(key: FilterKey, v: CaseFilterValues): boolean {
  switch (key) {
    case "subject":
      return !!v.subject?.trim()
    case "issuer":
      return !!v.issuer?.trim()
    case "status":
      return !!v.status
    case "action":
      return !!v.action
    case "date":
      return !!v.since || !!v.until
  }
}

/** Nombre de filtres réellement renseignés. */
export function countFilters(v: CaseFilterValues, keys: FilterKey[]): number {
  return keys.filter((k) => hasValue(k, v)).length
}

/** Convertit les valeurs de filtre UI en query params d'API. */
export function filterValuesToApi(v: CaseFilterValues): Record<string, string | undefined> {
  return {
    ...(v.subject ? { subject_type: "discord_user", subject_id: v.subject } : {}),
    ...(v.issuer ? { issuer_id: v.issuer } : {}),
    ...(v.status ? { status: v.status } : {}),
    ...(v.action ? { action: v.action } : {}),
    ...(v.since ? { since: v.since } : {}),
    ...(v.until ? { until: v.until } : {}),
  }
}
