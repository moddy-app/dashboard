import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon, ChevronDownIcon, WarningIcon } from "@/components/icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { PROFILE_FEATURE, SCAN_ALL_FEATURE, pickLocalized } from "@/lib/automod"
import type { AutomodAiConfig, AutomodCatalog } from "@/types/api"

const MESSAGE_FEATURES = ["content", "image_nsfw", "image_gore", "image_scam"] as const
const PROFILE_PARTS = ["avatar", "banner", "pseudo"] as const

interface Option {
  value: string
  label: string
}

interface CheckboxMultiSelectProps {
  id: string
  options: Option[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder: string
  disabled?: boolean
}

/** Sélecteur multiple à cases : un popover de commandes, la sélection en pastilles. */
function CheckboxMultiSelect({ id, options, selected, onChange, placeholder, disabled }: CheckboxMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const chosen = options.filter((o) => selected.includes(o.value))

  const toggle = (value: string) =>
    onChange(options.map((o) => o.value).filter((v) => (v === value ? !selected.includes(v) : selected.includes(v))))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-auto min-h-9 w-full justify-between font-normal"
        >
          <span className="flex flex-wrap gap-1">
            {chosen.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              chosen.map((o) => (
                <Badge key={o.value} variant="secondary">
                  {o.label}
                </Badge>
              ))
            )}
          </span>
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {options.map((o) => {
                const checked = selected.includes(o.value)
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                    {o.label}
                    <CheckIcon className={cn("ml-auto", !checked && "invisible")} />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface AutomodMonitoringTabProps {
  draft: AutomodAiConfig
  catalog: AutomodCatalog | null
  onUpdate: (updater: (config: AutomodAiConfig) => AutomodAiConfig) => void
}

export function AutomodMonitoringTab({ draft, catalog, onUpdate }: AutomodMonitoringTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const featureLabel = (id: string) =>
    pickLocalized(catalog?.features.find((f) => f.id === id)?.name, lang) ||
    t(`modules.automod_ai.features.${id}.name`, { defaultValue: id })

  const messageOptions = MESSAGE_FEATURES.filter((id) => draft.features[id]).map((id) => ({
    value: id,
    label: featureLabel(id),
  }))
  const messageSelected = messageOptions.filter((o) => draft.features[o.value]?.enabled).map((o) => o.value)

  const profile = draft.features[PROFILE_FEATURE]
  const profileOptions = PROFILE_PARTS.map((part) => ({
    value: part,
    label: t(`modules.automod_ai.profileParts.${part}`),
  }))
  const profileSelected = profile?.enabled ? PROFILE_PARTS.filter((p) => profile[p] !== false) : []

  const setMessages = (next: string[]) =>
    onUpdate((cfg) => {
      const features = { ...cfg.features }
      for (const id of MESSAGE_FEATURES) {
        if (features[id]) features[id] = { ...features[id], enabled: next.includes(id) }
      }
      return { ...cfg, features }
    })

  const setProfile = (next: string[]) =>
    onUpdate((cfg) => ({
      ...cfg,
      features: {
        ...cfg.features,
        [PROFILE_FEATURE]: {
          ...cfg.features[PROFILE_FEATURE],
          enabled: next.length > 0,
          avatar: next.includes("avatar"),
          banner: next.includes("banner"),
          pseudo: next.includes("pseudo"),
        },
      },
    }))

  const scam = draft.features[SCAN_ALL_FEATURE]

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="automod-monitor-messages">{t("modules.automod_ai.monitoring.messagesLabel")}</FieldLabel>
        <CheckboxMultiSelect
          id="automod-monitor-messages"
          options={messageOptions}
          selected={messageSelected}
          onChange={setMessages}
          placeholder={t("modules.automod_ai.monitoring.none")}
        />
        <FieldDescription>{t("modules.automod_ai.monitoring.messagesHelp")}</FieldDescription>
      </Field>

      {profile && (
        <Field>
          <FieldLabel htmlFor="automod-monitor-profile">{t("modules.automod_ai.monitoring.profileLabel")}</FieldLabel>
          <CheckboxMultiSelect
            id="automod-monitor-profile"
            options={profileOptions}
            selected={profileSelected}
            onChange={setProfile}
            placeholder={t("modules.automod_ai.monitoring.none")}
          />
          <FieldDescription>{t("modules.automod_ai.profileBannerNote")}</FieldDescription>
        </Field>
      )}

      {scam && <ScanAllSetting checked={scam.scan_all === true} onChange={(v) => onUpdate((cfg) => ({
        ...cfg,
        features: { ...cfg.features, [SCAN_ALL_FEATURE]: { ...cfg.features[SCAN_ALL_FEATURE], scan_all: v } },
      }))} />}
    </FieldGroup>
  )
}

function ScanAllSetting({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation()
  // Ouvert d'office si le réglage est déjà actif : un coût en cours ne se cache pas.
  const [open, setOpen] = useState(checked)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2">
          <ChevronDownIcon data-icon="inline-start" className={cn("transition-transform", open && "rotate-180")} />
          {t("modules.automod_ai.advanced")}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-2">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="automod-scan-all">{t("modules.automod_ai.scanAll")}</FieldLabel>
            <FieldDescription>{t("modules.automod_ai.scanAllDescription")}</FieldDescription>
          </FieldContent>
          <Switch id="automod-scan-all" checked={checked} onCheckedChange={onChange} />
        </Field>
        <Alert>
          <WarningIcon />
          <AlertDescription>{t("modules.automod_ai.scanAllWarning")}</AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  )
}
