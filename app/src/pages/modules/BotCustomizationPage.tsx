import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CrownIcon,
  EraserIcon,
  ImageIcon,
  LoaderIcon,
  PaletteIcon,
  RotateCcwIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ErrorPage } from "@/components/error-state"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useGuildContext } from "@/contexts/GuildContext"
import { useUserProfile } from "@/hooks/useProfile"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import {
  DEFAULT_STYLE_COLOR,
  botCustomizationErrorCode,
  colorSlots,
  diffDraft,
  fitColors,
  formatBytes,
  isDirty as computeIsDirty,
  isValidHex,
  normalizeHex,
  stateToDraft,
  validateImage,
  type CustomizationDraft,
  type ImageDraft,
  type StyleDraft,
} from "@/lib/bot-customization"
import {
  getBotCustomization,
  resetBotCustomization,
  saveBotCustomization,
  uploadBotCustomizationImage,
} from "@/services/bot-customization"
import type { BotCustomizationLimits, BotCustomizationState } from "@/types/api"

/** Valeur sentinelle des Select : Radix interdit un SelectItem de valeur vide. */
const NONE = "__none__"

type FieldErrors = Partial<Record<"nickname" | "bio" | "colors" | "avatar" | "banner", string>>

// ─── Markup Discord (attribution de la bio) ───────────────────────────────────

/**
 * Rend le sous-ensemble de markup utilisé par `limits.bio_attribution` :
 * emojis custom `<a:name:id>` et gras `**texte**`. Affiché en aperçu non
 * éditable — cette ligne est ajoutée par le bot, jamais envoyée dans `bio`.
 */
