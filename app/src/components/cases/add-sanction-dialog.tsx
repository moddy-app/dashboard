import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { LoaderIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ACTION_META } from "@/lib/cases"
import type { SanctionAction, SanctionCreateInput } from "@/types/cases"
import { ActionPicker, ExpiryField } from "./action-picker"

interface AddSanctionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allowedActions: SanctionAction[]
  onSubmit: (input: SanctionCreateInput) => Promise<void>
}

export function AddSanctionDialog({ open, onOpenChange, allowedActions, onSubmit }: AddSanctionDialogProps) {
  const { t } = useTranslation()
  const [action, setAction] = useState<SanctionAction | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setAction(allowedActions[0] ?? null)
      setExpiresAt(null)
      setNote("")
    }
  }, [open, allowedActions])

  const temporary = action ? ACTION_META[action].temporary : false

  const submit = async () => {
    if (!action) return
    setBusy(true)
    try {
      await onSubmit({
        action,
        expires_at: temporary ? expiresAt : null,
        note: note.trim() || undefined,
      })
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cases.addSanction.title")}</DialogTitle>
          <DialogDescription>{t("cases.addSanction.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("cases.form.action")}</label>
            <ActionPicker actions={allowedActions} value={action} onChange={setAction} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("cases.form.duration")}</label>
            <ExpiryField value={expiresAt} onChange={setExpiresAt} temporary={temporary} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              {t("cases.form.note")} <span className="text-muted-foreground">({t("cases.form.optional")})</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("cases.form.sanctionNotePlaceholder")}
              maxLength={2000}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("cases.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !action}>
            {busy && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
            {t("cases.addSanction.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
