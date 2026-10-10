// Types et constantes partagés entre la page Automod IA et ses onglets.

/** Valeur sentinelle du Select : Radix interdit un SelectItem de valeur vide. */
export const NO_CHANNEL = "__none__"

/** État du contrôle anti-injection du champ `indications`. */
export type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "rejected"; reason: string }
  | { kind: "unavailable" }

/** Champs de formulaire susceptibles de porter une erreur renvoyée par le PUT. */
export type FieldErrors = Partial<
  Record<"notify_channel_id" | "indications" | "severity" | "max_action" | "features" | "exemptions", string>
>

export type AutomodTabId = "settings" | "scale" | "infractions" | "profiles"

export const AUTOMOD_TABS: readonly AutomodTabId[] = ["settings", "scale", "infractions", "profiles"]
