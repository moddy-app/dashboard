import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  LoaderIcon,
  RefreshCwIcon,
  SparklesIcon,
  ShieldAlertIcon,
  UsersIcon,
  StarIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  GlobeIcon,
  BellIcon,
  ShieldIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExternalLinkIcon,
  CrownIcon,
  ZapIcon,
  RadioIcon,
  HashIcon,
  LinkIcon,
  BadgeCheckIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ErrorPage } from "@/components/error-state"
import { DebugErrorOverlay } from "@/components/debug-error-overlay"
import { useGuildContext } from "@/contexts/GuildContext"
import { getGuildIconUrl } from "@/lib/auth"
import { createCheckout } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"
import type { LucideIcon } from "lucide-react"

// ─── Carte module ─────────────────────────────────────────────────────────────

interface ModuleCardProps {
  moduleId: string
  name: string
  description: string
  icon: LucideIcon
  isEnabled: boolean
  isAvailable: boolean
  guildId: string
  onNavigate: (path: string) => void
}

function ModuleCard({
  moduleId, name, description, icon: Icon,
  isEnabled, isAvailable, guildId, onNavigate,
}: ModuleCardProps) {
  const { t } = useTranslation()
  return (
    <Card
      className={`transition-colors ${isAvailable ? "cursor-pointer hover:bg-accent/50" : "opacity-60"}`}
      onClick={() => isAvailable && onNavigate(`/servers/${guildId}/modules/${moduleId}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-medium">{name}</CardTitle>
          </div>
          {isEnabled ? (
            <Badge variant="outline" className="text-xs shrink-0 text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
              <CheckCircleIcon className="size-3 mr-1" />
              {t('guildOverview.modules.enabled')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
              <XCircleIcon className="size-3 mr-1" />
              {t('guildOverview.modules.disabled')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
        {isAvailable ? (
          <div className="flex items-center gap-1 mt-2 text-xs text-primary">
            <ExternalLinkIcon className="size-3" />
            <span>{t('guildOverview.modules.configure')}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-2 italic">
            {t('guildOverview.modules.comingSoon')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function GuildOverviewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    guildDetail,
    stats,
    modules,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    refreshGuildList,
    selectedGuildId,
  } = useGuildContext()

  const handleUpgrade = async () => {
    if (!guildDetail) return
    try {
      const url = await createCheckout(guildDetail.guild_id, 'monthly')
      window.location.href = url
    } catch (e) {
      handleSaveError(e, { title: t('guildOverview.premium.checkoutError') })
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (guildError) {
    return (
      <>
        <ErrorPage
          error={guildError}
          onRetry={refreshGuildData}
          onSecondaryAction={refreshGuildList}
          secondaryActionLabel={t('errors.refreshServers')}
        />
        <DebugErrorOverlay error={guildError} context="guild/load" />
      </>
    )
  }

  if (!guildDetail || !selectedGuildId) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Données ────────────────────────────────────────────────────────────────

  const iconUrl = getGuildIconUrl(guildDetail.guild_id, guildDetail.icon)
  const isPremium = guildDetail.attributes?.PREMIUM === true || stats?.is_premium === true
  const isBeta = guildDetail.attributes?.BETA === true
  const isBlacklisted = guildDetail.attributes?.BLACKLISTED === true
  const boostTier = guildDetail.premium_tier ?? 0
  const boostCount = guildDetail.premium_subscription_count ?? 0

  // Features Discord pertinentes à afficher
  const interestingFeatures = (guildDetail.features ?? []).filter((f) =>
    ['COMMUNITY', 'PARTNERED', 'VERIFIED', 'DISCOVERABLE', 'MONETIZATION_ENABLED'].includes(f)
  )
  const featureLabels: Record<string, string> = {
    COMMUNITY: 'Community',
    PARTNERED: 'Partenaire',
    VERIFIED: 'Vérifié',
    DISCOVERABLE: 'Découvrable',
    MONETIZATION_ENABLED: 'Monétisation',
  }

  const allModules = [
    { id: 'starboard', icon: StarIcon, available: true },
    { id: 'welcome_channel', icon: MessageSquareIcon, available: true },
    { id: 'auto_role', icon: UsersIcon, available: true },
    { id: 'logging', icon: ScrollTextIcon, available: true },
    { id: 'auto_restore_roles', icon: ShieldIcon, available: false },
    { id: 'interserver', icon: GlobeIcon, available: false },
    { id: 'youtube_notifications', icon: BellIcon, available: false },
  ]

  const boostTierLabel = boostTier > 0 ? `Level ${boostTier}` : null

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── En-tête serveur ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 rounded-xl">
            <AvatarImage src={iconUrl ?? undefined} alt={guildDetail.name} />
            <AvatarFallback className="rounded-xl text-lg font-bold">
              {guildDetail.name?.slice(0, 2)?.toUpperCase() ?? '??'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            {/* Nom + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold leading-none">{guildDetail.name}</h1>
              {isPremium && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-xs">
                  <CrownIcon className="size-3 mr-1" />
                  Moddy Premium
                </Badge>
              )}
              {boostTierLabel && (
                <Badge variant="secondary" className="text-xs">
                  <ZapIcon className="size-3 mr-1 text-purple-500" />
                  {boostTierLabel}
                </Badge>
              )}
              {interestingFeatures.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs">
                  <BadgeCheckIcon className="size-3 mr-1" />
                  {featureLabels[f] ?? f}
                </Badge>
              ))}
              {isBeta && <Badge variant="secondary" className="text-xs">Beta</Badge>}
              {isBlacklisted && (
                <Badge variant="destructive" className="text-xs">
                  <ShieldAlertIcon className="size-3 mr-1" />
                  {t('guildOverview.blacklisted')}
                </Badge>
              )}
            </div>
            {/* Infos secondaires */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {guildDetail.description && (
                <span className="max-w-xs truncate">{guildDetail.description}</span>
              )}
              {guildDetail.vanity_url_code && (
                <a
                  href={`https://discord.gg/${guildDetail.vanity_url_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <LinkIcon className="size-3" />
                  discord.gg/{guildDetail.vanity_url_code}
                </a>
              )}
              {boostCount > 0 && (
                <span className="flex items-center gap-1">
                  <ZapIcon className="size-3 text-purple-400" />
                  {boostCount} {boostCount > 1 ? 'boosts' : 'boost'}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshGuildData}>
          <RefreshCwIcon className="size-4 mr-1.5" />
          {t('guildOverview.refresh')}
        </Button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <UsersIcon className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">
                {guildDetail.member_count?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('guildOverview.stats.members')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
              <RadioIcon className="size-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">
                {guildDetail.presence_count?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('guildOverview.stats.online')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
              <ShieldAlertIcon className="size-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">
                {stats ? `${stats.open_cases}/${stats.total_cases}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('guildOverview.stats.cases')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center shrink-0">
              <HashIcon className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">
                {Object.keys(modules).length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('guildOverview.stats.activeModules')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CTA Premium ─────────────────────────────────────────────────── */}
      {!isPremium && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="flex items-center justify-between gap-4 p-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CrownIcon className="size-6 text-amber-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">{t('guildOverview.premium.title')}</p>
                <p className="text-xs text-muted-foreground">{t('guildOverview.premium.description')}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
              onClick={handleUpgrade}
            >
              <SparklesIcon className="size-4 mr-1.5" />
              {t('guildOverview.premium.cta')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Modules ─────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold">{t('guildOverview.modules.title')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('guildOverview.modules.description')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allModules.map(({ id, icon, available }) => (
            <ModuleCard
              key={id}
              moduleId={id}
              name={t(`modules.${id}.name`)}
              description={t(`modules.${id}.description`)}
              icon={icon}
              isEnabled={id in modules}
              isAvailable={available}
              guildId={selectedGuildId}
              onNavigate={navigate}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
