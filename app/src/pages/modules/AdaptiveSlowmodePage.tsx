import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AddIcon, DeleteIcon, EditIcon, GaugeIcon } from "@/components/icons"
import { handleSaveError } from "@/lib/handle-error"
import { ApiError } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/module/responsive-dialog"
import { ChannelPicker } from "@/components/pickers"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { ChannelSlowmodeConfig, Sensitivity } from "@/types/api"
import { getAdaptiveSlowmodeConfig, upsertSlowmodeChannel, deleteSlowmodeChannel } from "@/services/guilds"

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Bornes de l'API (secondes). */
const MIN_DELAY_RANGE = { min: 0, max: 21600 }
const MAX_DELAY_RANGE = { min: 1, max: 21600 }

function formatDelay(seconds: number, t: (k: string) => string): string {
  if (seconds === 0) return t('modules.adaptive_slowmode.delayOff')
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round((seconds / 60) * 10) / 10}min`
  return `${Math.round((seconds / 3600) * 10) / 10}h`
}

/** Clé i18n de l'erreur de plage, `null` si valide. */
function delayError(c: ChannelSlowmodeConfig): string | null {
  const inRange = (v: number, r: { min: number; max: number }) => Number.isFinite(v) && v >= r.min && v <= r.max
  if (!inRange(c.min_delay, MIN_DELAY_RANGE)) return 'modules.adaptive_slowmode.errorMinRange'
  if (!inRange(c.max_delay, MAX_DELAY_RANGE)) return 'modules.adaptive_slowmode.errorMaxRange'
  if (c.max_delay <= c.min_delay) return 'modules.adaptive_slowmode.errorMaxMin'
  return null
}

const SENSITIVITIES: Sensitivity[] = ['low', 'medium', 'high']

const UNITS = { s: 1, min: 60, h: 3600 } as const
type Unit = keyof typeof UNITS

function bestUnit(seconds: number): Unit {
  if (seconds > 0 && seconds % 3600 === 0) return 'h'
  if (seconds > 0 && seconds % 60 === 0) return 'min'
  return 's'
}

// ─── Champ « durée » : nombre + unité ─────────────────────────────────────────

interface DelayFieldProps {
  id: string
  label: string
  seconds: number
  onChange: (seconds: number) => void
  invalid: boolean
}

function DelayField({ id, label, seconds, onChange, invalid }: DelayFieldProps) {
  const [unit, setUnit] = useState<Unit>(() => bestUnit(seconds))
  const [text, setText] = useState(() => String(seconds / UNITS[bestUnit(seconds)]))

  const commit = (nextText: string, nextUnit: Unit) => {
    setText(nextText)
    setUnit(nextUnit)
    const n = Number(nextText.replace(',', '.'))
    onChange(nextText.trim() === '' || !Number.isFinite(n) ? NaN : Math.round(n * UNITS[nextUnit]))
  }

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={text}
          aria-invalid={invalid}
          onChange={(e) => commit(e.target.value, unit)}
        />
        <InputGroupAddon align="inline-end">
          <Select value={unit} onValueChange={(u) => commit(text, u as Unit)}>
            <SelectTrigger size="sm" className="w-20 border-0 shadow-none" aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="s">s</SelectItem>
                <SelectItem value="min">min</SelectItem>
                <SelectItem value="h">h</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

interface EditingChannel {
  isNew: boolean
  channelId: string | null
  config: ChannelSlowmodeConfig
}

interface ChannelFormProps {
  isNew: boolean
  channelId: string | null
  config: ChannelSlowmodeConfig
  usedChannelIds: string[]
  onChannelChange: (id: string | null) => void
  onConfigChange: (cfg: ChannelSlowmodeConfig) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function ChannelForm({ isNew, channelId, config, usedChannelIds, onChannelChange, onConfigChange, t }: ChannelFormProps) {
  const { channels } = useGuildContext()
  const selectable = channels.filter(
    (c) =>
      (c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT) &&
      (c.id === channelId || !usedChannelIds.includes(c.id))
  )
  const errorKey = delayError(config)

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t('modules.adaptive_slowmode.channel')}</FieldLabel>
        <ChannelPicker
          value={channelId}
          onChange={onChannelChange}
          channels={selectable}
          disabled={!isNew}
          placeholder={t('modules.selectChannel')}
        />
        {!isNew && <FieldDescription>{t('modules.adaptive_slowmode.channelLocked')}</FieldDescription>}
      </Field>

      <FieldGroup className="gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <DelayField
            id="slowmode-min"
            label={t('modules.adaptive_slowmode.delayMin')}
            seconds={config.min_delay}
            onChange={(v) => onConfigChange({ ...config, min_delay: v })}
            invalid={errorKey !== null && errorKey !== 'modules.adaptive_slowmode.errorMaxRange'}
          />
          <DelayField
            id="slowmode-max"
            label={t('modules.adaptive_slowmode.delayMax')}
            seconds={config.max_delay}
            onChange={(v) => onConfigChange({ ...config, max_delay: v })}
            invalid={errorKey !== null && errorKey !== 'modules.adaptive_slowmode.errorMinRange'}
          />
        </div>
        {errorKey ? (
          <FieldError>{t(errorKey)}</FieldError>
        ) : (
          <FieldDescription>{t('modules.adaptive_slowmode.delayRangeDescription')}</FieldDescription>
        )}
      </FieldGroup>

      <Field>
        <FieldLabel>{t('modules.adaptive_slowmode.sensitivity')}</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={config.sensitivity}
          onValueChange={(v) => v && onConfigChange({ ...config, sensitivity: v as Sensitivity })}
          className="w-full"
        >
          {SENSITIVITIES.map((s) => (
            <ToggleGroupItem key={s} value={s} className="flex-1">
              {t(`modules.adaptive_slowmode.sensitivity_${s}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>{t(`modules.adaptive_slowmode.sensitivity_${config.sensitivity}_desc`)}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function AdaptiveSlowmodePage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    channels,
    isLoadingGuild,
    isGuildReady,
    guildError,
    refreshGuildData,
  } = useGuildContext()


  const [channelConfigs, setChannelConfigs] = useState<Record<string, ChannelSlowmodeConfig>>({})
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [editing, setEditing] = useState<EditingChannel | null>(null)
  const [isSavingChannel, setIsSavingChannel] = useState(false)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )

  const loadConfig = useCallback(async () => {
    if (!selectedGuildId) return
    setIsLoadingConfig(true)
    try {
      const cfg = await getAdaptiveSlowmodeConfig(selectedGuildId)
      setChannelConfigs(cfg?.channels ?? {})
    } finally {
      setIsLoadingConfig(false)
    }
  }, [selectedGuildId])

  useEffect(() => {
    if (isGuildReady) {
      loadConfig()
    }
  }, [loadConfig, isGuildReady, selectedGuildId])

  const openNewChannel = () => {
    setEditing({
      isNew: true,
      channelId: null,
      config: { min_delay: 0, max_delay: 30, sensitivity: 'medium' },
    })
  }

  const openEditChannel = (channelId: string) => {
    const existing = channelConfigs[channelId]
    if (!existing) return
    setEditing({ isNew: false, channelId, config: { ...existing } })
  }

  // L'écriture d'un salon est vérifiée auprès de Discord : `503` quand Discord
  // ne répond pas (rien n'est enregistré, `Retry-After` ~30 s), `422` en chaîne
  // quand le salon est introuvable sur ce serveur — ce qui arrive aussi à un
  // salon créé il y a moins de deux minutes. Les `422` de validation (tableau)
  // gardent le traitement générique.
  const handleChannelError = (e: unknown) => {
    if (e instanceof ApiError && e.isUnavailable) {
      toast.error(t('modules.saveError'), {
        description: t('modules.adaptive_slowmode.errors.discordUnavailable'),
      })
      return
    }
    if (e instanceof ApiError && e.status === 422 && typeof e.detail === 'string') {
      toast.error(t('modules.saveError'), {
        description: t('modules.adaptive_slowmode.errors.channelUnavailable'),
      })
      return
    }
    handleSaveError(e, { title: t('modules.saveError') })
  }

  const handleSaveChannel = async () => {
    if (!selectedGuildId || !editing || !editing.channelId) return

    const { channelId, config } = editing
    if (delayError(config)) {
      toast.error(t(delayError(config) as string))
      return
    }

    logger.event('module:adaptive_slowmode', 'Save channel', { channelId, config })
    setIsSavingChannel(true)
    try {
      await upsertSlowmodeChannel(selectedGuildId, channelId, config)
      setChannelConfigs((prev) => ({ ...prev, [channelId]: config }))
      setEditing(null)
      toast.success(t('modules.saved'))
      logger.success('module:adaptive_slowmode', 'Channel saved')
    } catch (e) {
      logger.error('module:adaptive_slowmode', 'Channel save failed', e)
      handleChannelError(e)
    } finally {
      setIsSavingChannel(false)
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!selectedGuildId) return
    logger.event('module:adaptive_slowmode', 'Delete channel', { channelId })
    setDeletingChannelId(channelId)
    try {
      await deleteSlowmodeChannel(selectedGuildId, channelId)
      setChannelConfigs((prev) => {
        const next = { ...prev }
        delete next[channelId]
        return next
      })
      toast.success(t('modules.adaptive_slowmode.channelRemoved'))
      logger.success('module:adaptive_slowmode', 'Channel deleted')
    } catch (e) {
      logger.error('module:adaptive_slowmode', 'Delete failed', e)
      handleChannelError(e)
    } finally {
      setDeletingChannelId(null)
      setConfirmDeleteId(null)
    }
  }

  const usedChannelIds = Object.keys(channelConfigs)
  const availableChannelCount = textChannels.filter((c) => !usedChannelIds.includes(c.id)).length

  const errorForSave = editing ? delayError(editing.config) : null

  return (
    <ModulePage
      moduleId="adaptive_slowmode"
      loading={isLoadingGuild || !isGuildReady}
      error={guildError}
      onRetry={refreshGuildData}
      actions={<ModuleStateControl moduleId="adaptive_slowmode" />}
    >
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>{t('modules.adaptive_slowmode.configTitle')}</CardTitle>
          </div>
          <Button type="button" size="sm" onClick={openNewChannel} disabled={availableChannelCount === 0 || isLoadingConfig}>
            <AddIcon data-icon="inline-start" />
            {t('modules.adaptive_slowmode.addChannel')}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : usedChannelIds.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GaugeIcon />
                </EmptyMedia>
                <EmptyTitle>{t('modules.adaptive_slowmode.empty')}</EmptyTitle>
                <EmptyDescription>{t('modules.adaptive_slowmode.emptyDescription')}</EmptyDescription>
              </EmptyHeader>
              <Button type="button" size="sm" variant="outline" onClick={openNewChannel} disabled={availableChannelCount === 0}>
                <AddIcon data-icon="inline-start" />
                {t('modules.adaptive_slowmode.addFirstChannel')}
              </Button>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {usedChannelIds.map((chId) => {
                const cfg = channelConfigs[chId]
                const channel = textChannels.find((c) => c.id === chId)
                const isDeleting = deletingChannelId === chId
                return (
                  <div key={chId} className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-sm font-medium"># {channel?.name ?? chId}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDelay(cfg.min_delay, t)} → {formatDelay(cfg.max_delay, t)}
                        </span>
                        <Badge variant="secondary">{t(`modules.adaptive_slowmode.sensitivity_${cfg.sensitivity}`)}</Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditChannel(chId)} aria-label={t('modules.adaptive_slowmode.editChannel')}>
                        <EditIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfirmDeleteId(chId)} disabled={isDeleting} aria-label={t('modules.adaptive_slowmode.delete')}>
                        {isDeleting ? <Spinner /> : <DeleteIcon />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open && !isSavingChannel) setEditing(null) }}
        className="sm:max-w-md"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editing?.isNew ? t('modules.adaptive_slowmode.addChannelTitle') : t('modules.adaptive_slowmode.editChannel')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t('modules.adaptive_slowmode.dialogDescription')}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {editing && (
            <ChannelForm
              isNew={editing.isNew}
              channelId={editing.channelId}
              config={editing.config}
              usedChannelIds={usedChannelIds}
              onChannelChange={(id) => setEditing((prev) => (prev ? { ...prev, channelId: id } : null))}
              onConfigChange={(cfg) => setEditing((prev) => (prev ? { ...prev, config: cfg } : null))}
              t={t}
            />
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isSavingChannel}>
            {t('modules.adaptive_slowmode.cancel')}
          </Button>
          <Button type="button" onClick={handleSaveChannel} disabled={isSavingChannel || !editing?.channelId || errorForSave !== null}>
            {isSavingChannel && <Spinner data-icon="inline-start" />}
            {t('modules.adaptive_slowmode.save')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>

      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modules.adaptive_slowmode.confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modules.adaptive_slowmode.confirmDeleteDescription', {
                channel: textChannels.find((c) => c.id === confirmDeleteId)?.name ?? confirmDeleteId,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('modules.adaptive_slowmode.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirmDeleteId && handleDeleteChannel(confirmDeleteId)}>
              {t('modules.adaptive_slowmode.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}
