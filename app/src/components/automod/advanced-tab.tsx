import { useTranslation } from "react-i18next"
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FieldErrors } from "@/components/automod/automod-form"
import type { AutomodAiConfig, AutomodMaxAction } from "@/types/api"

const MAX_ACTIONS: AutomodMaxAction[] = ["warn", "mute", "ban"]
const SEVERITIES = [1, 2, 3, 4, 5] as const

interface AutomodAdvancedTabProps {
  draft: AutomodAiConfig
  fieldErrors: FieldErrors
  onPatch: (changes: Partial<AutomodAiConfig>) => void
}

export function AutomodAdvancedTab({ draft, fieldErrors, onPatch }: AutomodAdvancedTabProps) {
  const { t } = useTranslation()

  return (
    <FieldGroup>
      <Field data-invalid={fieldErrors.max_action ? true : undefined}>
        <FieldLabel>{t("modules.automod_ai.maxAction")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={draft.max_action}
          onValueChange={(v) => v && onPatch({ max_action: v as AutomodMaxAction })}
          className="w-full sm:w-fit"
          aria-label={t("modules.automod_ai.maxAction")}
        >
          {MAX_ACTIONS.map((action) => (
            <ToggleGroupItem key={action} value={action} className="flex-1 sm:flex-none">
              {t(`modules.automod_ai.maxAction_${action}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {fieldErrors.max_action ? (
          <FieldError>{fieldErrors.max_action}</FieldError>
        ) : (
          <FieldDescription>
            {t(`modules.automod_ai.maxAction_${draft.max_action}_desc`, { defaultValue: "" })}{" "}
            {t("modules.automod_ai.maxActionDescription")}
          </FieldDescription>
        )}
      </Field>

      <Field data-invalid={fieldErrors.severity ? true : undefined}>
        <FieldLabel>{t("modules.automod_ai.severity")}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={String(draft.severity)}
          onValueChange={(v) => v && onPatch({ severity: Number(v) })}
          className="w-full sm:w-fit"
          aria-label={t("modules.automod_ai.severity")}
        >
          {SEVERITIES.map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="flex-1 tabular-nums sm:flex-none sm:px-4">
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {fieldErrors.severity ? (
          <FieldError>{fieldErrors.severity}</FieldError>
        ) : (
          <FieldDescription>
            {t(`modules.automod_ai.severity_${draft.severity}`, { defaultValue: "" })}{" "}
            {t("modules.automod_ai.severityDescription")}
          </FieldDescription>
        )}
      </Field>

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="automod-precedents">{t("modules.automod_ai.precedents")}</FieldLabel>
          <FieldDescription>{t("modules.automod_ai.precedentsDescription")}</FieldDescription>
        </FieldContent>
        <Switch
          id="automod-precedents"
          checked={draft.use_precedents !== false}
          onCheckedChange={(v) => onPatch({ use_precedents: v })}
        />
      </Field>
    </FieldGroup>
  )
}
