import { useTranslation } from "react-i18next"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AutomodAiStatus } from "@/types/api"

// ─── Badges d'état ────────────────────────────────────────────────────────────

/** Le badge se lit sur `running`, jamais sur `enabled` (trois conditions). */
export function StatusBadges({ status }: { status: AutomodAiStatus | null }) {
  const { t } = useTranslation()
  if (!status) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status.running ? (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2Icon className="size-3 mr-1" />
          {t("modules.automod_ai.statusRunning")}
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XIcon className="size-3 mr-1" />
          {t("modules.automod_ai.statusStopped")}
        </Badge>
      )}
      {status.dry_run && (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
          <FlaskConicalIcon className="size-3 mr-1" />
          {t("modules.automod_ai.dryRunBadge")}
        </Badge>
      )}
    </div>
  )
}

/** Avertissements renvoyés par `/status`, traduits et hiérarchisés. */
export function StatusWarnings({ status }: { status: AutomodAiStatus | null }) {
  const { t } = useTranslation()
  // La sanction globale a déjà son bandeau : on ne la dit pas deux fois.
  const warnings = status?.warnings.filter((w) => w !== "blocked_by_global_sanction") ?? []
  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {warnings.map((warning) => {
        // `missing_notify_channel` est la mauvaise config n°1 : elle empêche le
        // module de tourner → traitée visuellement comme une erreur.
        const isBlocking = warning === "missing_notify_channel"
        return (
          <div
            key={warning}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
              isBlocking
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
            )}
          >
            {isBlocking ? (
              <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlertIcon className="size-4 mt-0.5 shrink-0" />
            )}
            <span>
              {t(`modules.automod_ai.warnings.${warning}`, {
                defaultValue: t("modules.automod_ai.warnings.unknown", { code: warning }),
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}
