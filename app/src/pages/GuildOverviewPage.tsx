import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  LoaderIcon,
  SparklesIcon,
  ShieldAlertIcon,
  UsersIcon,
  StarIcon,
  MessageSquareIcon,
  ScrollTextIcon,
  GaugeIcon,
  BellRingIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExternalLinkIcon,
  CrownIcon,
  ZapIcon,
  RadioIcon,
  HashIcon,
  LinkIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ErrorPage } from "@/components/error-state"
import { DebugErrorOverlay } from "@/components/debug-error-overlay"
import { VerifiedBadge } from "@/components/verified-badge"
import { resolveVerifiedKind } from "@/lib/verified"
import { useGuildContext } from "@/contexts/GuildContext"
import { useGuildAttributes } from "@/hooks/useGuildAttributes"
import { getGuildIconUrl } from "@/lib/auth"
import { createCheckout } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"
import type { LucideIcon } from "lucide-react"

// Classes statiques par couleur (Tailwind ne peut pas générer `bg-${color}-100`).
const STAT_STYLES = {
  blue: { box: "bg-blue-100 dark:bg-blue-950", icon: "text-blue-600 dark:text-blue-400" },
  green: { box: "bg-green-100 dark:bg-green-950", icon: "text-green-600 dark:text-green-400" },
  orange: { box: "bg-orange-100 dark:bg-orange-950", icon: "text-orange-600 dark:text-orange-400" },
  purple: { box: "bg-purple-100 dark:bg-purple-950", icon: "text-purple-600 dark:text-purple-400" },
} as const

// ─── Carte module ─────────────────────────────────────────────────────────────

interface ModuleCardProps {
  moduleId: string
  name: string
  description: string
  icon: LucideIcon
  isEnabled: boolean
  guildId: string
  onNavigate: (path: string) => void
}

