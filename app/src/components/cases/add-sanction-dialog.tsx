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
import { addSanction } from "@/services/cases"
import type {
  ApiError,
  CaseDetail,
  CaseType,
  CasesMeta,
  SanctionAction,
} from "@/services/cases-types"
import {
  ActionSelect,
  ExpiryField,
  LabeledField,
  localInputToIso,
} from "./form-fields"

export function AddSanctionDialog({
  open,
  onOpenChange,
  identifier,
  caseType,
  meta,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  identifier: string
  caseType: CaseType
  meta: CasesMeta
  onDone: (updated: CaseDetail) => void
}) {
  const { toast } = useToast()
  const [action, setAction] = React.useState<SanctionAction | "">("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const allowed = meta.case_type_actions[caseType] ?? []
  const isTemporary = action ? meta.temporary_actions.includes(action) : false

  React.useEffect(() => {
    if (open) {
      setAction("")
      setExpiresAt("")
      setNote("")
    }
  }, [open])

  const submit = async () => {
    if (!action) return
    setSubmitting(true)
    try {
      const updated = await addSanction(identifier, {
        action,
        expires_at: isTemporary ? localInputToIso(expiresAt) : undefined,
        note: note.trim() || undefined,
      })
      toast({ title: "Sanction ajoutée", variant: "success" })
      onDone(updated)
      onOpenChange(false)
    } catch (err) {
      const e = err as ApiError
      toast({
        title: "Ajout impossible",
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
          <DialogTitle>Ajouter une sanction</DialogTitle>
          <DialogDescription>
            Une sanction active rouvre la case (sauf verrouillage).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <LabeledField label="Action" htmlFor="sanction-action" required>
            <ActionSelect
              id="sanction-action"
              value={action}
              onChange={setAction}
              options={allowed}
            />
          </LabeledField>

          {isTemporary && (
            <LabeledField
              label="Expiration"
              htmlFor="sanction-expiry"
              hint="Laisser vide pour une sanction permanente."
            >
              <ExpiryField
                id="sanction-expiry"
                value={expiresAt}
                onChange={setExpiresAt}
              />
            </LabeledField>
          )}

          <LabeledField label="Note" htmlFor="sanction-note">
            <Textarea
              id="sanction-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexte affiché sous la sanction (optionnel)"
              rows={3}
              maxLength={2000}
            />
          </LabeledField>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!action || submitting}>
            {submitting && <Spinner className="size-3.5" />}
            Ajouter la sanction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
