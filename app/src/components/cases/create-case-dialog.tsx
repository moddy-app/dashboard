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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import {
  CASE_TYPE_LABEL,
  SCOPE_TYPE_LABEL,
  SUBJECT_TYPE_LABEL,
} from "@/lib/cases-format"
import { createCase } from "@/services/cases"
import type {
  ApiError,
  CaseDetail,
  CasesMeta,
  SanctionAction,
  ScopeType,
  SubjectType,
} from "@/services/cases-types"
import {
  ActionSelect,
  ExpiryField,
  LabeledField,
  localInputToIso,
} from "./form-fields"

type WritableType = "global" | "network"

export function CreateCaseDialog({
  open,
  onOpenChange,
  meta,
  onCreated,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: CasesMeta
  onCreated: (created: CaseDetail) => void
  defaults?: Partial<{
    subject_type: SubjectType
    scope_type: ScopeType
    scope_id: string
  }>
}) {
  const { toast } = useToast()
  const writable = (meta.writable_case_types.filter(
    (t) => t === "global" || t === "network"
  ) as WritableType[]) ?? ["global"]

  const [caseType, setCaseType] = React.useState<WritableType>(writable[0])
  const [subjectType, setSubjectType] = React.useState<SubjectType>(
    defaults?.subject_type ?? "discord_user"
  )
  const [subjectId, setSubjectId] = React.useState("")
  const [scopeType, setScopeType] = React.useState<ScopeType>(
    defaults?.scope_type ?? "platform"
  )
  const [scopeId, setScopeId] = React.useState(defaults?.scope_id ?? "")
  const [reason, setReason] = React.useState("")
  const [action, setAction] = React.useState<SanctionAction | "">("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [note, setNote] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCaseType(writable[0])
    setSubjectType(defaults?.subject_type ?? "discord_user")
    setSubjectId("")
    setScopeType(defaults?.scope_type ?? "platform")
    setScopeId(defaults?.scope_id ?? "")
    setReason("")
    setAction("")
    setExpiresAt("")
    setNote("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const allowedActions = meta.case_type_actions[caseType] ?? []
  const isTemporary = action ? meta.temporary_actions.includes(action) : false

  // Réinitialise l'action si elle sort du périmètre du type choisi.
  React.useEffect(() => {
    if (action && !allowedActions.includes(action)) setAction("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseType])

  const valid =
    subjectId.trim().length > 0 && reason.trim().length > 0 && action !== ""

  const submit = async () => {
    if (action === "" || !subjectId.trim() || !reason.trim()) return
    setSubmitting(true)
    try {
      const created = await createCase({
        case_type: caseType,
        subject_type: subjectType,
        subject_id: subjectId.trim(),
        scope_type: scopeType,
        scope_id: scopeId.trim() || null,
        reason: reason.trim(),
        action,
        expires_at: isTemporary ? localInputToIso(expiresAt) : undefined,
        note: note.trim() || undefined,
      })
      toast({
        title: "Case créée",
        description: created.reference,
        variant: "success",
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err) {
      const e = err as ApiError
      toast({
        title: "Création impossible",
        description: e.message,
        variant: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle case</DialogTitle>
          <DialogDescription>
            La création ouvre une case avec une première sanction. Aucune
            déduplication : chaque envoi crée une case distincte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-0.5 py-0.5 sm:grid-cols-2">
          <LabeledField label="Type de case" required>
            <EnumSelect
              value={caseType}
              onChange={(v) => setCaseType(v as WritableType)}
              options={writable.map((t) => ({
                value: t,
                label: CASE_TYPE_LABEL[t],
              }))}
            />
          </LabeledField>

          <LabeledField label="Action" required>
            <ActionSelect
              value={action}
              onChange={setAction}
              options={allowedActions}
            />
          </LabeledField>

          <LabeledField label="Type de sujet" required>
            <EnumSelect
              value={subjectType}
              onChange={(v) => setSubjectType(v as SubjectType)}
              options={meta.enums.subject_type.map((t) => ({
                value: t,
                label: SUBJECT_TYPE_LABEL[t],
              }))}
            />
          </LabeledField>

          <LabeledField label="ID du sujet" required>
            <Input
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="ID Discord…"
              className="rounded-lg"
            />
          </LabeledField>

          <LabeledField label="Type de portée" required>
            <EnumSelect
              value={scopeType}
              onChange={(v) => setScopeType(v as ScopeType)}
              options={meta.enums.scope_type.map((t) => ({
                value: t,
                label: SCOPE_TYPE_LABEL[t],
              }))}
            />
          </LabeledField>

          <LabeledField label="ID de portée" hint="Optionnel (ex. guild_id).">
            <Input
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder="Optionnel"
              className="rounded-lg"
            />
          </LabeledField>

          {isTemporary && (
            <LabeledField
              label="Expiration"
              hint="Vide = permanent."
              className="sm:col-span-2"
            >
              <ExpiryField value={expiresAt} onChange={setExpiresAt} />
            </LabeledField>
          )}

          <LabeledField label="Motif" required className="sm:col-span-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison de la sanction…"
              rows={3}
              maxLength={2000}
            />
          </LabeledField>

          <LabeledField
            label="Commentaire initial"
            hint="Ajoute un commentaire à l'ouverture (optionnel)."
            className="sm:col-span-2"
          >
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </LabeledField>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!valid || submitting}>
            {submitting && <Spinner className="size-3.5" />}
            Créer la case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EnumSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
