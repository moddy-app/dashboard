import { useState } from "react"
import { useTranslation } from "react-i18next"
import { XCircleIcon, LoaderIcon, ClockIcon, InfinityIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ACTION_META, actionTone, absoluteTime } from "@/lib/cases"
import type { Sanction } from "@/types/cases"
import { SanctionStatusBadge } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"

function Dot() {
  return <span className="size-0.5 shrink-0 rounded-full bg-current opacity-50" />
}

interface SanctionsPanelProps {
  sanctions: Sanction[]
  canWrite: boolean
  onRevoke: (sanctionId: string, note?: string) => Promise<void>
}

export function SanctionsPanel({ sanctions, canWrite, onRevoke }: SanctionsPanelProps) {
  const { t, i18n } = useTranslation()
  const [revoking, setRevoking] = useState<Sanction | null>(null)
  const [revokeNote, setRevokeNote] = useState("")
  const [busy, setBusy] = useState(false)

  const confirmRevoke = async () => {
    if (!revoking) return
    setBusy(true)
    try {
      await onRevoke(revoking.id, revokeNote.trim() || undefined)
      setRevoking(null)
      setRevokeNote("")
    } finally {
      setBusy(false)
    }
  }

  if (sanctions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("cases.sanctions.empty")}</p>
  }

  return (
    <>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
        {sanctions.map((s) => {
          const meta = ACTION_META[s.action]
          const tone = actionTone(s.action)
          const Icon = meta.icon
          const active = s.status === "active"
          return (
            <div
              key={s.id}
              className={cn("flex items-start gap-2.5 px-3 py-2.5", !active && "opacity-70")}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                  active ? tone.softBg : "bg-muted"
                )}
              >
                <Icon className={cn("size-3.5", active ? tone.text : "text-muted-foreground")} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{t(`cases.action.${s.action}`)}</span>
                  <SanctionStatusBadge status={s.status} />
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {s.expires_at ? (
                      <>
                        <ClockIcon className="size-3 shrink-0" />
                        {t("cases.sanctions.until", { date: absoluteTime(s.expires_at, i18n.language) })}
                      </>
                    ) : (
                      <>
                        <InfinityIcon className="size-3 shrink-0" />
                        {t("cases.sanctions.permanent")}
                      </>
                    )}
                  </span>
                  <Dot />
                  <span className="inline-flex min-w-0 items-center gap-1">
                    {t("cases.sanctions.by")}
                    <EntityRef kind={s.issued_by_type as EntityKind} id={s.issued_by_id} variant="inline" />
                  </span>
                </div>

                {s.note && (
                  <p className="mt-1.5 wrap-break-word text-xs text-foreground/80">{s.note}</p>
                )}
              </div>

              {canWrite && active && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setRevokeNote("")
                        setRevoking(s)
                      }}
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircleIcon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("cases.sanctions.revoke")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        })}
      </div>

      <AlertDialog open={revoking !== null} onOpenChange={(o) => !o && !busy && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cases.sanctions.revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cases.sanctions.revokeDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={revokeNote}
            onChange={(e) => setRevokeNote(e.target.value)}
            placeholder={t("cases.sanctions.revokeNotePlaceholder")}
            maxLength={2000}
            className="resize-none"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cases.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmRevoke()
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
              {t("cases.sanctions.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
