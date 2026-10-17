import { useTranslation } from "react-i18next"
import { ErrorIcon, WarningIcon } from "@/components/icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { AutomodAiStatus } from "@/types/api"

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
          <Alert key={warning} variant={isBlocking ? "destructive" : "default"}>
            {isBlocking ? <ErrorIcon /> : <WarningIcon />}
            <AlertDescription>
              {t(`modules.automod_ai.warnings.${warning}`, {
                defaultValue: t("modules.automod_ai.warnings.unknown", { code: warning }),
              })}
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
