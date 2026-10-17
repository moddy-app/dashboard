import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ActionPlan } from "@/components/automod/action-plan"
import { InfoIcon } from "@/components/icons"
import { actionLabel, formatTimeout } from "@/lib/automod-labels"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  AUTOMOD_ACTION_IDS,
  GRAVITIES,
  effectiveActions,
  joinDuration,
  pickLocalized,
  splitDuration,
  timeoutBounds,
} from "@/lib/automod"
import type {
  AutomodAction,
  AutomodCatalog,
  AutomodGravityPlan,
  AutomodPolicy,
} from "@/types/api"

export function GravityPlans({
  plans,
  catalog,
}: {
  plans: Partial<Record<string, AutomodGravityPlan>>
  catalog: AutomodCatalog
}) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const shown = GRAVITIES.filter((g) => plans[g])
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {shown.map((g) => {
        const plan = plans[g]
        return (
          <div key={g} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">
              {pickLocalized(catalog.gravities.find((x) => x.id === g)?.name, lang) || g}
            </dt>
            <dd className="text-right">
              <ActionPlan
                catalog={catalog}
                actions={plan?.actions ?? ["delete"]}
                timeoutSeconds={plan?.timeout_seconds}
              />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Ce que Moddy applique réellement (`GET .../policies`), à la place de l'ancien « défaut ». */
export function PolicyView({
  policy,
  unavailable,
  catalog,
}: {
  policy: AutomodPolicy | undefined
  unavailable: boolean
  catalog: AutomodCatalog
}) {
  const { t } = useTranslation()
  if (!policy) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(unavailable ? "modules.automod_ai.scale.policyUnavailable" : "modules.automod_ai.scale.policyMissing")}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("modules.automod_ai.scale.policyTitle")}
      </p>
      <GravityPlans plans={policy.by_gravity} catalog={catalog} />
      <div className="flex flex-wrap gap-1">
        {policy.recidive && <Badge variant="outline">{t("modules.automod_ai.scale.policyRecidive")}</Badge>}
        {policy.require_approval && (
          <Badge variant="outline">{t("modules.automod_ai.scale.policyApproval")}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("modules.automod_ai.scale.autoNote")}</p>
    </div>
  )
}

/** Plan par gravité hérité d'une ancienne config : lecture seule. */
export function LegacyPlan({
  plans,
  catalog,
  onReplace,
}: {
  plans: Partial<Record<string, AutomodGravityPlan>>
  catalog: AutomodCatalog
  onReplace: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <GravityPlans plans={plans} catalog={catalog} />
      <Alert>
        <InfoIcon />
        <AlertTitle>{t("modules.automod_ai.scale.legacyTitle")}</AlertTitle>
        <AlertDescription>{t("modules.automod_ai.scale.legacyDescription")}</AlertDescription>
        <AlertAction inline>
          <Button type="button" size="sm" variant="outline" onClick={onReplace}>
            {t("modules.automod_ai.scale.legacyReplace")}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

// ─── Plan personnalisé ────────────────────────────────────────────────────────

export interface ActionsFieldProps {
  rowKey: string
  actions: AutomodAction[]
  rules: readonly { action: AutomodAction; supersedes: AutomodAction[] }[]
  catalog: AutomodCatalog
  onChange: (next: AutomodAction[]) => void
}

/** Multi-sélection d'actions ; celles remplacées par une autre restent cochables mais grisées. */
export function ActionsField({ rowKey, actions, rules, catalog, onChange }: ActionsFieldProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const label = (id: string) => actionLabel(catalog, id, lang, t)
  const kept = effectiveActions(actions, rules)

  const supersededBy = (id: AutomodAction): AutomodAction | null =>
    rules.find((r) => actions.includes(r.action) && (r.supersedes ?? []).includes(id))?.action ?? null

  const toggle = (id: AutomodAction, checked: boolean) => {
    const next = checked ? [...actions, id] : actions.filter((a) => a !== id)
    // Canonique : ordre de l'enum, jamais vide (une liste vide vaut `delete`).
    onChange(AUTOMOD_ACTION_IDS.filter((a) => next.includes(a)))
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{t("modules.automod_ai.scale.actionsLabel")}</FieldLegend>
      <FieldDescription>{t("modules.automod_ai.scale.actionsHelp")}</FieldDescription>
      <FieldGroup className="gap-3">
        {AUTOMOD_ACTION_IDS.map((id) => {
          const selected = actions.includes(id)
          const by = selected && !kept.includes(id) ? supersededBy(id) : null
          const description = pickLocalized(catalog.actions?.find((a) => a.id === id)?.description, lang)
          const inputId = `action-${rowKey}-${id}`
          return (
            <Field key={id} orientation="horizontal" data-disabled={by ? true : undefined}>
              <Checkbox
                id={inputId}
                checked={selected}
                disabled={selected && actions.length === 1}
                onCheckedChange={(v) => toggle(id, v === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor={inputId} className={cn(by && "text-muted-foreground line-through")}>
                  {label(id)}
                </FieldLabel>
                {by ? (
                  <FieldDescription>
                    {t("modules.automod_ai.scale.supersededBy", { action: label(by) })}
                  </FieldDescription>
                ) : (
                  description && <FieldDescription>{description}</FieldDescription>
                )}
              </FieldContent>
            </Field>
          )
        })}
      </FieldGroup>
    </FieldSet>
  )
}

interface TimeoutFieldProps {
  rowKey: string
  seconds: number
  catalog: AutomodCatalog
  onChange: (seconds: number) => void
}

/** Durée exacte du timeout en jours / heures / minutes, bornée par le catalogue. */
export function TimeoutField({ rowKey, seconds, catalog, onChange }: TimeoutFieldProps) {
  const { t } = useTranslation()
  const { min, max } = timeoutBounds(catalog)
  // Saisie locale tant qu'elle est en cours : une valeur hors bornes n'est pas
  // écrite dans le brouillon, et le champ revient à la dernière valeur valide au blur.
  const [typing, setTyping] = useState<{ days: string; hours: string; minutes: string } | null>(null)
  const parts = splitDuration(seconds)
  const shown = typing ?? {
    days: String(parts.days),
    hours: String(parts.hours),
    minutes: String(parts.minutes),
  }
  const toInt = (v: string) => Math.max(0, Number.parseInt(v, 10) || 0)
  const total = joinDuration({
    days: toInt(shown.days),
    hours: toInt(shown.hours),
    minutes: toInt(shown.minutes),
  })
  const invalid = total < min || total > max

  const edit = (unit: "days" | "hours" | "minutes", value: string) => {
    const next = { ...shown, [unit]: value }
    setTyping(next)
    const secondsNext = joinDuration({
      days: toInt(next.days),
      hours: toInt(next.hours),
      minutes: toInt(next.minutes),
    })
    if (secondsNext >= min && secondsNext <= max) onChange(secondsNext)
  }

  const units = [
    { id: "days" as const, label: t("modules.automod_ai.scale.unitDays") },
    { id: "hours" as const, label: t("modules.automod_ai.scale.unitHours") },
    { id: "minutes" as const, label: t("modules.automod_ai.scale.unitMinutes") },
  ]

  return (
    <FieldSet data-invalid={invalid || undefined}>
      <FieldLegend variant="label">{t("modules.automod_ai.scale.timeoutLabel")}</FieldLegend>
      <div className="flex flex-wrap gap-3">
        {units.map((u) => (
          <Field key={u.id} className="w-24">
            <FieldLabel htmlFor={`timeout-${rowKey}-${u.id}`}>{u.label}</FieldLabel>
            <Input
              id={`timeout-${rowKey}-${u.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={shown[u.id]}
              aria-invalid={invalid || undefined}
              onChange={(e) => edit(u.id, e.target.value)}
              onBlur={() => setTyping(null)}
            />
          </Field>
        ))}
      </div>
      {invalid ? (
        <FieldError>
          {t("modules.automod_ai.scale.timeoutRange", {
            min: formatTimeout(min, t),
            max: formatTimeout(max, t),
          })}
        </FieldError>
      ) : (
        <FieldDescription>
          {t("modules.automod_ai.scale.timeoutHelp", {
            min: formatTimeout(min, t),
            max: formatTimeout(max, t),
          })}
        </FieldDescription>
      )}
    </FieldSet>
  )
}

interface ApprovalFieldProps {
  rowKey: string
  checked: boolean
  allowed: boolean
  isProfile: boolean
  onChange: (value: boolean) => void
}

/** « Validation par un modérateur » : indisponible pour les profils et les plans qui ne font que supprimer. */
export function ApprovalField({ rowKey, checked, allowed, isProfile, onChange }: ApprovalFieldProps) {
  const { t } = useTranslation()
  const id = `approval-${rowKey}`
  return (
    <Field orientation="horizontal" data-disabled={allowed ? undefined : true}>
      <Checkbox
        id={id}
        checked={allowed && checked}
        disabled={!allowed}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{t("modules.automod_ai.scale.requireApproval")}</FieldLabel>
        <FieldDescription>
          {t(
            allowed
              ? "modules.automod_ai.scale.requireApprovalHelp"
              : isProfile
                ? "modules.automod_ai.scale.requireApprovalProfile"
                : "modules.automod_ai.scale.requireApprovalDeleteOnly"
          )}
        </FieldDescription>
      </FieldContent>
    </Field>
  )
}

// ─── Briques ──────────────────────────────────────────────────────────────────
