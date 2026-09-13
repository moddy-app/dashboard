import {
  CircleDotIcon,
  FolderIcon,
  HashIcon,
  LayoutPanelTopIcon,
  UserCogIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"
import type { TicketStatus } from "@/types/api"

// ─── Modèle de filtres — même schéma en chips que `cases` ─────────────────────
//
// Deux tables distinctes derrière ces filtres, jamais mélangées dans un même
// appel : `GET /tickets` (vivant, filtrable par `status`/`panel_id`/
// `category_id`/`owner_id`) et `GET /tickets/transcripts` (archives, filtrable
// par `category_id`/`owner_id`/`staff_id`/`ticket_number`, jamais `panel_id`).
// D'où deux groupes de filtres qui ne coexistent pas : `panel` n'a de sens que
// côté vivant, `staff` et `number` que côté archives — voir `TicketExplorer`.

export type TicketFilterKey = "status" | "category" | "owner" | "panel" | "staff" | "number"

export interface TicketFilterValues {
  status?: TicketStatus
  category?: string
  owner?: string
  panel?: string
  staff?: string
  number?: string
}

/** Toujours proposables, quel que soit le statut. */
export const COMMON_FILTER_KEYS: TicketFilterKey[] = ["status", "category", "owner"]
/** Le ticket est encore vivant : filtrable par panneau, pas par agent ni numéro. */
export const LIVE_ONLY_FILTER_KEYS: TicketFilterKey[] = ["panel"]
/** Le ticket est fermé : l'archive se filtre par agent et par numéro, jamais par panneau. */
export const ARCHIVE_ONLY_FILTER_KEYS: TicketFilterKey[] = ["staff", "number"]

export const TICKET_FILTER_META: Record<TicketFilterKey, { icon: LucideIcon; labelKey: string }> = {
  status: { icon: CircleDotIcon, labelKey: "modules.tickets.filters.status" },
  category: { icon: FolderIcon, labelKey: "modules.tickets.filters.category" },
  owner: { icon: UserIcon, labelKey: "modules.tickets.filters.owner" },
  panel: { icon: LayoutPanelTopIcon, labelKey: "modules.tickets.filters.panel" },
  staff: { icon: UserCogIcon, labelKey: "modules.tickets.filters.staff" },
  number: { icon: HashIcon, labelKey: "modules.tickets.filters.number" },
}

/** Un filtre est « renseigné » (a une valeur exploitable). */
export function hasTicketFilterValue(key: TicketFilterKey, v: TicketFilterValues): boolean {
  switch (key) {
    case "status":
      return !!v.status
    case "category":
      return !!v.category
    case "owner":
      return !!v.owner?.trim()
    case "panel":
      return !!v.panel
    case "staff":
      return !!v.staff?.trim()
    case "number":
      return !!v.number?.trim()
  }
}

/** Convertit les valeurs de filtre UI en query params `getTickets` (table vivante). */
export function ticketFilterValuesToApi(v: TicketFilterValues) {
  return {
    status: v.status,
    panel_id: v.panel,
    category_id: v.category,
    owner_id: v.owner?.trim() || undefined,
  }
}

/** Convertit les valeurs de filtre UI en query params `getTicketTranscripts` (archives). */
export function ticketFilterValuesToTranscriptApi(v: TicketFilterValues) {
  const number = Number(v.number)
  return {
    category_id: v.category,
    owner_id: v.owner?.trim() || undefined,
    staff_id: v.staff?.trim() || undefined,
    ticket_number: v.number?.trim() && Number.isFinite(number) && number > 0 ? number : undefined,
  }
}
