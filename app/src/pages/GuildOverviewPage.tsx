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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ErrorState } from "@/components/error-state"
import { DebugErrorOverlay } from "@/components/debug-error-overlay"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useGuildContext } from "@/contexts/GuildContext"
import { getGuildIconUrl } from "@/lib/auth"
import { createCheckout } from "@/services/guilds"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"

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
  moduleId,
  name,
  description,
  icon: Icon,
  isEnabled,
  isAvailable,
  guildId,
  onNavigate,
}: ModuleCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      className={`transition-colors ${isAvailable ? "cursor-pointer hover:bg-accent/50" : "opacity-60"}`}
      onClick={() => isAvailable && onNavigate(`/servers/${guildId}/modules/${moduleId}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-medium">{name}</CardTitle>
          </div>
          <div className="shrink-0">
            {isEnabled ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 dark:text-green-400">
                <CheckCircleIcon className="size-3 mr-1" />
                {t('guildOverview.modules.enabled')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <XCircleIcon className="size-3 mr-1" />
                {t('guildOverview.modules.disabled')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
        {isAvailable && (
          <div className="flex items-center gap-1 mt-2 text-xs text-primary">
            <ExternalLinkIcon className="size-3" />
            <span>{t('guildOverview.modules.configure')}</span>
          </div>
        )}
        {!isAvailable && (
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t('guildOverview.modules.comingSoon')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

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
    selectedGuildId,
  } = useGuildContext()

  const handleUpgrade = async () => {
    if (!guildDetail) return
    try {
      const url = await createCheckout(guildDetail.guild_id, 'monthly')
      window.location.href = url
    } catch {
      toast.error(t('guildOverview.premium.checkoutError'))
    }
  }

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
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
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <ErrorState error={guildError} onRetry={refreshGuildData} />
        <DebugErrorOverlay error={guildError} context="guild/load" />
      </div>
    )
  }

  if (!guildDetail || !selectedGuildId) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const iconUrl = getGuildIconUrl(guildDetail.guild_id, guildDetail.icon)
  const isPremium = guildDetail.attributes?.PREMIUM === true || stats?.is_premium === true
  const isBeta = guildDetail.attributes?.BETA === true
  const isBlacklisted = guildDetail.attributes?.BLACKLISTED === true

  const allModules = [
    {
      id: 'starboard',
      icon: StarIcon,
      available: true,
    },
    {
      id: 'welcome_channel',
      icon: MessageSquareIcon,
      available: true,
    },
    {
      id: 'auto_role',
      icon: UsersIcon,
      available: true,
    },
    {
      id: 'logging',
      icon: ScrollTextIcon,
      available: true,
    },
    {
      id: 'auto_restore_roles',
      icon: ShieldIcon,
      available: false,
    },
    {
      id: 'interserver',
      icon: GlobeIcon,
      available: false,
    },
    {
      id: 'youtube_notifications',
      icon: BellIcon,
      available: false,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête du serveur */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 rounded-lg">
            <AvatarImage src={iconUrl ?? undefined} alt={guildDetail.name} />
            <AvatarFallback className="rounded-lg text-lg font-bold">
              {guildDetail.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold">{guildDetail.name}</h1>
              {isPremium && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  <CrownIcon className="size-3 mr-1" />
                  Premium
                </Badge>
              )}
              {isBeta && (
                <Badge variant="secondary">Beta</Badge>
              )}
              {isBlacklisted && (
                <Badge variant="destructive">
                  <ShieldAlertIcon className="size-3 mr-1" />
                  {t('guildOverview.blacklisted')}
                </Badge>
              )}
            </div>
            {guildDetail.description && (
              <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                {guildDetail.description}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshGuildData}>
          <RefreshCwIcon className="size-4 mr-2" />
          {t('guildOverview.refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <UsersIcon className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {guildDetail.member_count?.toLocaleString() ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t('guildOverview.stats.members')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <ShieldAlertIcon className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats?.total_cases ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">{t('guildOverview.stats.totalCases')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-9 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <SparklesIcon className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.keys(modules).length}
              </p>
              <p className="text-xs text-muted-foreground">{t('guildOverview.stats.activeModules')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium CTA si non premium */}
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
              <SparklesIcon className="size-4 mr-2" />
              {t('guildOverview.premium.cta')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Modules */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold">{t('guildOverview.modules.title')}</h2>
          <p className="text-sm text-muted-foreground">
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