function DiscordMarkup({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  const re = /<(a?):(\w+):(\d+)>|\*\*([^*]+)\*\*/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const [, animated, name, emojiId, bold] = match
    if (emojiId) {
      const ext = animated === "a" ? "gif" : "png"
      nodes.push(
        <img
          key={`${emojiId}-${match.index}`}
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=32`}
          alt={`:${name}:`}
          className="inline-block size-4 align-[-0.2em]"
          referrerPolicy="no-referrer"
        />
      )
    } else {
      nodes.push(
        <strong key={`b-${match.index}`} className="font-semibold">
          {bold}
        </strong>
      )
    }
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))

  return <>{nodes}</>
}

// ─── Aperçu ───────────────────────────────────────────────────────────────────

interface PreviewProps {
  nickname: string
  bio: string
  style: StyleDraft
  limits: BotCustomizationLimits
  avatarUrl: string | null
  bannerUrl: string | null
  fallbackName: string
}

function CustomizationPreview({
  nickname,
  bio,
  style,
  limits,
  avatarUrl,
  bannerUrl,
  fallbackName,
}: PreviewProps) {
  const { t } = useTranslation()
  const displayName = nickname.trim() || fallbackName
  const colors = style.colors.filter(isValidHex)

  // Le dégradé se rend en `background-clip: text` ; une couleur unique suffit
  // en `color`. Les polices Discord ne sont pas distribuées : elles sont
  // indiquées en légende plutôt que simulées.
  const nameStyle =
    style.effect_id === limits.gradient_effect_id && colors.length >= 2
      ? {
          backgroundImage: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
          WebkitBackgroundClip: "text" as const,
          backgroundClip: "text" as const,
          color: "transparent",
        }
      : colors.length >= 1
        ? { color: colors[0] }
        : undefined

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="relative h-28 w-full bg-gradient-to-br from-muted to-muted-foreground/15 sm:h-32">
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      <div className="px-5 pb-5">
        <Avatar className="-mt-10 size-20 ring-4 ring-card">
          <AvatarImage src={avatarUrl ?? undefined} alt={displayName} referrerPolicy="no-referrer" />
          <AvatarFallback className="text-xl font-semibold">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <p className="mt-3 truncate text-lg font-semibold leading-tight" style={nameStyle}>
          {displayName}
        </p>

        <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          {bio.trim() && <p className="whitespace-pre-wrap break-words">{bio.trim()}</p>}
          <p className="break-words">
            <DiscordMarkup text={limits.bio_attribution} />
          </p>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {t("modules.bot_customization.previewHint")}
        </p>
      </div>
    </div>
  )
}

// ─── Champ image ──────────────────────────────────────────────────────────────

interface ImageFieldProps {
  label: string
  hint: string
  /** URL CDN Discord de l'image actuellement appliquée. */
  currentUrl: string | null
  draft: ImageDraft
  locked: boolean
  disabled: boolean
  round: boolean
  limits: BotCustomizationLimits
  error?: string
  onPick: (file: File) => void
  onClear: () => void
  onRevert: () => void
}

function ImageField({
  label,
  hint,
  currentUrl,
  draft,
  locked,
  disabled,
  round,
  limits,
  error,
  onPick,
  onClear,
  onRevert,
}: ImageFieldProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  const previewUrl =
    draft.kind === "file" ? draft.previewUrl : draft.kind === "clear" ? null : currentUrl
  const hasSomething = draft.kind === "file" || (draft.kind === "keep" && currentUrl !== null)

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border bg-muted",
            round ? "size-16 rounded-full" : "h-16 w-28 rounded-lg"
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={limits.image_content_types.join(",")}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                // Réinitialise la valeur : re-sélectionner le même fichier
                // après une erreur doit redéclencher `change`.
                e.target.value = ""
                if (file) onPick(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || locked}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon className="size-4" />
              {hasSomething
                ? t("modules.bot_customization.replaceImage")
                : t("modules.bot_customization.chooseImage")}
            </Button>

            {/* La réinitialisation reste permise sans premium : une guilde qui
                perd le premium doit pouvoir nettoyer ce qu'elle a appliqué. */}
            {(draft.kind === "keep" && currentUrl) || draft.kind === "file" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={draft.kind === "file" ? onRevert : onClear}
                className="text-muted-foreground"
              >
                <XIcon className="size-4" />
                {draft.kind === "file"
                  ? t("modules.bot_customization.cancelImage")
                  : t("modules.bot_customization.removeImage")}
              </Button>
            ) : null}

            {draft.kind === "clear" && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRevert}>
                <RotateCcwIcon className="size-4" />
                {t("modules.bot_customization.undoRemove")}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{hint}</p>
          <p className="text-xs text-muted-foreground">
            {t("modules.bot_customization.imageRules", {
              types: limits.image_content_types
                .map((c) => c.replace("image/", "").toUpperCase())
                .join(", "),
              size: formatBytes(limits.image_max_bytes),
            })}
          </p>
          {draft.kind === "file" && (
            <p className="text-xs text-muted-foreground">
              {t("modules.bot_customization.pendingUpload", { name: draft.file.name })}
            </p>
          )}
          {draft.kind === "clear" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("modules.bot_customization.pendingRemoval")}
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Bandeau premium ──────────────────────────────────────────────────────────

function PremiumNotice() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-400/50 bg-violet-400/10 px-4 py-3">
      <CrownIcon className="size-4 shrink-0 text-violet-500" />
      <p className="min-w-0 flex-1 text-xs text-violet-700 dark:text-violet-300">
        {t("modules.bot_customization.premiumLockDescription")}
      </p>
      <Button
        type="button"
        size="sm"
        className="bg-violet-600 text-white shadow-sm hover:bg-violet-700"
        onClick={() => navigate("/premium")}
      >
        {t("modules.bot_customization.premiumCta")}
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BotCustomizationPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  if (isLoadingGuild || !isGuildReady) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return <BotCustomizationForm />
}

function BotCustomizationForm() {
  const { t, i18n } = useTranslation()
  const { selectedGuildId } = useGuildContext()

  const [state, setState] = useState<BotCustomizationState | null>(null)
  const [draft, setDraft] = useState<CustomizationDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Les URLs d'aperçu local (`URL.createObjectURL`) doivent être révoquées :
  // elles vivent jusqu'au déchargement du document sinon.
  const objectUrls = useRef<string[]>([])
  const trackObjectUrl = useCallback((url: string) => {
    objectUrls.current.push(url)
  }, [])
  useEffect(() => {
    const urls = objectUrls.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  const applyState = useCallback((next: BotCustomizationState) => {
    setState(next)
    setDraft(stateToDraft(next))
    setFieldErrors({})
  }, [])

  const load = useCallback(async () => {
    if (!selectedGuildId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      applyState(await getBotCustomization(selectedGuildId))
    } catch (e) {
      logger.error("module:bot_customization", "Load failed", e)
      setLoadError(e instanceof Error ? e.message : "Failed to load module config")
    } finally {
      setIsLoading(false)
    }
  }, [selectedGuildId, applyState])

  useEffect(() => {
    void load()
  }, [load])

  // ── Erreurs API ───────────────────────────────────────────────────────────

  const showApiError = useCallback(
    (error: unknown) => {
      const code = botCustomizationErrorCode(error)
      if (!code) {
        // Le code nu ne doit jamais s'afficher : sans code connu on retombe sur
        // la gestion générique (réseau, 403, 5xx…).
        handleSaveError(error, { title: t("modules.saveError") })
        return
      }
      // `bot_timeout` : la tâche reste en file côté bot et sera appliquée à son
      // redémarrage — surtout ne pas rejouer la requête.
      if (code === "bot_timeout") {
        toast.warning(t("modules.bot_customization.errors.bot_timeout"), { duration: 12000 })
        return
      }
      toast.error(t("modules.saveError"), {
        description: t(`modules.bot_customization.errors.${code}`),
        duration: code === "rate_limited" ? 10000 : undefined,
      })
    },
    [t]
  )

  // ── Mutations du brouillon ────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<CustomizationDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
  }, [])

  const patchStyle = useCallback(
    (changes: Partial<StyleDraft>) => {
      setDraft((prev) => (prev ? { ...prev, style: { ...prev.style, ...changes } } : prev))
    },
    []
  )

  const handleEffectChange = useCallback(
    (effectId: number | null, limits: BotCustomizationLimits) => {
      setDraft((prev) => {
        if (!prev) return prev
        // Le nombre de couleurs dépend de l'effet : on ajuste immédiatement
        // (dégradé → 2 slots, autre effet → 1, sans effet → 0 ou 1).
        const slots = colorSlots(effectId, limits)
        return {
          ...prev,
          style: { ...prev.style, effect_id: effectId, colors: fitColors(prev.style.colors, slots) },
        }
      })
      setFieldErrors((prev) => ({ ...prev, colors: undefined }))
    },
    []
  )

  const setColor = useCallback((index: number, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev
      const colors = [...prev.style.colors]
      colors[index] = value
      return { ...prev, style: { ...prev.style, colors } }
    })
  }, [])

  const pickImage = useCallback(
    (field: "avatar" | "banner", file: File, limits: BotCustomizationLimits) => {
      const rejection = validateImage(file, limits)
      if (rejection) {
        setFieldErrors((prev) => ({
          ...prev,
          [field]:
            rejection.code === "invalid_image_type"
              ? t("modules.bot_customization.errors.invalid_image_type")
              : t("modules.bot_customization.errors.image_too_large"),
        }))
        return
      }
      const previewUrl = URL.createObjectURL(file)
      trackObjectUrl(previewUrl)
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
      // Le fichier est gardé tel quel : l'upload n'a lieu qu'au save, l'URL
      // hébergée n'ayant que 15 min de validité.
      patch({ [field]: { kind: "file", file, previewUrl } as ImageDraft })
    },
    [patch, t, trackObjectUrl]
  )

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const isDirty = useMemo(
    () => (state && draft ? computeIsDirty(state, draft) : false),
    [state, draft]
  )

  const validate = useCallback(
    (current: BotCustomizationState, value: CustomizationDraft): FieldErrors => {
      const errors: FieldErrors = {}
      const { limits } = current

      if (value.nickname.trim().length > limits.nickname_max_length) {
        errors.nickname = t("modules.bot_customization.nicknameTooLong", {
          max: limits.nickname_max_length,
        })
      }
      if (value.bio.trim().length > limits.bio_max_length) {
        errors.bio = t("modules.bot_customization.bioTooLong", { max: limits.bio_max_length })
      }

      const slots = colorSlots(value.style.effect_id, limits)
      const colors = value.style.colors
      if (colors.some((c) => !isValidHex(c))) {
        errors.colors = t("modules.bot_customization.colorInvalid")
      } else if (colors.length < slots.min || colors.length > slots.max) {
        errors.colors =
          slots.min === 2
            ? t("modules.bot_customization.errors.gradient_needs_two_colors")
            : t("modules.bot_customization.errors.effect_needs_color")
      }

      return errors
    },
    [t]
  )

  const handleSave = useCallback(async () => {
    if (!selectedGuildId || !state || !draft) return

    const errors = validate(state, draft)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const { body, uploadAvatar, uploadBanner } = diffDraft(state, draft)
    if (Object.keys(body).length === 0 && !uploadAvatar && !uploadBanner) return

    logger.event("module:bot_customization", "Save", {
      keys: Object.keys(body),
      uploads: [uploadAvatar && "avatar", uploadBanner && "banner"].filter(Boolean),
    })
    setIsSaving(true)
    setFieldErrors({})
    try {
      // Upload juste avant l'écriture : l'URL hébergée expire en 15 min, la
      // produire à la sélection du fichier exposerait à `image_download_failed`.
      if (uploadAvatar) {
        body.avatar_url = (await uploadBotCustomizationImage(selectedGuildId, uploadAvatar)).url
      }
      if (uploadBanner) {
        body.banner_url = (await uploadBotCustomizationImage(selectedGuildId, uploadBanner)).url
      }

      await saveBotCustomization(selectedGuildId, body)
      // La réponse du PUT est le résultat brut du bot : on relit le GET pour
      // ré-hydrater le formulaire et l'aperçu dans la forme documentée
      // (hashes frais, `updated_at`/`updated_by`, `is_premium`).
      applyState(await getBotCustomization(selectedGuildId))
      logger.success("module:bot_customization", "Saved")
      toast.success(t("modules.saved"))
    } catch (e) {
      logger.error("module:bot_customization", "Save failed", e)
      showApiError(e)
    } finally {
      setIsSaving(false)
    }
  }, [selectedGuildId, state, draft, validate, applyState, showApiError, t])

  const handleReset = useCallback(async () => {
    if (!selectedGuildId) return
    logger.event("module:bot_customization", "Reset")
    setIsResetting(true)
    try {
      await resetBotCustomization(selectedGuildId)
      applyState(await getBotCustomization(selectedGuildId))
      logger.success("module:bot_customization", "Reset done")
      toast.success(t("modules.bot_customization.resetSuccess"))
      setConfirmReset(false)
    } catch (e) {
      logger.error("module:bot_customization", "Reset failed", e)
      showApiError(e)
    } finally {
      setIsResetting(false)
    }
  }, [selectedGuildId, applyState, showApiError, t])

  const handleDiscard = useCallback(() => {
    if (state) applyState(state)
  }, [state, applyState])

  // ── Auteur du dernier changement ──────────────────────────────────────────

  // `updated_by` est un snowflake 64 bits en chaîne — jamais de `Number()`.
  const updatedBy = state?.config.updated_by ?? null
  const updatedByProfile = useUserProfile(updatedBy)

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (loadError || !state || !draft) {
    return <ErrorPage error={loadError ?? "Failed to load module config"} onRetry={load} />
  }

  const { limits, is_premium: isPremium, premium_fields: premiumFields } = state
  const isLocked = (field: string) => !isPremium && premiumFields.includes(field)
  const formDisabled = isSaving || isResetting

  const slots = colorSlots(draft.style.effect_id, limits)
  const canAddColor = draft.style.colors.length < slots.max
  const canRemoveColor = draft.style.colors.length > slots.min

  const fontLabel = (id: number) =>
    t(`modules.bot_customization.fonts.${id}`, {
      defaultValue: t("modules.bot_customization.fontGeneric", { id }),
    })
  const effectLabel = (id: number) =>
    id === limits.gradient_effect_id
      ? t("modules.bot_customization.effectGradient")
      : t(`modules.bot_customization.effects.${id}`, {
          defaultValue: t("modules.bot_customization.effectGeneric", { id }),
        })

  const previewAvatar =
    draft.avatar.kind === "file"
      ? draft.avatar.previewUrl
      : draft.avatar.kind === "clear"
        ? null
        : state.avatar_url
  const previewBanner =
    draft.banner.kind === "file"
      ? draft.banner.previewUrl
      : draft.banner.kind === "clear"
        ? null
        : state.banner_url

  const updatedAtLabel = state.config.updated_at
    ? new Date(state.config.updated_at).toLocaleString(i18n.language)
    : null

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-100 dark:bg-fuchsia-950">
          <PaletteIcon className="size-5 text-fuchsia-500" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-none">
            {t("modules.bot_customization.name")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("modules.bot_customization.description")}
          </p>
        </div>
      </div>

      {!isPremium && <PremiumNotice />}

      {/* Aperçu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.bot_customization.previewTitle")}</CardTitle>
          <CardDescription>{t("modules.bot_customization.previewDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomizationPreview
            nickname={draft.nickname}
            bio={draft.bio}
            style={draft.style}
            limits={limits}
            avatarUrl={previewAvatar}
            bannerUrl={previewBanner}
            fallbackName="Moddy"
          />
        </CardContent>
      </Card>

      {/* Identité (premium) */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">
              {t("modules.bot_customization.identityTitle")}
            </CardTitle>
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
            >
              <CrownIcon className="mr-1 size-3" />
              {t("modules.bot_customization.premiumBadge")}
            </Badge>
          </div>
          <CardDescription>
            {t("modules.bot_customization.identityDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Pseudo */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="bc-nickname">{t("modules.bot_customization.nickname")}</Label>
              <span
                className={cn(
                  "text-xs tabular-nums text-muted-foreground",
                  draft.nickname.trim().length > limits.nickname_max_length && "text-destructive"
                )}
              >
                {draft.nickname.trim().length}/{limits.nickname_max_length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="bc-nickname"
                value={draft.nickname}
                onChange={(e) => patch({ nickname: e.target.value })}
                placeholder={t("modules.bot_customization.nicknamePlaceholder")}
                disabled={formDisabled || isLocked("nickname")}
              />
              {/* Réinitialiser reste possible sans premium (envoi de `null`). */}
              {isLocked("nickname") && draft.nickname !== "" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={formDisabled}
                  onClick={() => patch({ nickname: "" })}
                >
                  <EraserIcon className="size-4" />
                  {t("modules.bot_customization.resetField")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("modules.bot_customization.nicknameHint")}
            </p>
            {fieldErrors.nickname && (
              <p className="text-xs text-destructive">{fieldErrors.nickname}</p>
            )}
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="bc-bio">{t("modules.bot_customization.bio")}</Label>
              <span
                className={cn(
                  "text-xs tabular-nums text-muted-foreground",
                  draft.bio.trim().length > limits.bio_max_length && "text-destructive"
                )}
              >
                {draft.bio.trim().length}/{limits.bio_max_length}
              </span>
            </div>
            <Textarea
              id="bc-bio"
              value={draft.bio}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder={t("modules.bot_customization.bioPlaceholder")}
              rows={3}
              disabled={formDisabled || isLocked("bio")}
            />
            {/* Attribution ajoutée par le bot à chaque écriture — hors compteur,
                jamais incluse dans la valeur envoyée. */}
            <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {t("modules.bot_customization.attributionHint")}
              </p>
              <p className="mt-1 text-sm">
                <DiscordMarkup text={limits.bio_attribution} />
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLocked("bio") && draft.bio !== "" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={formDisabled}
                  onClick={() => patch({ bio: "" })}
                >
                  <EraserIcon className="size-4" />
                  {t("modules.bot_customization.resetField")}
                </Button>
              )}
            </div>
            {fieldErrors.bio && <p className="text-xs text-destructive">{fieldErrors.bio}</p>}
          </div>

          {/* Avatar */}
          <ImageField
            label={t("modules.bot_customization.avatar")}
            hint={t("modules.bot_customization.avatarHint")}
            currentUrl={state.avatar_url}
            draft={draft.avatar}
            locked={isLocked("avatar_url")}
            disabled={formDisabled}
            round
            limits={limits}
            error={fieldErrors.avatar}
            onPick={(file) => pickImage("avatar", file, limits)}
            onClear={() => patch({ avatar: { kind: "clear" } })}
            onRevert={() => patch({ avatar: { kind: "keep" } })}
          />

          {/* Bannière */}
          <ImageField
            label={t("modules.bot_customization.banner")}
            hint={t("modules.bot_customization.bannerHint")}
            currentUrl={state.banner_url}
            draft={draft.banner}
            locked={isLocked("banner_url")}
            disabled={formDisabled}
            round={false}
            limits={limits}
            error={fieldErrors.banner}
            onPick={(file) => pickImage("banner", file, limits)}
            onClear={() => patch({ banner: { kind: "clear" } })}
            onRevert={() => patch({ banner: { kind: "keep" } })}
          />
        </CardContent>
      </Card>

      {/* Style du pseudo (toujours disponible) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.bot_customization.styleTitle")}</CardTitle>
          <CardDescription>{t("modules.bot_customization.styleDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Police */}
            <div className="flex flex-col gap-2">
              <Label>{t("modules.bot_customization.font")}</Label>
              <Select
                value={draft.style.font_id === null ? NONE : String(draft.style.font_id)}
                onValueChange={(v) => patchStyle({ font_id: v === NONE ? null : Number(v) })}
                disabled={formDisabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("modules.bot_customization.fontDefault")}</SelectItem>
                  {limits.font_ids.map((id) => (
                    <SelectItem key={id} value={String(id)}>
                      {fontLabel(id)}
                    </SelectItem>
                  ))}
                  {/* Police enregistrée qui n'est plus proposée par l'API :
                      gardée en option désactivée pour ne pas l'effacer en silence. */}
                  {draft.style.font_id !== null && !limits.font_ids.includes(draft.style.font_id) && (
                    <SelectItem value={String(draft.style.font_id)} disabled>
                      {fontLabel(draft.style.font_id)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Effet */}
            <div className="flex flex-col gap-2">
              <Label>{t("modules.bot_customization.effect")}</Label>
              <Select
                value={draft.style.effect_id === null ? NONE : String(draft.style.effect_id)}
                onValueChange={(v) => handleEffectChange(v === NONE ? null : Number(v), limits)}
                disabled={formDisabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("modules.bot_customization.effectNone")}</SelectItem>
                  {limits.effect_ids.map((id) => (
                    <SelectItem key={id} value={String(id)}>
                      {effectLabel(id)}
                    </SelectItem>
                  ))}
                  {draft.style.effect_id !== null &&
                    !limits.effect_ids.includes(draft.style.effect_id) && (
                      <SelectItem value={String(draft.style.effect_id)} disabled>
                        {effectLabel(draft.style.effect_id)}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Couleurs — 1 ou 2 slots selon l'effet */}
          <div className="flex flex-col gap-2">
            <Label>{t("modules.bot_customization.colors")}</Label>
            <p className="text-xs text-muted-foreground">
              {slots.min === 2
                ? t("modules.bot_customization.colorsGradientHint")
                : slots.min === 1
                  ? t("modules.bot_customization.colorsSingleHint")
                  : t("modules.bot_customization.colorsOptionalHint")}
            </p>

            {draft.style.colors.length === 0 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={formDisabled}
                  onClick={() => patchStyle({ colors: [DEFAULT_STYLE_COLOR] })}
                >
                  <PaletteIcon className="size-4" />
                  {t("modules.bot_customization.addColor")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {draft.style.colors.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      className="color-field size-10 shrink-0 rounded-lg border border-input"
                      // `<input type="color">` n'accepte qu'un `#rrggbb`
                      // minuscule ; le champ texte reste en majuscules.
                      value={(isValidHex(color) ? color : DEFAULT_STYLE_COLOR).toLowerCase()}
                      disabled={formDisabled}
                      onChange={(e) => setColor(index, e.target.value.toUpperCase())}
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(index, e.target.value)}
                      onBlur={(e) => setColor(index, normalizeHex(e.target.value))}
                      placeholder={DEFAULT_STYLE_COLOR}
                      className="max-w-40 font-mono"
                      maxLength={7}
                      disabled={formDisabled}
                    />
                    <span className="text-xs text-muted-foreground">
                      {slots.max === 2
                        ? index === 0
                          ? t("modules.bot_customization.colorFrom")
                          : t("modules.bot_customization.colorTo")
                        : null}
                    </span>
                    {canRemoveColor && index === draft.style.colors.length - 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={formDisabled}
                        onClick={() =>
                          patchStyle({ colors: draft.style.colors.slice(0, index) })
                        }
                        aria-label={t("modules.bot_customization.removeColor")}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {canAddColor && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={formDisabled}
                    onClick={() =>
                      patchStyle({
                        colors: [
                          ...draft.style.colors,
                          draft.style.colors[draft.style.colors.length - 1] ?? DEFAULT_STYLE_COLOR,
                        ],
                      })
                    }
                  >
                    <PaletteIcon className="size-4" />
                    {t("modules.bot_customization.addColor")}
                  </Button>
                )}
              </div>
            )}

            {fieldErrors.colors && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircleIcon className="size-3.5 shrink-0" />
                {fieldErrors.colors}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pied : dernier changement + reset */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {updatedAtLabel && (
            <p>
              {t("modules.bot_customization.lastUpdate", { date: updatedAtLabel })}
              {updatedBy && (
                <>
                  {" · "}
                  {t("modules.bot_customization.lastUpdateBy", {
                    name:
                      updatedByProfile.data?.display_name ??
                      (updatedByProfile.loading
                        ? "…"
                        : t("modules.bot_customization.unknownUser")),
                  })}
                </>
              )}
            </p>
          )}
          {isSaving && (
            <p className="mt-1 flex items-center gap-1.5">
              <LoaderIcon className="size-3.5 animate-spin" />
              {t("modules.bot_customization.savingHint")}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-fit text-destructive hover:text-destructive"
          onClick={() => setConfirmReset(true)}
          disabled={formDisabled}
        >
          {isResetting ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-4" />
          )}
          {t("modules.bot_customization.reset")}
        </Button>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={(open) => !isResetting && setConfirmReset(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.bot_customization.resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.bot_customization.resetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>{t("modules.bot_customization.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Le dialogue ne doit pas se fermer avant la fin de l'appel :
                // l'écriture passe par le bot et peut durer plusieurs secondes.
                e.preventDefault()
                void handleReset()
              }}
              disabled={isResetting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isResetting && <LoaderIcon className="size-4 animate-spin" />}
              {t("modules.bot_customization.resetConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
