import { useTranslation } from "react-i18next"
import {
  ActivityIcon,
  CircleAlertIcon,
  LogInIcon,
  LogOutIcon,
  ServerIcon,
  SparklesIcon,
  TerminalIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  formatDayLabel,
  formatDuration,
  formatFraction,
  formatNumber,
  formatUsd,
} from "@/lib/stats"
import { getStatsOverview } from "@/services/stats"
import { useStatsResource } from "@/hooks/useStatsResource"
import { StatTile, StatsError, StatsSkeleton } from "./stats-primitives"

/**
 * Vue d'ensemble : un seul appel remplit toute la page.
 *
 * Deux précautions imposées par le contrat :
 * - les jauges sont un **état**, jamais une somme : on affiche leur valeur du
 *   jour et leur variation sur la fenêtre, pas un cumul ;
 * - un `delta` à `null` veut dire « aucune valeur connue avant la fenêtre »
 *   et s'affiche « — », surtout pas « 0 ».
 */
export function StatsOverviewTab({ days }: { days: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { data, isLoading, error, reload } = useStatsResource(
    () => getStatsOverview(days),
    [days]
  )

  if (isLoading) return <StatsSkeleton rows={4} />
  if (error) return <StatsError message={error} onRetry={reload} />
  if (!data) return null

  const { window, gauges, guilds, usage, ai, modules } = data
  // Base jamais alimentée (le bot n'a pas encore tourné) : état vide propre,
  // pas un écran cassé — le backend rend des zéros plutôt qu'une erreur.
  const isEmpty =
    gauges.length === 0 &&
    modules.length === 0 &&
    guilds.joins === 0 &&
    guilds.leaves === 0 &&
    usage.commands === 0

  if (isEmpty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ActivityIcon />
          </EmptyMedia>
          <EmptyTitle>{t("stats.empty.title")}</EmptyTitle>
          <EmptyDescription>{t("stats.empty.description")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const moduleRows = [...modules]
    .sort((a, b) => b.guilds - a.guilds)
    .map((m) => ({
      module: m.module,
      guilds: m.guilds,
      label: t(`modules.${m.module}.name`, { defaultValue: m.module }),
    }))

  const moduleConfig = {
    guilds: { label: t("stats.overview.modulesAxis"), color: "var(--chart-2)" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {/* Jauges globales — un état, avec sa variation sur la fenêtre. */}
      {gauges.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {gauges.map((gauge) => (
            <StatTile
              key={gauge.metric}
              icon={ServerIcon}
              label={gauge.label}
              value={formatNumber(gauge.value, locale)}
              delta={gauge.delta}
              deltaLabel={t("stats.overview.overWindow", { days: window.days })}
              hint={
                // Une jauge peut dater d'hier : le rollup passe toutes les 6 h.
                gauge.day && gauge.day !== window.to
                  ? t("stats.overview.gaugeAsOf", { day: formatDayLabel(gauge.day, locale) })
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cycle de vie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stats.overview.lifecycle.title")}</CardTitle>
            <CardDescription>
              {t("stats.overview.window", {
                from: formatDayLabel(window.from, locale),
                to: formatDayLabel(window.to, locale),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                icon={LogInIcon}
                label={t("stats.overview.lifecycle.joins")}
                value={formatNumber(guilds.joins, locale)}
              />
              <StatTile
                icon={LogOutIcon}
                label={t("stats.overview.lifecycle.leaves")}
                value={formatNumber(guilds.leaves, locale)}
              />
              <StatTile
                icon={ActivityIcon}
                label={t("stats.overview.lifecycle.net")}
                value={formatNumber(guilds.net, locale)}
              />
            </div>
            <Separator />
            {/* Durées de vie : le backend les rend en **secondes**. */}
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t("stats.overview.churn.leftCount")}
                </dt>
                <dd className="tabular-nums">{formatNumber(guilds.churn.left_count, locale)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t("stats.overview.churn.avgLifetime")}
                </dt>
                <dd className="tabular-nums">
                  {formatDuration(guilds.churn.avg_lifetime_seconds, locale)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  {t("stats.overview.churn.medianLifetime")}
                </dt>
                <dd className="tabular-nums">
                  {formatDuration(guilds.churn.median_lifetime_seconds, locale)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Usage & coût */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stats.overview.usage.title")}</CardTitle>
            <CardDescription>{t("stats.overview.usage.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <StatTile
              icon={TerminalIcon}
              label={t("stats.overview.usage.commands")}
              value={formatNumber(usage.commands, locale)}
            />
            <StatTile
              icon={CircleAlertIcon}
              label={t("stats.overview.usage.errors")}
              value={formatNumber(usage.command_errors, locale)}
              hint={t("stats.overview.usage.errorRate", {
                rate: formatFraction(usage.error_rate, locale, 2),
              })}
            />
            <StatTile
              icon={SparklesIcon}
              label={t("stats.overview.usage.aiCost")}
              value={formatUsd(ai.cost_usd, locale)}
              className="sm:col-span-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Adoption des modules */}
      {moduleRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("stats.overview.modules.title")}</CardTitle>
            <CardDescription>{t("stats.overview.modules.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={moduleConfig}
              className="aspect-auto w-full"
              style={{ height: `${Math.max(moduleRows.length * 32 + 24, 160)}px` }}
            >
              <BarChart accessibilityLayer data={moduleRows} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tickMargin={8}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="guilds" fill="var(--color-guilds)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* La journée en cours est toujours incomplète — le dire une fois par écran. */}
      {window.partial_day && (
        <p className="text-xs text-muted-foreground">
          {t("stats.partialDayNotice", {
            day: formatDayLabel(window.partial_day, locale),
          })}
        </p>
      )}
    </div>
  )
}