function ModuleCard({
  moduleId, name, description, icon: Icon,
  isEnabled, guildId, onNavigate,
}: ModuleCardProps) {
  const { t } = useTranslation()
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 py-0"
      onClick={() => onNavigate(`/servers/${guildId}/modules/${moduleId}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="size-3.5 text-muted-foreground" />
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
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
          <ExternalLinkIcon className="size-3" />
          <span>{t('guildOverview.modules.configure')}</span>
        </div>
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
    guilds,
    stats,
    modules,
    isPremium,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    refreshGuildList,
    selectedGuildId,
  } = useGuildContext()

  const [isUpgrading, setIsUpgrading] = useState(false)
  const guildAttributes = useGuildAttributes()

  const handleUpgrade = async () => {
    if (!guildDetail) return
    setIsUpgrading(true)
    try {
      const url = await createCheckout('monthly')
      window.location.href = url
    } catch (e) {
      handleSaveError(e, { title: t('guildOverview.premium.checkoutError') })
      setIsUpgrading(false)
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

  // IMPORTANT: utiliser selectedGuildId (source Discord via /auth/me) et NON
  // guildDetail.guild_id qui peut être corrompu si stocké en DB avant le fix
  // SafeJSONResponse (précision JS perdue sur snowflakes > 2^53 à l'insert).
  const guildListItem = guilds.find((g) => String(g.id) === String(selectedGuildId))
  const iconHash = guildListItem?.icon ?? guildDetail.icon ?? null
  const iconUrl = getGuildIconUrl(selectedGuildId, iconHash)
  const isBeta = guildDetail.attributes?.BETA === true
  const isBlacklisted = guildDetail.attributes?.BLACKLISTED === true
  const boostTier = guildDetail.premium_tier ?? 0
  const boostCount = guildDetail.premium_subscription_count ?? 0

  // attributes ne viennent pas de /discord → on les récupère via la map /guilds
  const attrs = guildAttributes.get(String(selectedGuildId)) ?? guildDetail.attributes
  const verifiedKind = resolveVerifiedKind(attrs, guildDetail.features)
  // Les serveurs officiels n'affichent aucune indication premium (ni Max, ni CTA).
  const hidePremium = verifiedKind === 'official'

  // Uniquement les modules disponibles — les modules en dev ne sont pas listés
  const allModules = [
    { id: 'starboard', icon: StarIcon },
    { id: 'welcome_channel', icon: MessageSquareIcon },
    { id: 'auto_role', icon: UsersIcon },
    { id: 'logging', icon: ScrollTextIcon },
    { id: 'adaptive_slowmode', icon: GaugeIcon },
    { id: 'social_notifications', icon: BellRingIcon },
  ]

  const boostTierLabel = boostTier > 0 ? `Level ${boostTier}` : null

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── En-tête serveur ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 min-w-0">
          <Avatar className="size-16 rounded-xl shadow-sm ring-1 ring-border after:rounded-xl shrink-0">
            <AvatarImage
              src={iconUrl ?? undefined}
              alt={guildDetail.name}
              referrerPolicy="no-referrer"
              className="rounded-xl"
              onError={() => console.warn('[avatar] GuildOverview failed to load', iconUrl)}
            />
            <AvatarFallback className="rounded-xl text-lg font-bold">
              {guildDetail.name?.slice(0, 2)?.toUpperCase() ?? '??'}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5 min-w-0">
            {/* Nom + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold leading-none">{guildDetail.name}</h1>
              {verifiedKind && <VerifiedBadge kind={verifiedKind} />}
              {isPremium && !hidePremium && (
                <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800 text-xs">
                  <CrownIcon className="size-3 mr-1" />
                  Moddy Max
                </Badge>
              )}
              {boostTierLabel && (
                <Badge variant="secondary" className="text-xs">
                  <ZapIcon className="size-3 mr-1 text-purple-500" />
                  {boostTierLabel}
                </Badge>
              )}
              {isBeta && <Badge variant="secondary" className="text-xs">Beta</Badge>}
              {isBlacklisted && (
                <Badge variant="destructive" className="text-xs">
                  <ShieldAlertIcon className="size-3 mr-1" />
                  {t('guildOverview.blacklisted')}
                </Badge>
              )}
            </div>
            {/* Infos secondaires */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground w-full overflow-hidden">
              {guildDetail.description && (
                <span className="truncate max-w-[min(100%,28rem)]">{guildDetail.description}</span>
              )}
              {guildDetail.vanity_url_code && (
                <a
                  href={`https://discord.gg/${guildDetail.vanity_url_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors min-w-0 max-w-full"
                >
                  <LinkIcon className="size-3 shrink-0" />
                  <span className="truncate">discord.gg/{guildDetail.vanity_url_code}</span>
                </a>
              )}
              {boostCount > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <ZapIcon className="size-3 text-purple-400" />
                  {boostCount} {boostCount > 1 ? 'boosts' : 'boost'}
                </span>
              )}
            </div>
          </div>
        </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('guildOverview.stats.members'), value: guildDetail.member_count?.toLocaleString() ?? '—', icon: UsersIcon, color: 'blue' as const },
          { label: t('guildOverview.stats.online'), value: guildDetail.presence_count?.toLocaleString() ?? '—', icon: RadioIcon, color: 'green' as const },
          { label: t('guildOverview.stats.cases'), value: stats ? `${stats.open_cases}/${stats.total_cases}` : '—', icon: ShieldAlertIcon, color: 'orange' as const },
          { label: t('guildOverview.stats.activeModules'), value: String(Object.keys(modules).length), icon: HashIcon, color: 'purple' as const },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="py-0">
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${STAT_STYLES[color].box}`}>
                <Icon className={`size-5 ${STAT_STYLES[color].icon}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── CTA Premium ─────────────────────────────────────────────────── */}
      {!isPremium && !hidePremium && (
        <Card className="py-0 border-violet-400/60 dark:border-violet-600/40 bg-violet-400/15 dark:bg-violet-900/25">
          <CardContent className="flex items-center justify-between gap-4 p-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-violet-400/30 dark:bg-violet-700/40 flex items-center justify-center shrink-0">
                <CrownIcon className="size-5 text-violet-600 dark:text-violet-300" />
              </div>
              <div>
                <p className="font-semibold text-sm text-violet-900 dark:text-violet-100">{t('guildOverview.premium.title')}</p>
                <p className="text-xs text-violet-700/80 dark:text-violet-300/70 mt-0.5">{t('guildOverview.premium.description')}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 shadow-sm"
              onClick={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SparklesIcon className="size-4" />
              )}
              {t('guildOverview.premium.cta')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Modules ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">{t('guildOverview.modules.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('guildOverview.modules.description')}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allModules.map(({ id, icon }) => (
            <ModuleCard
              key={id}
              moduleId={id}
              name={t(`modules.${id}.name`)}
              description={t(`modules.${id}.description`)}
              icon={icon}
              isEnabled={id in modules}
              guildId={selectedGuildId}
              onNavigate={navigate}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
