import { useState } from "react"
import { useTranslation } from "react-i18next"
import { XCircleIcon, LoaderIcon, ClockIcon, InfinityIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { ACTION_META, actionTone, absoluteTime } from "@/lib/cases"
import type { Sanction } from "@/types/cases"
import { SanctionStatusBadge } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"

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
      <div className="flex flex-col gap-2">
        {sanctions.map((s) => {
          const meta = ACTION_META[s.action]
          const tone = actionTone(s.action)
          const Icon = meta.icon
          const revoked = s.status === "revoked"
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-lg border p-2.5",
                s.status === "active" ? tone.border : "border-border",
                revoked && "opacity-70"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone.softBg)}>
                  <Icon className={cn("size-3.5", tone.text)} />
                </span>
                <span className={cn("text-sm font-medium", s.status !== "active" && "text-muted-foreground")}>
                  {t(`cases.action.${s.action}`)}
                </span>
                <div className="ml-auto">
                  <SanctionStatusBadge status={s.status} />
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
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
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">{t("cases.sanctions.by")}</span>
                  <EntityRef kind={s.issued_by_type as EntityKind} id={s.issued_by_id} variant="inline" />
                </span>
              </div>

              {s.note && (
                <p className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs wrap-break-word text-foreground/80">
                  {s.note}
                </p>
              )}

              {canWrite && s.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setRevokeNote("")
                    setRevoking(s)
                  }}
                >
                  <XCircleIcon className="size-3.5" />
                  {t("cases.sanctions.revoke")}
                </Button>
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
