import { useTranslation } from "react-i18next"
import { ChannelPicker } from "@/components/pickers"
import { ServerLanguageNote } from "@/components/server-language-note"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useGuildContext } from "@/contexts/GuildContext"
import { pickLocalized } from "@/lib/automod"
import type { FieldErrors } from "@/components/automod/automod-form"
import type { AutomodAiConfig, AutomodCatalog, AutomodCatalogPreset } from "@/types/api"

interface AutomodSettingsTabProps {
  draft: AutomodAiConfig
  catalog: AutomodCatalog | null
  catalogLoading: boolean
  fieldErrors: FieldErrors
  onPatch: (changes: Partial<AutomodAiConfig>) => void
  onApplyPreset: (preset: AutomodCatalogPreset) => void
  onClearFieldError: (field: keyof FieldErrors) => void
}

export function AutomodSettingsTab({
  draft,
  catalog,
  catalogLoading,
  fieldErrors,
  onPatch,
  onApplyPreset,
  onClearFieldError,
}: AutomodSettingsTabProps) {
  const { t, i18n } = useTranslation()
  const { selectedGuildId } = useGuildContext()
  const presets = catalog?.presets ?? []
  // Le niveau n'est qu'un point de départ : une fois un détecteur actif, la
  // surveillance se règle dans son onglet.
  const noFeatureEnabled = !Object.values(draft.features).some((f) => f.enabled)

  return (
    <FieldGroup>
      <Field data-invalid={fieldErrors.notify_channel_id ? true : undefined}>
        <FieldLabel htmlFor="automod-notify-channel">{t("modules.automod_ai.notifyChannel")}</FieldLabel>
        <ChannelPicker
          id="automod-notify-channel"
          value={draft.notify_channel_id}
          onChange={(value) => {
            onPatch({ notify_channel_id: value })
            onClearFieldError("notify_channel_id")
          }}
          allowNone
          noneLabel={t("modules.automod_ai.noNotifyChannel")}
          placeholder={t("modules.selectChannel")}
          aria-invalid={Boolean(fieldErrors.notify_channel_id) || undefined}
        />
        {fieldErrors.notify_channel_id ? (
          <FieldError>{fieldErrors.notify_channel_id}</FieldError>
        ) : (
          <FieldDescription>{t("modules.automod_ai.notifyChannelDescription")}</FieldDescription>
        )}
      </Field>

      {noFeatureEnabled &&
        (catalogLoading && presets.length === 0 ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : (
          presets.length > 0 && (
            <Field>
              <FieldLabel>{t("modules.automod_ai.levelTitle")}</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value=""
                onValueChange={(id) => {
                  const preset = presets.find((p) => p.id === id)
                  if (preset) onApplyPreset(preset)
                }}
                className="w-full sm:w-fit"
                aria-label={t("modules.automod_ai.levelTitle")}
              >
                {presets.map((preset) => (
                  <ToggleGroupItem key={preset.id} value={preset.id} className="flex-1 sm:flex-none">
                    {pickLocalized(preset.name, i18n.language) || preset.id}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>{t("modules.automod_ai.levelDescription")}</FieldDescription>
            </Field>
          )
        ))}

      {/* La langue des DM et cartes de sanction suit celle du serveur. */}
      <ServerLanguageNote guildId={selectedGuildId} />
    </FieldGroup>
  )
}
