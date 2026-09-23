import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DirectoryIcon } from "@/components/bump-reminder/directory-icon"
import { ChannelPicker, RoleMultiPicker } from "@/components/module-pickers"
import {
  formatInterval,
  hasDuplicateTarget,
  splitInterval,
  validateBumpReminder,
} from "@/lib/bump-reminder"
import type { BumpReminderDraft, BumpReminderField } from "@/lib/bump-reminder"
import type { Channel, Role } from "@/types/api"
import type { BumpCatalog } from "@/types/bump-reminder"

const K = "modules.bump_reminder"

/**
 * Ajout / édition d'un rappel. On édite une **copie** : rien ne touche le
 * brouillon de la page avant « Valider », et la sauvegarde réelle passe par la
 * barre d'enregistrement (un seul `PUT` avec toute la config).
 */
export function ReminderDialog({
  open,
  initial,
  isNew,
  all,
  catalog,
  channels,
  roles,
  guildId,
  canSubscribe,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: BumpReminderDraft | null
  isNew: boolean
  /** Brouillon complet — quota et doublons se calculent dessus. */
  all: BumpReminderDraft[]
  catalog: BumpCatalog
  channels: Channel[]
  roles: Role[]
  guildId: string
  canSubscribe: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (reminder: BumpReminderDraft) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(isNew ? `${K}.dialog.addTitle` : `${K}.dialog.editTitle`)}</DialogTitle>
          <DialogDescription>{t(`${K}.dialog.description`)}</DialogDescription>
        </DialogHeader>
        {/* Remonté à chaque ouverture : l'état local repart de `initial`. */}
        {initial && (
          <ReminderForm
            key={initial.key}
            initial={initial}
            isNew={isNew}
            all={all}
            catalog={catalog}
            channels={channels}
            roles={roles}
            guildId={guildId}
            canSubscribe={canSubscribe}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReminderForm({
  initial,
  isNew,
  all,
  catalog,
  channels,
  roles,
  guildId,
  canSubscribe,
  onCancel,
  onSubmit,
}: {
  initial: BumpReminderDraft
  isNew: boolean
  all: BumpReminderDraft[]
  catalog: BumpCatalog
  channels: Channel[]
  roles: Role[]
  guildId: string
  canSubscribe: boolean
  onCancel: () => void
  onSubmit: (reminder: BumpReminderDraft) => void
}) {
  const { t } = useTranslation()
  const { limits } = catalog
  const [draft, setDraft] = useState<BumpReminderDraft>(initial)
  const [hours, setHours] = useState(() =>
    initial.interval !== null ? String(splitInterval(initial.interval).hours) : ""
  )
  const [minutes, setMinutes] = useState(() =>
    initial.interval !== null ? String(splitInterval(initial.interval).minutes) : ""
  )
  const [errors, setErrors] = useState<Partial<Record<BumpReminderField, string>>>({})

  /** Rappels par annuaire **hors** celui qu'on édite (pauses comprises). */
  const usedByOthers = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of all) if (r.key !== initial.key) counts[r.bot] = (counts[r.bot] ?? 0) + 1
    return counts
  }, [all, initial.key])

  const directory = catalog.directories.find((d) => d.key === draft.bot)
  const isFull = (bot: string) => (usedByOthers[bot] ?? 0) >= limits.per_directory
  const anyFull = catalog.directories.some((d) => isFull(d.key))

  const patch = (changes: Partial<BumpReminderDraft>) => {
    setDraft((prev) => ({ ...prev, ...changes }))
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(changes) as BumpReminderField[]) delete next[key]
      return next
    })
  }

  /** Heures + minutes → secondes ; deux champs vides = délai de l'annuaire. */
  const intervalSeconds = (): number | null => {
    if (hours.trim() === "" && minutes.trim() === "") return null
    const h = Number.parseInt(hours || "0", 10)
    const m = Number.parseInt(minutes || "0", 10)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return Number.NaN
    return h * 3600 + m * 60
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const interval = intervalSeconds()
    const candidate: BumpReminderDraft = { ...draft, interval: Number.isNaN(interval) ? -1 : interval }
    const next: Partial<Record<BumpReminderField, string>> = {}
    for (const issue of validateBumpReminder(candidate, limits, guildId)) {
      next[issue.field] ??= t(`${K}.errors.${issue.key}`, issue.params)
    }
    if (hasDuplicateTarget(candidate, all)) next.channel_id ??= t(`${K}.errors.duplicateTarget`)
    if (candidate.bot && isFull(candidate.bot) && (isNew || candidate.bot !== initial.bot)) {
      next.bot ??= t(`${K}.errors.quota`, { max: limits.per_directory })
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit(candidate)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={errors.bot ? true : undefined}>
          <FieldLabel htmlFor="br-bot">{t(`${K}.fields.bot`)}</FieldLabel>
          <Select value={draft.bot || undefined} onValueChange={(bot) => patch({ bot })}>
            <SelectTrigger id="br-bot" className="w-full" aria-invalid={Boolean(errors.bot) || undefined}>
              <SelectValue placeholder={t(`${K}.fields.botPlaceholder`)} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {catalog.directories.map((d) => {
                  // Un rappel existant garde son annuaire même si le quota est
                  // plein (cas du premium perdu) : il doit rester éditable.
                  const locked = isFull(d.key) && (isNew || d.key !== initial.bot)
                  return (
                    <SelectItem key={d.key} value={d.key} disabled={locked}>
                      <DirectoryIcon bot={d.key} className="size-4" />
                      {/* Marque : jamais traduite. */}
                      {d.name}
                    </SelectItem>
                  )
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
          {anyFull && (
            <FieldDescription>
              {t(`${K}.fields.botFull`, { max: limits.per_directory })}
              {!catalog.premium && (
                <>
                  {" "}
                  {t(`${K}.premiumHint`, { max: limits.per_directory_premium })}{" "}
                  {canSubscribe && <Link to="/premium">{t(`${K}.premiumCta`)}</Link>}
                </>
              )}
            </FieldDescription>
          )}
          <FieldError>{errors.bot}</FieldError>
        </Field>

        <Field data-invalid={errors.channel_id ? true : undefined}>
          <FieldLabel htmlFor="br-channel">{t(`${K}.fields.channel`)}</FieldLabel>
          <ChannelPicker
            id="br-channel"
            value={draft.channel_id}
            channels={channels}
            onChange={(channel_id) => patch({ channel_id })}
            placeholder={t("modules.selectChannel")}
            invalid={Boolean(errors.channel_id)}
          />
          <FieldDescription>{t(`${K}.fields.channelDescription`)}</FieldDescription>
          <FieldError>{errors.channel_id}</FieldError>
        </Field>

        <Field data-invalid={errors.role_ids ? true : undefined}>
          <FieldLabel htmlFor="br-roles">
            {t(`${K}.fields.roles`)}
            <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
              {draft.role_ids.length}/{limits.roles}
            </span>
          </FieldLabel>
          <RoleMultiPicker
            id="br-roles"
            value={draft.role_ids}
            roles={roles}
            max={limits.roles}
            onChange={(role_ids) => patch({ role_ids })}
            placeholder={t(`${K}.fields.rolesPlaceholder`)}
            invalid={Boolean(errors.role_ids)}
          />
          <FieldDescription>{t(`${K}.fields.rolesDescription`)}</FieldDescription>
          <FieldError>{errors.role_ids}</FieldError>
        </Field>

        <Field>
          <FieldTitle id="br-ping-label">{t(`${K}.fields.pingMode`)}</FieldTitle>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="br-ping-label"
            value={draft.ping_mode}
            onValueChange={(v) => v && patch({ ping_mode: v as BumpReminderDraft["ping_mode"] })}
            className="w-full"
          >
            {catalog.ping_modes.map((mode) => (
              <ToggleGroupItem key={mode} value={mode}>
                {t(`${K}.pingModes.${mode}.label`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{t(`${K}.pingModes.${draft.ping_mode}.description`)}</FieldDescription>
        </Field>

        <Field data-invalid={errors.interval ? true : undefined}>
          <FieldLabel htmlFor="br-hours">{t(`${K}.fields.interval`)}</FieldLabel>
          <div className="flex gap-2">
            <InputGroup>
              <InputGroupInput
                id="br-hours"
                type="number"
                inputMode="numeric"
                min={0}
                max={24}
                value={hours}
                placeholder={directory ? String(splitInterval(directory.default_interval).hours) : ""}
                aria-invalid={Boolean(errors.interval) || undefined}
                onChange={(e) => {
                  setHours(e.target.value)
                  setErrors((prev) => ({ ...prev, interval: undefined }))
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t(`${K}.fields.hours`)}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <InputGroup>
              <InputGroupInput
                id="br-minutes"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={minutes}
                placeholder={directory ? String(splitInterval(directory.default_interval).minutes) : ""}
                aria-label={t(`${K}.fields.minutes`)}
                aria-invalid={Boolean(errors.interval) || undefined}
                onChange={(e) => {
                  setMinutes(e.target.value)
                  setErrors((prev) => ({ ...prev, interval: undefined }))
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t(`${K}.fields.minutes`)}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <FieldDescription>
            {directory
              ? t(`${K}.fields.intervalDescription`, { default: formatInterval(directory.default_interval) })
              : t(`${K}.fields.intervalDescriptionNoDirectory`)}
          </FieldDescription>
          <FieldError>{errors.interval}</FieldError>
        </Field>

        <Alert>
          <AlertDescription>{t(`${K}.fields.intervalAnnounced`)}</AlertDescription>
        </Alert>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="br-enabled">{t(`${K}.fields.enabled`)}</FieldLabel>
            <FieldDescription>{t(`${K}.fields.enabledDescription`)}</FieldDescription>
          </FieldContent>
          <Switch id="br-enabled" checked={draft.enabled} onCheckedChange={(enabled) => patch({ enabled })} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">{t(isNew ? `${K}.dialog.add` : `${K}.dialog.apply`)}</Button>
      </DialogFooter>
    </form>
  )
}
