import type { TFunction } from "i18next"
import { pickLocalized, splitDuration } from "@/lib/automod"
import type { AutomodCatalog } from "@/types/api"

/** Libellé d'une action : le catalogue d'abord, puis nos traductions de repli. */
export function actionLabel(
  catalog: AutomodCatalog | null,
  id: string,
  lang: string,
  t: TFunction
): string {
  const fromCatalog = pickLocalized(catalog?.actions?.find((a) => a.id === id)?.name, lang)
  return fromCatalog || t(`modules.automod_ai.scale.actions.${id}`, { defaultValue: id })
}

/** Durée lisible : « 1 j 2 h 30 min » (jamais vide). */
export function formatTimeout(seconds: number, t: TFunction): string {
  const { days, hours, minutes } = splitDuration(seconds)
  const parts: string[] = []
  if (days) parts.push(t("modules.automod_ai.scale.durationDays", { count: days }))
  if (hours) parts.push(t("modules.automod_ai.scale.durationHours", { count: hours }))
  if (minutes || parts.length === 0) {
    parts.push(t("modules.automod_ai.scale.durationMinutes", { count: minutes }))
  }
  return parts.join(" ")
}
