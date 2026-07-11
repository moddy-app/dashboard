import { useTranslation } from "react-i18next"
import { GavelIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime, absoluteTime } from "@/lib/cases"
import type { Appeal, AppealStatus } from "@/types/cases"
import { ActionChip } from "./case-badges"

const STATUS_TONE: Record<AppealStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400",
  refused: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  transformed: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  cancelled: "bg-muted text-muted-foreground",
}

function Dot() {
  return <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
}

export function AppealsPanel({ appeals }: { appeals: Appeal[] }) {
  const { t, i18n } = useTranslation()

  if (appeals.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("cases.appeals.empty")}</p>
  }

  return (
    <div className="flex flex-col divide-y">
      {appeals.map((a) => (
        <div key={a.id} className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/60">
            <GavelIcon className="size-3.5 text-violet-500" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{t(`cases.appealRoute.${a.route}`)}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  STATUS_TONE[a.status]
                )}
              >
                {t(`cases.appealStatus.${a.status}`)}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ActionChip action={a.action} size="xs" muted />
                {a.status === "transformed" && a.new_action && (
                  <>
                    <span aria-hidden>→</span>
                    <ActionChip action={a.new_action} size="xs" />
                  </>
                )}
              </span>
              <Dot />
              <span title={absoluteTime(a.created_at, i18n.language)}>
                {relativeTime(a.created_at, i18n.language)}
              </span>
            </div>

            {a.reason && (
              <p className="mt-1.5 wrap-break-word text-xs text-foreground/80">{a.reason}</p>
            )}

            {a.decision_note && (
              <p className="mt-1.5 wrap-break-word text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">{t("cases.appeals.decision")}: </span>
                {a.decision_note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
