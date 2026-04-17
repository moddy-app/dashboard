import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Trash2Icon,
  ScrollTextIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { handleSaveError } from "@/lib/handle-error"
import { ErrorPage } from "@/components/error-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGuildContext } from "@/contexts/GuildContext"
import { updateLogging, getLoggingConfig } from "@/services/guilds"
import { CHANNEL_TYPES } from "@/types/api"

// Tous les événements loggables
const LOG_EVENTS = [
  { id: 'message_delete', group: 'messages' },
  { id: 'message_edit', group: 'messages' },
  { id: 'message_bulk_delete', group: 'messages' },
  { id: 'member_join', group: 'members' },
  { id: 'member_leave', group: 'members' },
  { id: 'member_ban', group: 'members' },
  { id: 'member_unban', group: 'members' },
  { id: 'member_kick', group: 'members' },
  { id: 'member_timeout', group: 'members' },
  { id: 'role_create', group: 'roles' },
  { id: 'role_delete', group: 'roles' },
  { id: 'role_update', group: 'roles' },
  { id: 'channel_create', group: 'channels' },
  { id: 'channel_delete', group: 'channels' },
  { id: 'channel_update', group: 'channels' },
  { id: 'voice_join', group: 'voice' },
  { id: 'voice_leave', group: 'voice' },
  { id: 'voice_move', group: 'voice' },
] as const

type LogEvent = typeof LOG_EVENTS[number]['id']
const EVENT_GROUPS = [...new Set(LOG_EVENTS.map((e) => e.group))]

export function LoggingPage() {
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

  const isEnabled = 'logging' in modules

  const [enabled, setEnabled] = useState(isEnabled)
  const [channelId, setChannelId] = useState<string>('')
  const [selectedEvents, setSelectedEvents] = useState<Set<LogEvent>>(new Set())
  const [saving, setSaving] = useState(false)

  // Valeurs sauvegardées pour dirty state
  const [savedEnabled, setSavedEnabled] = useState(isEnabled)
  const [savedChannelId, setSavedChannelId] = useState('')
  const [savedEvents, setSavedEvents] = useState<Set<LogEvent>>(new Set())

  const isDirty =
    enabled !== savedEnabled ||
    channelId !== savedChannelId ||
    JSON.stringify([...selectedEvents].sort()) !== JSON.stringify([...savedEvents].sort())

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )

  // Charge la config logging depuis l'endpoint dédié
  useEffect(() => {
    if (!selectedGuildId || !isEnabled) return
    getLoggingConfig(selectedGuildId)
      .then((config) => {
        const ch = String(config.channel_id)
        const evs = new Set(config.events as LogEvent[])
        setChannelId(ch)
        setSelectedEvents(evs)
        setEnabled(true)
        // init saved state
        setSavedChannelId(ch)
        setSavedEvents(new Set(evs))
        setSavedEnabled(true)
      })
      .catch(() => {/* silent — module n'est peut-être pas configuré */})
  }, [selectedGuildId, isEnabled])

  const toggleEvent = (eventId: LogEvent) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  const toggleGroup = (group: string) => {
    const groupEvents = LOG_EVENTS.filter((e) => e.group === group).map((e) => e.id)
    const allSelected = groupEvents.every((id) => selectedEvents.has(id))
    setSelectedEvents((prev) => {
      const next = new Set(prev)
      if (allSelected) groupEvents.forEach((id) => next.delete(id))
      else groupEvents.forEach((id) => next.add(id))
      return next
    })
  }

  const handleSave = async () => {
    if (!selectedGuildId || !channelId) return
    setSaving(true)
    try {
      if (!enabled) {
        await disableModule('logging')
        setSavedEnabled(false)
        setSavedChannelId('')
        setSavedEvents(new Set())
        toast.success(t('modules.logging.disabledSuccess'))
        return
      }
      await updateLogging(selectedGuildId, {
        channel_id: Number(channelId),
        events: Array.from(selectedEvents),
      })
      setSavedEnabled(enabled)
      setSavedChannelId(channelId)
      setSavedEvents(new Set(selectedEvents))
      toast.success(t('modules.saved'))
    } catch (e) {
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setEnabled(savedEnabled)
    setChannelId(savedChannelId)
    setSelectedEvents(new Set(savedEvents))
  }

  const handleDisable = async () => {
    setSaving(true)
    try {
      await disableModule('logging')
      setEnabled(false)
      setSavedEnabled(false)
      setSavedChannelId('')
      setSavedEvents(new Set())
      setChannelId('')
      setSelectedEvents(new Set())
      toast.success(t('modules.logging.disabledSuccess'))
    } catch (e) {
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setSaving(false)
    }
  }

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ScrollTextIcon className="size-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('modules.logging.name')}</h1>
            <p className="text-sm text-muted-foreground">{t('modules.logging.description')}</p>
          </div>
        </div>
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? t('guildOverview.modules.enabled') : t('guildOverview.modules.disabled')}
        </Badge>
      </div>

      <Separator />

      {/* Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-sm">{t('modules.enableModule')}</p>
            <p className="text-xs text-muted-foreground">
              {t('modules.logging.enableDescription')}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      {/* Salon de logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('modules.logging.channelTitle')}</CardTitle>
          <CardDescription>{t('modules.logging.channelDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger>
              <SelectValue placeholder={t('modules.selectChannel')} />
            </SelectTrigger>
            <SelectContent>
              {textChannels.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  # {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Événements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('modules.logging.eventsTitle')}</CardTitle>
          <CardDescription>
            {t('modules.logging.eventsDescription', {
              count: selectedEvents.size,
              total: LOG_EVENTS.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {EVENT_GROUPS.map((group) => {
            const groupEvents = LOG_EVENTS.filter((e) => e.group === group)
            const allSelected = groupEvents.every((e) => selectedEvents.has(e.id))
            const someSelected = groupEvents.some((e) => selectedEvents.has(e.id))

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2">
                  <Switch
                    checked={allSelected}
                    onCheckedChange={() => toggleGroup(group)}
                    data-partial={someSelected && !allSelected}
                    className="data-[partial=true]:opacity-70"
                  />
                  <Label className="font-medium text-sm capitalize">
                    {t(`modules.logging.groups.${group}`)}
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-2 pl-8">
                  {groupEvents.map(({ id }) => (
                    <div key={id} className="flex items-center gap-2">
                      <Switch
                        id={id}
                        checked={selectedEvents.has(id)}
                        onCheckedChange={() => toggleEvent(id)}
                      />
                      <Label htmlFor={id} className="text-xs text-muted-foreground cursor-pointer">
                        {t(`modules.logging.events.${id}`)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Bouton désactiver */}
      {isEnabled && (
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive w-fit"
          onClick={handleDisable}
          disabled={saving}
        >
          <Trash2Icon className="size-4 mr-2" />
          {t('modules.disable')}
        </Button>
      )}

      {/* Save bar Discord-style */}
      <UnsavedBar
        isDirty={isDirty}
        isSaving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
