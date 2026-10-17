import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { WarningIcon } from "@/components/icons"
import { ChannelMultiPicker, RoleMultiPicker } from "@/components/pickers"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useGuildContext } from "@/contexts/GuildContext"
import { sharedExemptions } from "@/lib/automod"
import { EXEMPT_MAX } from "@/services/automod"
import type { FieldErrors } from "@/components/automod/automod-form"
import type { AutomodAiConfig } from "@/types/api"

interface AutomodExemptionsTabProps {
  draft: AutomodAiConfig
  readOnly: boolean
  fieldErrors: FieldErrors
  onPatch: (changes: Partial<AutomodAiConfig>) => void
  onPatchExemptions: (changes: { roles?: string[]; channels?: string[] }) => void
}

export function AutomodExemptionsTab({
  draft,
  readOnly,
  fieldErrors,
  onPatch,
  onPatchExemptions,
}: AutomodExemptionsTabProps) {
  const { t } = useTranslation()
  const { roles } = useGuildContext()
  const exemptableRoles = useMemo(() => roles.filter((r) => r.name !== "@everyone"), [roles])
  const exemptions = sharedExemptions(draft.features)

  return (
    <FieldGroup>
      {exemptions.diverged && (
        <Alert>
          <WarningIcon />
          <AlertTitle>{t("modules.automod_ai.exemptionsDivergedTitle")}</AlertTitle>
          <AlertDescription>{t("modules.automod_ai.exemptionsDivergedDescription")}</AlertDescription>
          {!readOnly && (
            <AlertAction inline>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onPatchExemptions({ roles: exemptions.roles, channels: exemptions.channels })}
              >
                {t("modules.automod_ai.exemptionsUnify")}
              </Button>
            </AlertAction>
          )}
        </Alert>
      )}

      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor="automod-ignore-moderators">{t("modules.automod_ai.ignoreModerators")}</FieldLabel>
          <FieldDescription>{t("modules.automod_ai.ignoreModeratorsDescription")}</FieldDescription>
        </FieldContent>
        <Switch
          id="automod-ignore-moderators"
          checked={draft.ignore_moderators}
          onCheckedChange={(v) => onPatch({ ignore_moderators: v })}
        />
      </Field>

      <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="automod-exempt-roles">{t("modules.automod_ai.exemptRoles")}</FieldLabel>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("modules.automod_ai.exemptCount", { count: exemptions.roles.length, max: EXEMPT_MAX })}
          </span>
        </div>
        <RoleMultiPicker
          id="automod-exempt-roles"
          value={exemptions.roles}
          roles={exemptableRoles}
          includeManaged
          onChange={(next) => onPatchExemptions({ roles: next })}
          max={EXEMPT_MAX}
          placeholder={t("modules.automod_ai.addRole")}
          aria-invalid={Boolean(fieldErrors.exemptions) || undefined}
        />
        <FieldDescription>{t("modules.automod_ai.exemptRolesHint")}</FieldDescription>
      </Field>

      <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="automod-exempt-channels">{t("modules.automod_ai.exemptChannels")}</FieldLabel>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("modules.automod_ai.exemptCount", { count: exemptions.channels.length, max: EXEMPT_MAX })}
          </span>
        </div>
        <ChannelMultiPicker
          id="automod-exempt-channels"
          value={exemptions.channels}
          types={["text", "announcement", "forum"]}
          onChange={(next) => onPatchExemptions({ channels: next })}
          max={EXEMPT_MAX}
          placeholder={t("modules.automod_ai.addChannel")}
          aria-invalid={Boolean(fieldErrors.exemptions) || undefined}
        />
        <FieldDescription>{t("modules.automod_ai.exemptChannelsHint")}</FieldDescription>
        {fieldErrors.exemptions && <FieldError>{fieldErrors.exemptions}</FieldError>}
      </Field>
    </FieldGroup>
  )
}
