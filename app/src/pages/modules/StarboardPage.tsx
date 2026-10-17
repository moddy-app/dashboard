import { useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { UnsavedBar } from "@/components/unsaved-bar"
import { handleSaveError } from "@/lib/handle-error"
import { ApiError } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { resolveChannelId } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { ChannelPicker, EmojiPicker } from "@/components/pickers"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES } from "@/types/api"
import type { StarboardConfig } from "@/types/api"

// Format Discord des emojis custom/serveur : <:name:id> ou animé <a:name:id>.
// Le backend les refuse (422) — on bloque côté client pour éviter l'aller-retour.
const DISCORD_CUSTOM_EMOJI_RE = /<a?:\w{2,32}:\d{15,20}>/
// Un emoji Unicode standard porte la propriété Extended_Pictographic (⭐, 🔥…)
// ou Regional_Indicator (drapeaux 🇫🇷) — sert à rejeter le texte brut collé par erreur.
const UNICODE_EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u

function createSchema(t: (key: string) => string) {
  return z.object({
    channel_id: z.string().min(1, { message: "Required" }),
    reaction_count: z.number().int().min(1).max(100),
    emoji: z
      .string()
      .min(1, { message: "Required" })
      .refine((v) => !DISCORD_CUSTOM_EMOJI_RE.test(v), {
        message: t('modules.starboard.emojiCustomNotAllowed'),
      })
      .refine((v) => UNICODE_EMOJI_RE.test(v), {
        message: t('modules.starboard.emojiInvalid'),
      }),
    enabled: z.boolean(),
  })
}

type FormValues = z.infer<ReturnType<typeof createSchema>>

/**
 * Garde de chargement : le formulaire n'est monté qu'une fois les salons et la
 * config du serveur disponibles. Sans ça, une arrivée directe sur l'URL monte
 * `useForm` avec des `defaultValues` vides (sélecteur de salon vide) et le
 * formulaire apparaît modifié dès la ré-hydratation.
 */
export function StarboardPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError || isLoadingGuild || !isGuildReady) {
    return (
      <ModulePage moduleId="starboard" loading={!guildError} error={guildError} onRetry={refreshGuildData}>
        {null}
      </ModulePage>
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

  const schema = useMemo(() => createSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      channel_id: resolveChannelId(currentConfig?.channel_id, textChannels.map((c) => c.id)),
      reaction_count: currentConfig?.reaction_count ?? 5,
      emoji: currentConfig?.emoji ?? '⭐',
      enabled: isEnabled,
    },
  })

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
      if (e instanceof ApiError && e.status === 422) {
        const known: (keyof FormValues)[] = ['channel_id', 'reaction_count', 'emoji']
        let mapped = false
        for (const issue of e.validationIssues) {
          const field = issue.loc?.find((p): p is keyof FormValues => known.includes(p as keyof FormValues))
          if (field) {
            form.setError(field, { message: issue.msg })
            mapped = true
          }
        }
        if (!mapped) {
          // Erreur 422 sous forme de chaîne (ex: "Salon starboard invalide") plutôt
          // qu'un tableau de validation par champ — on retombe sur le toast générique.
          handleSaveError(e, { title: t('modules.saveError') })
        }
      } else {
        handleSaveError(e, { title: t('modules.saveError') })
      }
    }
  }

  const handleDisable = async () => {
    logger.event('module:starboard', 'Reset')
    await disableModule('starboard')
    const values = form.getValues()
    justSavedRef.current = true
    form.reset({ ...values, enabled: false })
  }

  const handleDiscard = () => {
    logger.event('module:starboard', 'Discard clicked')
    form.reset()
  }

  return (
    <ModulePage moduleId="starboard" actions={<ModuleStateControl moduleId="starboard" onReset={handleDisable} />}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          {/* Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('modules.starboard.configTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Salon */}
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('modules.starboard.channel')}</FormLabel>
                    <FormControl>
                      <ChannelPicker
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? '')}
                        channels={textChannels}
                        placeholder={t('modules.selectChannel')}
                      />
                    </FormControl>
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
                      <EmojiPicker value={field.value || null} onChange={(v) => field.onChange(v ?? '')} unicodeOnly />
                    </FormControl>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

        </form>
      </Form>

      {/* Save bar Discord-style */}
      <UnsavedBar
        isDirty={form.formState.isDirty}
        isSaving={form.formState.isSubmitting}
        onSave={() => form.handleSubmit(onSubmit)()}
        onDiscard={handleDiscard}
      />
    </ModulePage>
  )
}
