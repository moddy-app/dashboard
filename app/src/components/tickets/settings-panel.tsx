import { useTranslation } from "react-i18next"
import { ClockIcon, SparklesIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { ChannelSelect, Field, Notice, ToggleField } from "@/components/tickets/fields"
import { panelChannels, retentionShrinks, settingsFieldKey } from "@/lib/tickets"
import {
  TICKET_RETENTION_PRESETS,
  TICKET_RETENTION_RANGE,
} from "@/types/api"
import type { Channel, TicketsSettings } from "@/types/api"

// Réglages du module. Ils ne vivent **pas** derrière un endpoint dédié : ils
// partent dans le même `PUT` que les panneaux, sous la clé `settings`. D'où
// l'absence de bouton « enregistrer » ici — c'est la barre de la page qui écrit,
// une fois, l'objet entier.

const CUSTOM = "__custom__"

export function TicketsSettingsPanel({
  settings,
  savedSettings,
  channels,
  errors,
  onChange,
}: {
  settings: TicketsSettings
  /** Valeur enregistrée — sert à repérer une rétention qu'on **abaisse**. */
  savedSettings: TicketsSettings
  channels: Channel[]
  errors: Record<string, string>
  onChange: (changes: Partial<TicketsSettings>) => void
}) {
  const { t } = useTranslation()
  const err = (field: keyof TicketsSettings) => errors[settingsFieldKey(field)]

  const days = settings.transcript_retention_days
  const isPreset = (TICKET_RETENTION_PRESETS as readonly number[]).includes(days)
  const shrinking = retentionShrinks(savedSettings.transcript_retention_days, days)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Journal ──────────────────────────────────────────────────────── */}
      <FieldSet>
        <FieldLegend variant="label">{t("modules.tickets.settings.journalSection")}</FieldLegend>
        <FieldGroup>
          <Field
            label={t("modules.tickets.settings.logChannel")}
            description={t("modules.tickets.settings.logChannelDescription")}
            error={err("log_channel_id")}
          >
            <ChannelSelect
              value={settings.log_channel_id}
              channels={panelChannels(channels)}
              onChange={(value) => onChange({ log_channel_id: value })}
              placeholder={t("modules.tickets.settings.selectLogChannel")}
              emptyLabel={t("modules.tickets.settings.noTextChannel")}
              clearLabel={t("modules.tickets.settings.noLogChannel")}
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      {/* ── Archives ─────────────────────────────────────────────────────── */}
      <FieldSet>
        <FieldLegend variant="label">{t("modules.tickets.settings.archivesSection")}</FieldLegend>
        <FieldGroup>
          <ToggleField
            label={t("modules.tickets.settings.transcripts")}
            description={t("modules.tickets.settings.transcriptsDescription")}
            checked={settings.transcripts_enabled}
          >
            <Switch
              checked={settings.transcripts_enabled}
              onCheckedChange={(value) => onChange({ transcripts_enabled: value })}
            />
          </ToggleField>

          {settings.transcripts_enabled && (
            <Field
              label={t("modules.tickets.settings.retention")}
              description={t("modules.tickets.settings.retentionDescription")}
              error={err("transcript_retention_days")}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={isPreset ? String(days) : CUSTOM}
                  onValueChange={(value) => {
                    if (value === CUSTOM) return
                    onChange({ transcript_retention_days: Number(value) })
                  }}
                >
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_RETENTION_PRESETS.map((preset) => (
                      <SelectItem key={preset} value={String(preset)}>
                        {preset === 0
                          ? t("modules.tickets.settings.retentionUnlimited")
                          : t("modules.tickets.settings.retentionDays", { count: preset })}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>
                      {t("modules.tickets.settings.retentionCustom")}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {!isPreset && (
                  <Input
                    type="number"
                    min={TICKET_RETENTION_RANGE.min}
                    max={TICKET_RETENTION_RANGE.max}
                    value={days}
                    onChange={(e) =>
                      onChange({ transcript_retention_days: Math.trunc(Number(e.target.value)) })
                    }
                    aria-invalid={Boolean(err("transcript_retention_days"))}
                    className="w-full sm:w-32"
                  />
                )}
              </div>
            </Field>
          )}

          {/* Abaisser la rétention **supprime des conversations** : le bot efface à
              sa prochaine purge quotidienne, et ce n'est pas réversible. L'avertir
              ici, en plus de la confirmation à l'enregistrement, évite la surprise
              au moment où il est déjà trop tard. */}
          {shrinking && (
            <Notice
              level="warning"
              title={t("modules.tickets.settings.retentionWarningTitle")}
            >
              {t("modules.tickets.settings.retentionWarningDescription", { days })}
            </Notice>
          )}
        </FieldGroup>
      </FieldSet>

      {/* ── Fermeture ────────────────────────────────────────────────────── */}
      <FieldSet>
        <FieldLegend variant="label">{t("modules.tickets.settings.closureSection")}</FieldLegend>
        <FieldGroup>
          <ToggleField
            label={t("modules.tickets.settings.closureDetection")}
            description={t("modules.tickets.settings.closureDetectionDescription")}
            checked={settings.closure_detection_enabled}
            icon={<SparklesIcon className="size-4" />}
          >
            <Switch
              checked={settings.closure_detection_enabled}
              onCheckedChange={(value) => onChange({ closure_detection_enabled: value })}
            />
          </ToggleField>

          <ToggleField
            label={t("modules.tickets.settings.rating")}
            description={t("modules.tickets.settings.ratingDescription")}
            checked={settings.rating_enabled}
          >
            <Switch
              checked={settings.rating_enabled}
              onCheckedChange={(value) => onChange({ rating_enabled: value })}
            />
          </ToggleField>

          <ToggleField
            label={t("modules.tickets.settings.keepChannelOnClose")}
            description={t("modules.tickets.settings.keepChannelOnCloseDescription")}
            checked={settings.keep_channel_on_close}
          >
            <Switch
              checked={settings.keep_channel_on_close}
              onCheckedChange={(value) => onChange({ keep_channel_on_close: value })}
            />
          </ToggleField>
        </FieldGroup>
      </FieldSet>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
        {t("modules.tickets.settings.purgeHint")}
      </p>
    </div>
  )
}
