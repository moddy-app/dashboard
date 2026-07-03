import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { ACTION_LABEL } from "@/lib/cases-format"
import { revokeSanction } from "@/services/cases"
import type { ApiError, CaseDetail, Sanction } from "@/services/cases-types"
import { LabeledField } from "./form-fields"

export function RevokeSanctionDialog({
  open,
  onOpenChange,
  identifier,
  sanction,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identifier: string
  sanction: Sanction | null
  onDone: (updated: CaseDetail) => void
}) {
  const { toast } = useToast()
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) setNote("")
  }, [open])

  const submit = async () => {
    if (!sanction) return
    setSubmitting(true)
    try {
      const updated = await revokeSanction(
        identifier,
        sanction.id,
        note.trim() || undefined
      )
      toast({ title: "Sanction révoquée", variant: "success" })
      onDone(updated)
      onOpenChange(false)
    } catch (err) {
      const e = err as ApiError
      toast({
        title: "Révocation impossible",
        description: e.message,
        variant: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Révoquer la sanction</DialogTitle>
          <DialogDescription>
            {sanction
              ? `Révoquer le ${ACTION_LABEL[sanction.action].toLowerCase()}. La case sera recalculée (fermée si plus rien n'est actif, sauf verrouillage).`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <LabeledField label="Note" htmlFor="revoke-note">
          <Textarea
            id="revoke-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif de la révocation (optionnel)"
            rows={3}
            maxLength={2000}
          />
        </LabeledField>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting && <Spinner className="size-3.5" />}
            Révoquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
