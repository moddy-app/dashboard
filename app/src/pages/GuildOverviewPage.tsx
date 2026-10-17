import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import {
  CrownIcon,
  HashIcon,
  LinkIcon,
  LockIcon,
  RadioIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ErrorPage } from "@/components/error-state"
import { DebugErrorOverlay } from "@/components/debug-error-overlay"
import { VerifiedBadge } from "@/components/verified-badge"
import { resolveVerifiedKind } from "@/lib/verified"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { LEVEL_TONE } from "@/lib/sanctions"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGuildAttributes } from "@/hooks/useGuildAttributes"
import { getGuildIconUrl } from "@/lib/auth"
import { createCheckout } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"
import type { IconComponent } from "@/components/icons"
import { ModuleStatusBadge } from "@/components/module/module-status-badge"
import { MODULES, MODULE_GROUPS, getModuleStatus, type ModuleStatus } from "@/lib/modules"

// Classes statiques par ton (Tailwind ne peut pas générer de classes dynamiques).
const STAT_STYLES = {
  blue: { box: "bg-info/10", icon: "text-info" },
  green: { box: "bg-success/10", icon: "text-success" },
  orange: { box: "bg-warning/10", icon: "text-warning" },
  purple: { box: "bg-primary/10", icon: "text-primary" },
} as const

// ─── Carte module ─────────────────────────────────────────────────────────────

interface ModuleCardProps {
  to: string
  name: string
  description: string
  icon: IconComponent
  status: ModuleStatus
  /** Module jamais configuré alors qu'une sanction interdit d'en activer un. */
  isLocked: boolean
}

function ModuleCard({ to, name, description, icon: Icon, status, isLocked }: ModuleCardProps) {
  const { t } = useTranslation()
  return (
    <Item
      asChild
      variant="outline"
      className="h-full flex-nowrap items-start transition-colors hover:bg-accent/50"
    >
      <Link to={to}>
        <ItemMedia variant="icon">
          <Icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="w-full">
            <span className="truncate">{name}</span>
          </ItemTitle>
          <ItemDescription className="line-clamp-2">{description}</ItemDescription>
          <div className="mt-2">
            {isLocked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", LEVEL_TONE.limited.text, LEVEL_TONE.limited.border, LEVEL_TONE.limited.softBg)}
                  >
                    <LockIcon data-icon="inline-start" />
                    {t("violations.locked")}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  {t("violations.banner.newModuleBlockedDescription")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <ModuleStatusBadge status={status} />
            )}
          </div>
        </ItemContent>
      </Link>
    </Item>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function GuildOverviewPage() {
  const { t } = useTranslation()
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
  const gates = useSanctionGates(selectedGuildId)

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
        <Spinner className="size-6 text-muted-foreground" />
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

  const moduleStatuses = new Map(
    MODULES.map((m) => [m.id, getModuleStatus(m.id, modules[m.id])])
  )
  const runningModules = [...moduleStatuses.values()].filter(
    (st) => st === 'active' || st === 'simulation'
  ).length

  const boostTierLabel = boostTier > 0 ? t('guildOverview.stats.boostLevel', { level: boostTier }) : null

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
              {verifiedKind && <VerifiedBadge kind={verifiedKind} className="-ml-1" />}
              {isPremium && !hidePremium && (
                <Badge className="border-primary/30 bg-primary/10 text-xs text-primary">
                  <CrownIcon data-icon="inline-start" />
                  Moddy Max
                </Badge>
              )}
              {boostTierLabel && (
                <Badge variant="secondary" className="text-xs">
                  <ZapIcon className="size-3 mr-1 text-primary" />
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
                  <ZapIcon className="size-3 text-primary" />
                  {boostCount} {boostCount > 1 ? 'boosts' : 'boost'}
                </span>
              )}
            </div>
          </div>
        </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('guildOverview.stats.members'), value: guildDetail.member_count?.toLocaleString() ?? '—', icon: UsersIcon, color: 'blue' as const },
          { label: t('guildOverview.stats.online'), value: guildDetail.presence_count?.toLocaleString() ?? '—', icon: RadioIcon, color: 'green' as const },
          { label: t('guildOverview.stats.cases'), value: stats ? String(stats.open_cases) : '—', icon: ShieldAlertIcon, color: 'orange' as const },
          { label: t('guildOverview.stats.activeModules'), value: String(runningModules), icon: HashIcon, color: 'purple' as const },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="py-0">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", STAT_STYLES[color].box)}>
                <Icon className={cn("size-5", STAT_STYLES[color].icon)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Modules, par catégorie ──────────────────────────────────────── */}
      <div className="flex flex-col gap-8">
        {MODULE_GROUPS.map((group) => {
          const list = MODULES.filter((m) => m.group === group)
          if (list.length === 0) return null
          const running = list.filter((m) => {
            const st = moduleStatuses.get(m.id)
            return st === "active" || st === "simulation"
          }).length
          return (
            <section key={group} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{t(`modules.groups.${group}`)}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("guildOverview.modules.running", { count: running, total: list.length })}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <ModuleCard
                    key={m.id}
                    to={m.path(selectedGuildId)}
                    name={t(m.titleKey)}
                    description={t(m.descriptionKey)}
                    icon={m.icon}
                    status={moduleStatuses.get(m.id) ?? "not_configured"}
                    isLocked={!gates.canEnableNewModule && !modules[m.id]}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── CTA Premium, discret, en bas ────────────────────────────────── */}
      {/* Sous sanction globale, la ligne disparaît entièrement : proposer un
          abonnement que le back-end refusera ensuite est une fausse promesse.
          Le bandeau de sanction, lui, dit déjà ce qui est fermé et pourquoi. */}
      {!isPremium && !hidePremium && gates.canLinkGuild && (
        <Item variant="muted">
          <ItemMedia variant="icon">
            <CrownIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{t("guildOverview.premium.title")}</ItemTitle>
            <ItemDescription>{t("guildOverview.premium.description")}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="outline" onClick={handleUpgrade} disabled={isUpgrading}>
              {isUpgrading ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {t("guildOverview.premium.cta")}
            </Button>
          </ItemActions>
        </Item>
      )}
    </div>
  )
}
