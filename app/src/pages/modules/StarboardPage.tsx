import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Trash2Icon, StarIcon, AlertCircleIcon, LoaderIcon, ChevronDownIcon } from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { resolveChannelId } from "@/lib/utils"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorPage } from "@/components/error-state"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { StarboardConfig } from "@/types/api"

const COMMON_REACTION_EMOJI = [
  '⭐', '🌟', '💫', '✨', '👍', '❤️', '🔥', '🎉',
  '😂', '😍', '🤩', '💯', '🏆', '👑', '💎', '🚀',
  '🎯', '💪', '🙌', '👏', '🥇', '🌈', '💜', '🤣',
]

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
}

function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-24 h-10 flex items-center gap-1.5 px-3 font-normal"
        >
          <span className="text-xl leading-none">{value || '⭐'}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground ml-auto shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-8 gap-1">
          {COMMON_REACTION_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onChange(emoji); setOpen(false) }}
              className={`size-8 flex items-center justify-center text-lg rounded-md hover:bg-accent transition-colors ${value === emoji ? 'bg-accent ring-1 ring-primary' : ''}`}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Coller un emoji…"
            className="h-8 text-sm"
            maxLength={8}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

const schema = z.object({
  channel_id: z.string().min(1, { message: "Required" }),
  reaction_count: z.number().int().min(1).max(100),
  emoji: z.string().min(1, { message: "Required" }),
  enabled: z.boolean(),
})

type FormValues = z.infer<typeof schema>

/**
 * Garde de chargement : le formulaire n'est monté qu'une fois les salons et la
 * config du serveur disponibles. Sans ça, une arrivée directe sur l'URL monte
 * `useForm` avec des `defaultValues` vides (sélecteur de salon vide) et le
 * formulaire apparaît modifié dès la ré-hydratation.
 */
export function StarboardPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  if (isLoadingGuild || !isGuildReady) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return <StarboardForm />
}

function StarboardForm() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    channels,
    modules,
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
      channel_id: resolveChannelId(currentConfig?.channel_id, textChannels.map((c) => c.id)),
      reaction_count: currentConfig?.reaction_count ?? 5,
      emoji: currentConfig?.emoji ?? '⭐',
      enabled: isEnabled,
    },
  })

  const [isDisabling, setIsDisabling] = useState(false)
  // Guards against the post-save useEffect reset loop: when onSubmit calls
  // form.reset(values), the parent's `currentConfig` reference updates,
  // which re-triggers this effect — without the ref, the effect would
  // reset form state back to a "dirty" diff of server vs local values.
  const justSavedRef = useRef(false)

  // Re-populate quand la config ou la liste de salons est chargée
  useEffect(() => {
    if (justSavedRef.current) {
      justSavedRef.current = false
      return
    }
    if (!currentConfig) return
    if (form.formState.isDirty) return // Ne pas écraser les modifs en cours
    form.reset({
      channel_id: resolveChannelId(currentConfig.channel_id, textChannels.map((c) => c.id)),
      reaction_count: currentConfig.reaction_count ?? 5,
      emoji: currentConfig.emoji ?? '⭐',
      enabled: true,
    })
    // `textChannels` est dérivé de `channels` — la dépendance sur
    // `channels.length` suffit et évite de relancer le reset à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConfig, channels.length, form])

  const onSubmit = async (values: FormValues) => {
    if (!selectedGuildId) return
    logger.event('module:starboard', 'Submit', values)

    try {
      await updateModule('starboard', {
        channel_id: values.channel_id,
        reaction_count: values.reaction_count,
        emoji: values.emoji,
      })
      justSavedRef.current = true
      form.reset(values)
      logger.success('module:starboard', 'Saved')
      toast.success(t('modules.saved'))
    } catch (e) {
      logger.error('module:starboard', 'Save failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
    }
  }

  const handleDisable = async () => {
    logger.event('module:starboard', 'Disable clicked')
    setIsDisabling(true)
    try {
      await disableModule('starboard')
      const values = form.getValues()
      justSavedRef.current = true
      form.reset({ ...values, enabled: false })
      logger.success('module:starboard', 'Disabled')
      toast.success(t('modules.starboard.disabledSuccess'))
    } catch (e) {
      logger.error('module:starboard', 'Disable failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setIsDisabling(false)
    }
  }

  const handleDiscard = () => {
    logger.event('module:starboard', 'Discard clicked')
    form.reset()
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
            <StarIcon className="size-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t('modules.starboard.name')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('modules.starboard.description')}</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('modules.starboard.configTitle')}</CardTitle>
              <CardDescription>{t('modules.starboard.configDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Salon */}
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.starboard.channel')}</FormLabel>
                    <Select
                      key={`${textChannels.length}:${String(currentConfig?.channel_id ?? '')}`}
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger disabled={textChannels.length === 0}>
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
                        {/* Fallback item for saved value that no longer exists
                            in the channel list (deleted, wrong type, snowflake
                            precision mismatch) — keeps SelectValue displaying
                            something instead of falling through to placeholder. */}
                        {field.value &&
                          textChannels.length > 0 &&
                          !textChannels.find((c) => c.id === field.value) && (
                            <SelectItem key={`fallback-${field.value}`} value={field.value} disabled>
                              # {field.value}
                            </SelectItem>
                          )}
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
                      <EmojiPicker value={field.value} onChange={field.onChange} />
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
              disabled={form.formState.isSubmitting || isDisabling}
            >
              {isDisabling ? (
                <LoaderIcon className="size-4 mr-2 animate-spin" />
              ) : (
                <Trash2Icon className="size-4 mr-2" />
              )}
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
