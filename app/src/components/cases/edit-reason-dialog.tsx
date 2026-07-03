import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { patchCase } from "@/services/cases"
import type { ApiError, CaseDetail } from "@/services/cases-types"
import { LabeledField } from "./form-fields"

export function EditReasonDialog({
  open,
  onOpenChange,
  identifier,
  initialReason,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identifier: string
  initialReason: string
  onDone: (updated: CaseDetail) => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = React.useState(initialReason)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) setReason(initialReason)
  }, [open, initialReason])

  const submit = async () => {
    const value = reason.trim()
    if (!value || value === initialReason) {
      onOpenChange(false)
      return
    }
    setSubmitting(true)
    try {
      const updated = await patchCase(identifier, { reason: value })
      toast({ title: "Motif mis à jour", variant: "success" })
      onDone(updated)
      onOpenChange(false)
    } catch (err) {
      const e = err as ApiError
      toast({
        title: "Modification impossible",
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
          <DialogTitle>Modifier le motif</DialogTitle>
        </DialogHeader>
        <LabeledField label="Motif" htmlFor="edit-reason" required>
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            autoFocus
          />
        </LabeledField>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || !reason.trim()}>
            {submitting && <Spinner className="size-3.5" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
