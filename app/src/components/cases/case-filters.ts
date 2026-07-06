import {
  UserIcon,
  UserCogIcon,
  CircleDotIcon,
  GavelIcon,
  CalendarIcon,
  type LucideIcon,
} from "lucide-react"
import type { CaseStatus, SanctionAction } from "@/types/cases"

// ─── Modèle de filtres (partagé, sans JSX) ────────────────────────────────────

export type FilterKey = "subject" | "issuer" | "status" | "action" | "date"

export interface CaseFilterValues {
  subject?: string
  issuer?: string
  status?: CaseStatus
  action?: SanctionAction
  since?: string
  until?: string
}

export const ALL_FILTER_KEYS: FilterKey[] = ["subject", "issuer", "status", "action", "date"]

export const FILTER_META: Record<FilterKey, { icon: LucideIcon; labelKey: string }> = {
  subject: { icon: UserIcon, labelKey: "cases.filters.subject" },
  issuer: { icon: UserCogIcon, labelKey: "cases.filters.issuer" },
  status: { icon: CircleDotIcon, labelKey: "cases.filters.status" },
  action: { icon: GavelIcon, labelKey: "cases.filters.action" },
  date: { icon: CalendarIcon, labelKey: "cases.filters.date" },
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
