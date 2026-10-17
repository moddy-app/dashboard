// Types et constantes partagés entre la page Automod et ses onglets.

/** Champs de formulaire susceptibles de porter une erreur renvoyée par le PUT. */
export type FieldErrors = Partial<
  Record<"notify_channel_id" | "severity" | "max_action" | "features" | "exemptions", string>
>

export type AutomodTabId = "settings" | "monitoring" | "sanctions" | "exemptions" | "advanced"

export const AUTOMOD_TABS: readonly AutomodTabId[] = [
  "settings",
  "monitoring",
  "sanctions",
  "exemptions",
  "advanced",
]
