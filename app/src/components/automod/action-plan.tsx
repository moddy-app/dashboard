import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { DEFAULT_TIMEOUT_SECONDS, effectiveActions } from "@/lib/automod"
import { actionLabel, formatTimeout } from "@/lib/automod-labels"
import type { AutomodAction, AutomodCatalog } from "@/types/api"

interface ActionPlanProps {
  catalog: AutomodCatalog | null
  actions: AutomodAction[]
  timeoutSeconds?: number | null
}

/**
 * Plan d'actions en pastilles. Seules les actions réellement appliquées
 * (après substitution) sont rendues, avec la durée à côté du timeout.
 */
export function ActionPlan({ catalog, actions, timeoutSeconds }: ActionPlanProps) {
  const { t, i18n } = useTranslation()
  const applied = effectiveActions(actions, catalog?.action_rules)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {applied.map((a) => (
        <Badge key={a} variant="secondary">
          {actionLabel(catalog, a, i18n.language, t)}
          {a === "timeout" ? ` · ${formatTimeout(timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS, t)}` : ""}
        </Badge>
      ))}
    </span>
  )
}
