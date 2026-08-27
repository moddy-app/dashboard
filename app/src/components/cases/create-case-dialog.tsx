import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ACTION_META, CASE_TYPE_TONE, ACTION_TONE } from "@/lib/cases"
import { handleSaveError } from "@/lib/handle-error"
import { createCase } from "@/services/cases"
import type {
  CasesMeta,
  CaseDetail,
  CaseType,
  SubjectType,
  ScopeType,
  SanctionAction,
} from "@/types/cases"
import { ActionPicker, ExpiryField } from "./action-picker"

interface CreateCaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: CasesMeta
  onCreated: (created: CaseDetail) => void
  /** Verrouille le type (ex. « global » pour le panel staff). */
  lockCaseType?: "global" | "network"
  /** Valeurs pré-remplies (ex. depuis un serveur ou la blacklist). */
  defaults?: Partial<{
    case_type: CaseType
    subject_type: SubjectType
    subject_id: string
    scope_type: ScopeType
    scope_id: string
  }>
}

const REASON_MAX = 2000

export function CreateCaseDialog({
  open,
  onOpenChange,
  meta,
  onCreated,
  lockCaseType,
  defaults,
}: CreateCaseDialogProps) {
  const { t } = useTranslation()

  const writableTypes = meta.writable_case_types.filter(
    (ct): ct is "global" | "network" => ct === "global" || ct === "network"
  )

  const [caseType, setCaseType] = useState<"global" | "network">(
    lockCaseType ?? writableTypes[0] ?? "global"
  )
  const [subjectType, setSubjectType] = useState<SubjectType>("discord_user")
  const [subjectId, setSubjectId] = useState("")
  const [scopeType, setScopeType] = useState<ScopeType>("platform")
  const [scopeId, setScopeId] = useState("")
  const [reason, setReason] = useState("")
  const [action, setAction] = useState<SanctionAction | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const allowedActions = useMemo(() => meta.case_type_actions[caseType] ?? [], [meta, caseType])

  // Le type est verrouillé (staff) OU imposé par le contexte serveur → pas de toggle.
  const showTypeToggle = !lockCaseType && !defaults?.case_type && writableTypes.length > 1
  // La portée est contextuelle (fournie par la page) → on masque les sélecteurs.
  const showScope = !defaults?.scope_type

  // Réinitialise à l'ouverture, applique les defaults.
  useEffect(() => {
    if (!open) return
    const ct: "global" | "network" =
      lockCaseType ?? (defaults?.case_type === "network" ? "network" : writableTypes[0] ?? "global")
    setCaseType(ct)
    setSubjectType(defaults?.subject_type ?? "discord_user")
    setSubjectId(defaults?.subject_id ?? "")
    setScopeType(defaults?.scope_type ?? (ct === "global" ? "platform" : "network"))
    setScopeId(defaults?.scope_id ?? "")
    setReason("")
    setNote("")
    setExpiresAt(null)
    setAction((meta.case_type_actions[ct] ?? [])[0] ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Garde l'action valide quand le type change.
  useEffect(() => {
    if (action && !allowedActions.includes(action)) {
      setAction(allowedActions[0] ?? null)
    }
  }, [allowedActions, action])

  const temporary = action ? ACTION_META[action].temporary : false
  const tone = ACTION_TONE[CASE_TYPE_TONE[caseType]]

  const submit = async () => {
    if (!subjectId.trim()) return toast.error(t("cases.create.errorSubject"))
    if (!reason.trim()) return toast.error(t("cases.create.errorReason"))
    if (!action) return toast.error(t("cases.create.errorAction"))
    setBusy(true)
    try {
      const created = await createCase({
        case_type: caseType,
        subject_type: subjectType,
        subject_id: subjectId.trim(),
        scope_type: scopeType,
        scope_id: scopeId.trim() || null,
        reason: reason.trim(),
        action,
        expires_at: temporary ? expiresAt : null,
        note: note.trim() || undefined,
      })
      toast.success(t("cases.create.success", { reference: created.reference }))
      onCreated(created)
      onOpenChange(false)
    } catch (e) {
      handleSaveError(e, { title: t("cases.create.error") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("cases.create.title")}
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                tone.border,
                tone.softBg,
                tone.text
              )}
            >
              {t(`cases.type.${caseType}`)}
            </span>
          </DialogTitle>
          <DialogDescription>
            {lockCaseType === "global"
              ? t("cases.create.descriptionGlobal")
              : t("cases.create.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Type de case (uniquement si non contextuel) */}
          {showTypeToggle && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("cases.form.caseType")}</label>
              <div className="inline-flex w-full rounded-lg border bg-muted/40 p-0.5">
                {writableTypes.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setCaseType(ct)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                      caseType === ct ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(`cases.type.${ct}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sujet */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("cases.form.subject")}</label>
            <div className="flex gap-2">
              <Select value={subjectType} onValueChange={(v) => setSubjectType(v as SubjectType)}>
                <SelectTrigger className="w-[150px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meta.enums.subject_type.map((st) => (
                    <SelectItem key={st} value={st}>
                      {t(`cases.subjectType.${st}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                placeholder={t("cases.form.subjectIdPlaceholder")}
                className="flex-1 font-mono"
              />
            </div>
          </div>

          {/* Portée (uniquement hors contexte serveur) */}
          {showScope && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t("cases.form.scope")}</label>
              <div className="flex gap-2">
                <Select value={scopeType} onValueChange={(v) => setScopeType(v as ScopeType)}>
                  <SelectTrigger className="w-[150px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.enums.scope_type.map((st) => (
                      <SelectItem key={st} value={st}>
                        {t(`cases.scopeType.${st}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  placeholder={t("cases.form.scopeIdOptional")}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          )}

          {/* Raison */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("cases.form.reason")}</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("cases.form.reasonPlaceholder")}
              maxLength={REASON_MAX}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Action */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("cases.form.action")}</label>
            <ActionPicker actions={allowedActions} value={action} onChange={setAction} />
          </div>

          {/* Durée */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{t("cases.form.duration")}</label>
            <ExpiryField value={expiresAt} onChange={setExpiresAt} temporary={temporary} />
          </div>

          {/* Commentaire initial */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              {t("cases.form.initialComment")}{" "}
              <span className="font-normal text-muted-foreground">({t("cases.form.optional")})</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("cases.form.initialCommentPlaceholder")}
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
          <Button onClick={submit} disabled={busy}>
            {busy && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
            {t("cases.create.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
