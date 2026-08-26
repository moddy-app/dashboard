import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  GlobeIcon,
  InfoIcon,
  LoaderIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { languageNotice, showsEffectiveBadge } from "@/lib/guild-language"
import { logger } from "@/lib/logger"
import { getGuildLanguage, setGuildLanguage } from "@/services/guild-settings"
import type { GuildLanguageSettings } from "@/types/api"

export function GuildSettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedGuildId, guildDetail, isLoadingGuild, guildError, refreshGuildData } =
    useGuildContext()

  /**
   * Libellé d'une locale, **en endonyme** (« Deutsch », pas « Allemand ») :
   * c'est la convention d'un sélecteur de langue. `auto` est le seul libellé
   * traduit, puisqu'il ne nomme pas une langue. Un code inconnu (langue ajoutée
   * côté bot avant le dashboard) s'affiche tel quel plutôt que vide.
   */
  const localeLabel = useCallback(
    (code: string) => t(`guildSettings.language.choices.${code}`, { defaultValue: code }),
    [t]
  )

  const [settings, setSettings] = useState<GuildLanguageSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // ── Chargement ────────────────────────────────────────────────────────────
  // Relu au montage, **sans cache** : la langue est aussi modifiable depuis
  // `/config` dans Discord et rien n'est publié vers le dashboard dans ce sens.

  useEffect(() => {
    if (!selectedGuildId) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const fresh = await getGuildLanguage(selectedGuildId)
        if (!cancelled) setSettings(fresh)
      } catch (e) {
        if (cancelled) return
        logger.error("guild:settings", "Load failed", e)
        // 404 = serveur introuvable : rester sur une page vide n'aide personne.
        if (e instanceof ApiError && e.isNotFound) {
          navigate("/", { replace: true })
          return
        }
        setLoadError(e instanceof Error ? e.message : "Failed to load server settings")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedGuildId, navigate])

  // ── Écriture ──────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    async (language: string) => {
      if (!selectedGuildId || !settings || language === settings.language) return

      // Optimiste : le sélecteur bouge tout de suite, mais l'ancienne valeur est
      // gardée pour être **restaurée** en cas d'échec — un `<select>` ne doit
      // jamais afficher un choix qui n'a pas été enregistré.
      const previous = settings
      setSettings({ ...settings, language })
      setIsSaving(true)
      logger.event("guild:settings", "Save language", { language })
      try {
        // La réponse est le payload complet, déjà rafraîchi (`effective_language`
        // recalculé) : elle remplace l'état, pas besoin d'un `GET` derrière.
        const fresh = await setGuildLanguage(selectedGuildId, language)
        setSettings(fresh)
        toast.success(t("guildSettings.language.saved"))
        logger.success("guild:settings", "Language saved", { language })
      } catch (e) {
        logger.error("guild:settings", "Save failed", e)
        setSettings(previous)
        handleSaveError(e, { title: t("guildSettings.language.saveError") })
      } finally {
        setIsSaving(false)
      }
    },
    [selectedGuildId, settings, t]
  )

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoadingGuild || isLoading || !settings) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  const notice = languageNotice(settings)
  // Extrait pour que TypeScript garde la narrowing : `showsEffectiveBadge()` ne
  // la fait pas remonter jusqu'ici.
  const effective = settings.effective_language

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <SettingsIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">{t("guildSettings.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {guildDetail?.name
              ? t("guildSettings.descriptionNamed", { name: guildDetail.name })
              : t("guildSettings.description")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">{t("guildSettings.language.title")}</CardTitle>
              <CardDescription>{t("guildSettings.language.description")}</CardDescription>
            </div>
            {/* Le badge n'a de sens que sur `auto` avec une langue effective
                connue — sinon il répète le sélecteur ou invente une valeur. */}
            {showsEffectiveBadge(settings) && effective && (
              <Badge variant="secondary" className="shrink-0">
                <GlobeIcon className="size-3 mr-1" />
                {t("guildSettings.language.effectiveBadge", {
                  language: localeLabel(effective),
                })}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {/* Alimenté par `choices` : la liste des langues vit côté backend. */}
            <Select
              value={settings.language}
              onValueChange={handleChange}
              disabled={isSaving}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.choices.map((code) => (
                  <SelectItem key={code} value={code}>
                    {localeLabel(code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSaving && <LoaderIcon className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {/* Explication contextuelle — le cœur de l'écran. */}
          {notice === "community" && effective && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <InfoIcon className="size-3.5 mt-0.5 shrink-0" />
              <span>
                {t("guildSettings.language.autoCommunity", {
                  language: localeLabel(effective),
                })}
              </span>
            </p>
          )}

          {/* Hors Communauté, `auto` veut dire anglais : le ton reste informatif,
              ce n'est pas une erreur — mais ça doit se voir. */}
          {notice === "notCommunity" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlertIcon className="size-3.5 mt-0.5 shrink-0" />
              <span className="leading-relaxed">
                {t("guildSettings.language.autoNotCommunity")}
                {settings.preferred_locale && (
                  <>
                    {" "}
                    {t("guildSettings.language.autoNotCommunityLocale", {
                      locale: localeLabel(settings.preferred_locale),
                    })}
                  </>
                )}
              </span>
            </div>
          )}

          {notice === "unknown" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <InfoIcon className="size-3.5 mt-0.5 shrink-0" />
              <span>{t("guildSettings.language.discordUnreachable")}</span>
            </p>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("guildSettings.language.scopeHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
