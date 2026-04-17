import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Trash2Icon, MessageSquareIcon } from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
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
import { Textarea } from "@/components/ui/textarea"
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
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { WelcomeChannelConfig } from "@/types/api"

const schema = z.object({
  channel_id: z.string().min(1),
  message_template: z.string().min(1).max(2000),
  mention_user: z.boolean(),
  embed_enabled: z.boolean(),
  embed_title: z.string().max(256).optional(),
  embed_description: z.string().max(4096).nullable().optional(),
  embed_color: z.string().optional(),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function hexToDecimal(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function decimalToHex(decimal: number): string {
  return `#${decimal.toString(16).padStart(6, '0')}`
}

export function WelcomeChannelPage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    channels,
    modules,
    isLoadingGuild,
    updateModule,
    disableModule,
  } = useGuildContext()

  const currentConfig = modules['welcome_channel'] as WelcomeChannelConfig | undefined
  const isEnabled = 'welcome_channel' in modules

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel_id: String(currentConfig?.channel_id ?? ''),
      message_template: currentConfig?.message_template ?? 'Welcome {user} to the server!',
      mention_user: currentConfig?.mention_user ?? true,
      embed_enabled: currentConfig?.embed_enabled ?? false,
      embed_title: currentConfig?.embed_title ?? '',
      embed_description: currentConfig?.embed_description ?? '',
      embed_color: currentConfig?.embed_color
        ? decimalToHex(currentConfig.embed_color)
        : '#5865F2',
      enabled: isEnabled,
    },
  })

  useEffect(() => {
    if (currentConfig) {
      form.reset({
        channel_id: String(currentConfig.channel_id),
        message_template: currentConfig.message_template,
        mention_user: currentConfig.mention_user,
        embed_enabled: currentConfig.embed_enabled,
        embed_title: currentConfig.embed_title ?? '',
        embed_description: currentConfig.embed_description ?? '',
        embed_color: currentConfig.embed_color
          ? decimalToHex(currentConfig.embed_color)
          : '#5865F2',
        enabled: true,
      })
    }
  }, [currentConfig, form])

  const watchEmbedEnabled = form.watch('embed_enabled')

  const onSubmit = async (values: FormValues) => {
    if (!selectedGuildId) return

    if (!values.enabled) {
      await disableModule('welcome_channel')
      toast.success(t('modules.welcome_channel.disabledSuccess'))
      return
    }

    try {
      const payload: Record<string, unknown> = {
        channel_id: Number(values.channel_id),
        message_template: values.message_template,
        mention_user: values.mention_user,
        embed_enabled: values.embed_enabled,
      }
      if (values.embed_enabled) {
        payload.embed_title = values.embed_title || undefined
        payload.embed_description = values.embed_description || null
        payload.embed_color = values.embed_color
          ? hexToDecimal(values.embed_color)
          : undefined
      }
      await updateModule('welcome_channel', payload)
      form.reset(values)
      toast.success(t('modules.saved'))
    } catch {
      toast.error(t('modules.saveError'))
    }
  }

  const handleDisable = async () => {
    try {
      await disableModule('welcome_channel')
      const values = form.getValues()
      form.reset({ ...values, enabled: false })
      toast.success(t('modules.welcome_channel.disabledSuccess'))
    } catch {
      toast.error(t('modules.saveError'))
    }
  }

  const handleDiscard = () => {
    form.reset()
  }

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <MessageSquareIcon className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('modules.welcome_channel.name')}</h1>
            <p className="text-sm text-muted-foreground">{t('modules.welcome_channel.description')}</p>
          </div>
        </div>
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? t('guildOverview.modules.enabled') : t('guildOverview.modules.disabled')}
        </Badge>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Toggle */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-sm">{t('modules.enableModule')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('modules.welcome_channel.enableDescription')}
                </p>
              </div>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Config de base */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('modules.welcome_channel.configTitle')}</CardTitle>
              <CardDescription>{t('modules.welcome_channel.configDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Salon */}
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.welcome_channel.channel')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('modules.selectChannel')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {textChannels.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            # {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Message template */}
              <FormField
                control={form.control}
                name="message_template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.welcome_channel.messageTemplate')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Welcome {user} to the server!"
                      />
                    </FormControl>
                    <FormDescription>
                      {t('modules.welcome_channel.messageTemplateDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mention */}
              <FormField
                control={form.control}
                name="mention_user"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>{t('modules.welcome_channel.mentionUser')}</FormLabel>
                      <FormDescription>
                        {t('modules.welcome_channel.mentionUserDescription')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Embed */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t('modules.welcome_channel.embed')}</CardTitle>
                  <CardDescription>{t('modules.welcome_channel.embedDescription')}</CardDescription>
                </div>
                <FormField
                  control={form.control}
                  name="embed_enabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardHeader>
            {watchEmbedEnabled && (
              <CardContent className="flex flex-col gap-4 pt-0">
                <FormField
                  control={form.control}
                  name="embed_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modules.welcome_channel.embedTitle')}</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={256} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="embed_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modules.welcome_channel.embedBody')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          rows={4}
                          maxLength={4096}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="embed_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('modules.welcome_channel.embedColor')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input {...field} type="color" className="h-10 w-20 p-1 cursor-pointer" />
                        </FormControl>
                        <Input
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="#5865F2"
                          className="flex-1"
                          maxLength={7}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            )}
          </Card>

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

      <UnsavedBar
        isDirty={form.formState.isDirty}
        isSaving={form.formState.isSubmitting}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
