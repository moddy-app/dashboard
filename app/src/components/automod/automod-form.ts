// Types et constantes partagés entre la page Automod IA et ses onglets.

/** Valeur sentinelle du Select : Radix interdit un SelectItem de valeur vide. */
export const NO_CHANNEL = "__none__"

/** Champs de formulaire susceptibles de porter une erreur renvoyée par le PUT. */
export type FieldErrors = Partial<
  Record<"notify_channel_id" | "severity" | "max_action" | "features" | "exemptions", string>
>

export type AutomodTabId = "settings" | "scale" | "infractions" | "profiles"

export const AUTOMOD_TABS: readonly AutomodTabId[] = ["settings", "scale", "infractions", "profiles"]
