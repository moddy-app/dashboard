import type { TFunction } from "i18next"
import {
  DEFAULT_TIMEOUT_SECONDS,
  GRAVITIES,
  effectiveActions,
  pickLocalized,
  splitDuration,
} from "@/lib/automod"
import type {
  AutomodAction,
  AutomodActionRule,
  AutomodCatalog,
  AutomodGravityPlan,
  AutomodPolicy,
  AutomodSanction,
} from "@/types/api"

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

/** Plan d'actions en une ligne : « Supprimer le message + Mettre en sourdine 2 h ». */
export function formatPlan(
  catalog: AutomodCatalog | null,
  actions: readonly AutomodAction[],
  timeoutSeconds: number | null | undefined,
  lang: string,
  t: TFunction
): string {
  return actions
    .map((id) => {
      const label = actionLabel(catalog, id, lang, t)
      return id === "timeout"
        ? `${label} ${formatTimeout(timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS, t)}`
        : label
    })
    .join(" + ")
}

/**
 * Résumé lisible de la sanction **effective** d'une infraction : le plan
 * personnalisé s'il y en a un, sinon la politique de Moddy (de la gravité la
 * plus basse à la plus haute quand elles diffèrent).
 */
export function summarizeSanction(
  entry: AutomodSanction | undefined,
  policy: AutomodPolicy | undefined,
  catalog: AutomodCatalog | null,
  lang: string,
  t: TFunction,
  rules: readonly AutomodActionRule[] | undefined
): string {
  if (entry?.enabled === false) return t("modules.automod_ai.sanctions.summaryDeleteOnly")
  if (entry?.mode === "perso") {
    if (entry.actions === undefined && entry.by_gravity) {
      return t("modules.automod_ai.scale.legacyTitle")
    }
    const actions = effectiveActions(entry.actions, rules)
    return formatPlan(catalog, actions, entry.timeout_seconds, lang, t)
  }
  const plans = GRAVITIES.map((g) => policy?.by_gravity?.[g]).filter(
    (p): p is AutomodGravityPlan => Boolean(p)
  )
  if (plans.length === 0) return t("modules.automod_ai.sanctions.summaryDefault")
  const text = (p: AutomodGravityPlan) =>
    formatPlan(catalog, effectiveActions(p.actions, rules), p.timeout_seconds, lang, t)
  const first = text(plans[0])
  const last = text(plans[plans.length - 1])
  return first === last ? first : `${first} → ${last}`
}
