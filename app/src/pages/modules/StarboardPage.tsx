import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Trash2Icon, StarIcon, AlertCircleIcon } from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { handleSaveError } from "@/lib/handle-error"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ErrorPage } from "@/components/error-state"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { StarboardConfig } from "@/types/api"

const schema = z.object({
  channel_id: z.string().min(1, { message: "Required" }),
  reaction_count: z.number().int().min(1).max(100),
  emoji: z.string().min(1, { message: "Required" }),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function StarboardPage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    channels,
    modules,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    updateModule,
    disableModule,
  } = useGuildContext()

  const currentConfig = modules['starboard'] as StarboardConfig | undefined
  const isEnabled = 'starboard' in modules

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel_id: String(currentConfig?.channel_id ?? ''),
      reaction_count: currentConfig?.reaction_count ?? 5,
      emoji: currentConfig?.emoji ?? '⭐',
      enabled: isEnabled,
    },
  })

  // Re-populate when data loads
  useEffect(() => {
    if (currentConfig) {
      form.reset({
        channel_id: String(currentConfig.channel_id),
        reaction_count: currentConfig.reaction_count,
        emoji: currentConfig.emoji,
        enabled: true,
      })
    }
  }, [currentConfig, form])

  const onSubmit = async (values: FormValues) => {
    if (!selectedGuildId) return

    if (!values.enabled) {
      await disableModule('starboard')
      form.reset(values) // reset dirty state
      toast.success(t('modules.starboard.disabledSuccess'))
      return
    }

    try {
      await updateModule('starboard', {
        channel_id: Number(values.channel_id),
        reaction_count: values.reaction_count,
        emoji: values.emoji,
      })
      form.reset(values) // reset dirty state after save
      toast.success(t('modules.saved'))
    } catch (e) {
      handleSaveError(e, { title: t('modules.saveError') })
    }
  }

  const handleDisable = async () => {
    try {
      await disableModule('starboard')
      const values = form.getValues()
      form.reset({ ...values, enabled: false })
      toast.success(t('modules.starboard.disabledSuccess'))
    } catch (e) {
      handleSaveError(e, { title: t('modules.saveError') })
    }
  }

  const handleDiscard = () => {
    form.reset()
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
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
            <StarIcon className="size-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('modules.starboard.name')}</h1>
            <p className="text-sm text-muted-foreground">{t('modules.starboard.description')}</p>
          </div>
        </div>
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? t('guildOverview.modules.enabled') : t('guildOverview.modules.disabled')}
        </Badge>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Toggle d'activation */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">{t('modules.enableModule')}</p>
                <p className="text-xs text-muted-foreground">{t('modules.starboard.enableDescription')}</p>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('modules.starboard.configTitle')}</CardTitle>
              <CardDescription>{t('modules.starboard.configDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Salon */}
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.starboard.channel')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('modules.selectChannel')} />
                        </SelectTrigger>
                      </FormControl>
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
                    <FormDescription>{t('modules.starboard.channelDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Emoji */}
              <FormField
                control={form.control}
                name="emoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.starboard.emoji')}</FormLabel>
                    <FormControl>
                      <Input {...field} className="w-24" maxLength={8} />
                    </FormControl>
                    <FormDescription>{t('modules.starboard.emojiDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nombre de réactions */}
              <FormField
                control={form.control}
                name="reaction_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.starboard.reactionCount')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        className="w-24"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormDescription>{t('modules.starboard.reactionCountDescription')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bouton désactiver (si activé) */}
          {isEnabled && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive w-fit"
              onClick={handleDisable}
              disabled={form.formState.isSubmitting}
            >
              <Trash2Icon className="size-4 mr-2" />
              {t('modules.disable')}
            </Button>
          )}
        </form>
      </Form>

      {/* Save bar Discord-style */}
      <UnsavedBar
        isDirty={form.formState.isDirty}
        isSaving={form.formState.isSubmitting}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
