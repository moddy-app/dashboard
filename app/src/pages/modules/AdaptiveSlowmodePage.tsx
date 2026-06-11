import { useEffect, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Trash2Icon,
  GaugeIcon,
  PlusIcon,
  LoaderIcon,
  PencilIcon,
  AlertCircleIcon,
} from "lucide-react"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { ErrorPage } from "@/components/error-state"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { ChannelSlowmodeConfig, Sensitivity } from "@/types/api"
import {
  getAdaptiveSlowmodeConfig,
  upsertSlowmodeChannel,
  deleteSlowmodeChannel,
} from "@/services/guilds"
import { cn } from "@/lib/utils"

// ─── Constantes ───────────────────────────────────────────────────────────────

const VALID_DELAYS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600] as const
type ValidDelay = typeof VALID_DELAYS[number]

function formatDelay(seconds: number, t: (k: string) => string): string {
  if (seconds === 0) return t('modules.adaptive_slowmode.delayOff')
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${seconds / 60}min`
  return `${seconds / 3600}h`
}

// Nearest valid delay index (for snapping)
function nearestDelayIndex(seconds: number): number {
  const idx = VALID_DELAYS.indexOf(seconds as ValidDelay)
  return idx >= 0 ? idx : 0
}

const SENSITIVITIES: Sensitivity[] = ['low', 'medium', 'high']

// ─── Types internes ───────────────────────────────────────────────────────────

interface EditingChannel {
  channelId: string | null // null = new channel
  config: ChannelSlowmodeConfig
}

// ─── Composant de configuration d'un salon ────────────────────────────────────

interface ChannelFormProps {
  channelId: string | null
  config: ChannelSlowmodeConfig
  usedChannelIds: string[]
  onChannelChange: (id: string) => void
  onConfigChange: (cfg: ChannelSlowmodeConfig) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function ChannelForm({
  channelId,
  config,
  usedChannelIds,
  onChannelChange,
  onConfigChange,
  t,
}: ChannelFormProps) {
  const { channels } = useGuildContext()
  const textChannels = channels.filter(
    (c) =>
      (c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT) &&
      (c.id === channelId || !usedChannelIds.includes(c.id))
  )

  const minIdx = nearestDelayIndex(config.min_delay)
  const maxIdx = nearestDelayIndex(config.max_delay)

  const handleSliderChange = (values: number[]) => {
    const [newMin, newMax] = values
    // Ensure max > min: if thumbs cross, push them apart
    const safeMax = newMax <= newMin ? Math.min(newMin + 1, VALID_DELAYS.length - 1) : newMax
    onConfigChange({
      ...config,
      min_delay: VALID_DELAYS[newMin],
      max_delay: VALID_DELAYS[safeMax],
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Salon */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {t('modules.adaptive_slowmode.channel')}
        </label>
        <Select value={channelId ?? undefined} onValueChange={onChannelChange} disabled={channelId !== null}>
          <SelectTrigger disabled={textChannels.length === 0 || channelId !== null}>
            <SelectValue placeholder={t('modules.selectChannel')} />
          </SelectTrigger>
          <SelectContent>
            {textChannels.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <AlertCircleIcon className="size-4" />
                {t('modules.noChannels')}
              </div>
            )}
            {textChannels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                # {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {channelId !== null && (
          <p className="text-xs text-muted-foreground">{t('modules.adaptive_slowmode.channelLocked')}</p>
        )}
      </div>

      {/* Plage de délais */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            {t('modules.adaptive_slowmode.delayRange')}
          </label>
          <div className="flex items-center gap-1.5 text-sm">
            <Badge variant="secondary" className="font-mono tabular-nums">
              {formatDelay(config.min_delay, t)}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="secondary" className="font-mono tabular-nums">
              {formatDelay(config.max_delay, t)}
            </Badge>
          </div>
        </div>
        <div className="px-1 py-2">
          <Slider
            min={0}
            max={VALID_DELAYS.length - 1}
            step={1}
            value={[minIdx, maxIdx]}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{formatDelay(VALID_DELAYS[0], t)}</span>
            <span>{formatDelay(VALID_DELAYS[Math.floor(VALID_DELAYS.length / 2)], t)}</span>
            <span>{formatDelay(VALID_DELAYS[VALID_DELAYS.length - 1], t)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('modules.adaptive_slowmode.delayRangeDescription')}
        </p>
      </div>

      {/* Sensibilité */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {t('modules.adaptive_slowmode.sensitivity')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SENSITIVITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onConfigChange({ ...config, sensitivity: s })}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                config.sensitivity === s
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
              )}
            >
              <span className="text-sm font-medium capitalize">
                {t(`modules.adaptive_slowmode.sensitivity_${s}`)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {t(`modules.adaptive_slowmode.sensitivity_${s}_desc`)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function AdaptiveSlowmodePage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    channels,
    modules,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    disableModule,
  } = useGuildContext()

  const isEnabled = 'adaptive_slowmode' in modules

  const [channelConfigs, setChannelConfigs] = useState<Record<string, ChannelSlowmodeConfig>>({})
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [editing, setEditing] = useState<EditingChannel | null>(null)
  const [isSavingChannel, setIsSavingChannel] = useState(false)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [isDisabling, setIsDisabling] = useState(false)
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
    } catch {
      // Config not yet set
    } finally {
      setIsLoadingConfig(false)
    }
  }, [selectedGuildId])

  useEffect(() => {
    if (!isLoadingGuild) {
      loadConfig()
    }
  }, [loadConfig, isLoadingGuild, selectedGuildId])

  const openNewChannel = () => {
    setEditing({
      channelId: null,
      config: { min_delay: 0, max_delay: 30, sensitivity: 'medium' },
    })
  }

  const openEditChannel = (channelId: string) => {
    const existing = channelConfigs[channelId]
    if (!existing) return
    setEditing({ channelId, config: { ...existing } })
  }

  const handleSaveChannel = async () => {
    if (!selectedGuildId || !editing) return
    if (!editing.channelId) return // should not happen

    const { channelId, config } = editing
    if (config.max_delay <= config.min_delay) {
      toast.error(t('modules.adaptive_slowmode.errorMaxMin'))
      return
    }

    logger.event('module:adaptive_slowmode', 'Upsert channel', { channelId, config })
    setIsSavingChannel(true)
    try {
      await upsertSlowmodeChannel(selectedGuildId, channelId, config)
      setChannelConfigs((prev) => ({ ...prev, [channelId]: config }))
      setEditing(null)
      toast.success(t('modules.saved'))
      logger.success('module:adaptive_slowmode', 'Channel saved')
    } catch (e) {
      logger.error('module:adaptive_slowmode', 'Channel save failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
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
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setDeletingChannelId(null)
      setConfirmDeleteId(null)
    }
  }

  const handleDisableModule = async () => {
    logger.event('module:adaptive_slowmode', 'Disable')
    setIsDisabling(true)
    try {
      await disableModule('adaptive_slowmode')
      setChannelConfigs({})
      toast.success(t('modules.adaptive_slowmode.disabledSuccess'))
      logger.success('module:adaptive_slowmode', 'Disabled')
    } catch (e) {
      logger.error('module:adaptive_slowmode', 'Disable failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setIsDisabling(false)
    }
  }

  const usedChannelIds = Object.keys(channelConfigs)
  const availableChannelCount = textChannels.filter((c) => !usedChannelIds.includes(c.id)).length

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
            <GaugeIcon className="size-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">
              {t('modules.adaptive_slowmode.name')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('modules.adaptive_slowmode.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Carte liste des salons */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t('modules.adaptive_slowmode.configTitle')}</CardTitle>
            <CardDescription>{t('modules.adaptive_slowmode.configDescription')}</CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openNewChannel}
            disabled={availableChannelCount === 0 || isLoadingConfig}
          >
            <PlusIcon className="size-4" />
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
            <div className="flex flex-col items-center gap-3 py-8 text-center border border-dashed rounded-lg">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <GaugeIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('modules.adaptive_slowmode.empty')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('modules.adaptive_slowmode.emptyDescription')}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openNewChannel}
                disabled={availableChannelCount === 0}
              >
                <PlusIcon className="size-4" />
                {t('modules.adaptive_slowmode.addFirstChannel')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {usedChannelIds.map((chId) => {
                const cfg = channelConfigs[chId]
                const channel = textChannels.find((c) => c.id === chId)
                const isDeleting = deletingChannelId === chId

                return (
                  <div
                    key={chId}
                    className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground font-medium text-sm shrink-0">#</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {channel?.name ?? chId}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDelay(cfg.min_delay, t)} → {formatDelay(cfg.max_delay, t)}
                          </span>
                          <SensitivityBadge sensitivity={cfg.sensitivity} t={t} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEditChannel(chId)}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteId(chId)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <LoaderIcon className="size-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Désactiver le module */}
      {isEnabled && (
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive w-fit"
          onClick={handleDisableModule}
          disabled={isDisabling}
        >
          {isDisabling ? (
            <LoaderIcon className="size-4 mr-2 animate-spin" />
          ) : (
            <Trash2Icon className="size-4 mr-2" />
          )}
          {t('modules.disable')}
        </Button>
      )}

      {/* Dialog ajout/édition de salon */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open && !isSavingChannel) setEditing(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.channelId
                ? t('modules.adaptive_slowmode.editChannel')
                : t('modules.adaptive_slowmode.addChannelTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('modules.adaptive_slowmode.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <ChannelForm
              channelId={editing.channelId}
              config={editing.config}
              usedChannelIds={usedChannelIds}
              onChannelChange={(id) => setEditing((prev) => (prev ? { ...prev, channelId: id } : null))}
              onConfigChange={(cfg) => setEditing((prev) => (prev ? { ...prev, config: cfg } : null))}
              t={t}
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={isSavingChannel}
            >
              {t('modules.adaptive_slowmode.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSaveChannel}
              disabled={isSavingChannel || !editing?.channelId}
            >
              {isSavingChannel && <LoaderIcon className="size-4 mr-2 animate-spin" />}
              {t('modules.adaptive_slowmode.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}
      >
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
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDeleteChannel(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('modules.adaptive_slowmode.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Badge de sensibilité ─────────────────────────────────────────────────────

function SensitivityBadge({ sensitivity, t }: { sensitivity: Sensitivity; t: (k: string) => string }) {
  const colorMap: Record<Sensitivity, string> = {
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorMap[sensitivity])}>
      {t(`modules.adaptive_slowmode.sensitivity_${sensitivity}`)}
    </span>
  )
}
