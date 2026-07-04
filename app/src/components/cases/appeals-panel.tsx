import { useTranslation } from "react-i18next"
import { GavelIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/cases"
import type { Appeal, AppealStatus } from "@/types/cases"
import { ActionChip } from "./case-badges"

const STATUS_TONE: Record<AppealStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400",
  refused: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  transformed: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  cancelled: "bg-muted text-muted-foreground",
}

export function AppealsPanel({ appeals }: { appeals: Appeal[] }) {
  const { t, i18n } = useTranslation()

  if (appeals.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("cases.appeals.empty")}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {appeals.map((a) => (
        <div key={a.id} className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2">
            <GavelIcon className="size-3.5 shrink-0 text-violet-500" />
            <span className="text-xs font-medium">{t(`cases.appealRoute.${a.route}`)}</span>
            <span
              className={cn(
                "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                STATUS_TONE[a.status]
              )}
            >
              {t(`cases.appealStatus.${a.status}`)}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ActionChip action={a.action} size="xs" muted />
            {a.status === "transformed" && a.new_action && (
              <>
                <span>→</span>
                <ActionChip action={a.new_action} size="xs" />
              </>
            )}
          </div>

          {a.reason && (
            <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs wrap-break-word text-foreground/80">
              {a.reason}
            </p>
          )}

          {a.decision_note && (
            <p className="mt-1.5 text-xs text-muted-foreground wrap-break-word">
              <span className="font-medium">{t("cases.appeals.decision")}: </span>
              {a.decision_note}
            </p>
          )}

          <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground/70">
            {relativeTime(a.created_at, i18n.language)}
          </p>
        </div>
      ))}
    </div>
  )
}
