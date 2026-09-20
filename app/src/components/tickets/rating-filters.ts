import {
  CalendarRangeIcon,
  FolderIcon,
  StarIcon,
  UserCogIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"
import type { TicketRatingsFilters, TicketRatingTrigger } from "@/types/transcripts"

// ─── Modèle de filtres des avis — même schéma en chips que `ticket-filters.ts` ─
//
// `GET /guilds/{id}/tickets/ratings` (`TicketRatingsFilters`) n'accepte que
// `rated_staff_id`, `category_id`, `trigger`, `max_score`, `days` : pas de
// paramètre `score` exact. Le filtre « appréciation » ne peut donc exposer que
// la vue qui existe déjà dans le panneau — « négatifs seulement » — traduite en
// `max_score: 2` ; on n'invente pas un filtre par appréciation précise que le
// backend ne sait pas honorer. `rated_staff_id`, lui, est bien accepté par
// l'API : le filtre « agent » est donc entièrement serveur, comme les autres.

export type RatingFilterKey = "window" | "score" | "trigger" | "category" | "staff"

export interface RatingFilterValues {
  /** Fenêtre d'observation en jours — pilote aussi le résumé du serveur. */
  window?: number
  /** Seule valeur exploitable aujourd'hui : `"negative"` → `max_score: 2`. */
  score?: "negative"
  trigger?: TicketRatingTrigger
  category?: string
  /** Identifiant Discord de l'agent noté (chaîne, jamais `Number()`). */
  staff?: string
}

export const RATING_WINDOWS = [7, 30, 90, 365] as const

export const RATING_FILTER_KEYS: RatingFilterKey[] = [
  "window",
  "score",
  "trigger",
  "category",
  "staff",
]

export const RATING_FILTER_META: Record<RatingFilterKey, { icon: LucideIcon; labelKey: string }> = {
  window: { icon: CalendarRangeIcon, labelKey: "modules.tickets.ratings.filters.window" },
  score: { icon: StarIcon, labelKey: "modules.tickets.ratings.filters.score" },
  trigger: { icon: ZapIcon, labelKey: "modules.tickets.ratings.filters.trigger" },
  category: { icon: FolderIcon, labelKey: "modules.tickets.ratings.filters.category" },
  staff: { icon: UserCogIcon, labelKey: "modules.tickets.ratings.filters.staff" },
}

/** Un filtre est « renseigné » (a une valeur exploitable). */
export function hasRatingFilterValue(key: RatingFilterKey, v: RatingFilterValues): boolean {
  switch (key) {
    case "window":
      return v.window !== undefined
    case "score":
      return !!v.score
    case "trigger":
      return !!v.trigger
    case "category":
      return !!v.category
    case "staff":
      return !!v.staff?.trim()
  }
}

/**
 * `window` n'est **jamais** absent côté API : quand le chip n'est pas posé, la
 * fenêtre par défaut reste 30 jours — le chip ne fait que la rendre explicite
 * et modifiable, pas facultative.
 */
export function ratingWindowDays(v: RatingFilterValues): number {
  return v.window ?? 30
}

/** Convertit les valeurs de filtre UI en query params `getTicketRatings`. */
export function ratingFilterValuesToApi(v: RatingFilterValues): TicketRatingsFilters {
  return {
    days: ratingWindowDays(v),
    category_id: v.category,
    trigger: v.trigger,
    // `max_score: 2` est la vue qui compte : les tickets mal vécus. Jamais de
    // filtre par appréciation exacte, l'API ne sait pas le faire.
    max_score: v.score === "negative" ? 2 : undefined,
    rated_staff_id: v.staff?.trim() || undefined,
  }
}
