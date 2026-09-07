import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatDateTime,
  formatDayLabel,
  formatDuration,
  formatFraction,
  formatMonthLabel,
  formatNumber,
} from "@/lib/stats"
import { getGuildsEvents, getGuildsLifecycle, getGuildsRetention } from "@/services/stats"
import { useStatsResource } from "@/hooks/useStatsResource"
import { StatTile, StatsError, StatsSkeleton } from "./stats-primitives"

const ALL_EVENTS = "__all__"

/**
 * Cycle de vie des serveurs : ajouts / départs / solde net, rétention par
 * cohorte mensuelle, et le journal brut qui sert de détail derrière les courbes.
 *
 * `cumulative_net` est **déjà calculé** par le backend : on le trace tel quel
 * plutôt que de recomposer un cumul qui divergerait de la fenêtre demandée.
 * L'état courant d'un serveur est son **dernier** événement — un serveur peut
 * partir puis revenir, la cohorte ne « perd » donc pas définitivement.
 */
export function StatsLifecycleTab({ days }: { days: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [eventFilter, setEventFilter] = useState<string>(ALL_EVENTS)

  const lifecycle = useStatsResource(() => getGuildsLifecycle(days), [days])
  const retention = useStatsResource(() => getGuildsRetention(), [])
  const events = useStatsResource(
    () =>
      getGuildsEvents({
        limit: 50,
        event: eventFilter === ALL_EVENTS ? undefined : (eventFilter as "join" | "leave"),
      }),
    [eventFilter]
  )

  const flowConfig = {
    joins: { label: t("stats.lifecycle.joins"), color: "var(--chart-2)" },
    leaves: { label: t("stats.lifecycle.leaves"), color: "var(--chart-5)" },
  } satisfies ChartConfig

  const netConfig = {
    cumulative_net: { label: t("stats.lifecycle.cumulativeNet"), color: "var(--chart-3)" },
  } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-6">
      {lifecycle.isLoading ? (
        <StatsSkeleton rows={2} />
      ) : lifecycle.error ? (
        <StatsError message={lifecycle.error} onRetry={lifecycle.reload} />
      ) : (
        lifecycle.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label={t("stats.lifecycle.joins")}
                value={formatNumber(lifecycle.data.totals.joins, locale)}
              />
              <StatTile
                label={t("stats.lifecycle.leaves")}
                value={formatNumber(lifecycle.data.totals.leaves, locale)}
              />
              <StatTile
                label={t("stats.lifecycle.net")}
                value={formatNumber(lifecycle.data.totals.net, locale)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("stats.lifecycle.flow.title")}</CardTitle>
                <CardDescription>{t("stats.lifecycle.flow.description")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <ChartContainer config={flowConfig} className="aspect-auto h-56 w-full">
                  <BarChart accessibilityLayer data={lifecycle.data.points}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(day: string) => formatDayLabel(day, locale)}
                    />
                    <YAxis tickLine={false} axisLine={false} width={40} tickMargin={4} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(day) => formatDayLabel(String(day), locale)}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="joins" fill="var(--color-joins)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leaves" fill="var(--color-leaves)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>

                <ChartContainer config={netConfig} className="aspect-auto h-44 w-full">
                  <LineChart accessibilityLayer data={lifecycle.data.points}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(day: string) => formatDayLabel(day, locale)}
                    />
                    <YAxis tickLine={false} axisLine={false} width={48} tickMargin={4} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(day) => formatDayLabel(String(day), locale)}
                        />
                      }
                    />
                    <Line
                      dataKey="cumulative_net"
                      stroke="var(--color-cumulative_net)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>

                {lifecycle.data.partial_day && (
                  <p className="text-xs text-muted-foreground">
                    {t("stats.partialDayNotice", {
                      day: formatDayLabel(lifecycle.data.partial_day, locale),
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}

      {/* Rétention par cohorte mensuelle d'acquisition. */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-6 py-4">
          <CardTitle className="text-base">{t("stats.retention.title")}</CardTitle>
          <CardDescription>{t("stats.retention.description")}</CardDescription>
        </CardHeader>
        <div className="border-t">
          {retention.isLoading ? (
            <div className="p-6">
              <StatsSkeleton rows={2} />
            </div>
          ) : retention.error ? (
            <div className="p-6">
              <StatsError message={retention.error} onRetry={retention.reload} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stats.retention.columns.cohort")}</TableHead>
                    <TableHead className="text-right">
                      {t("stats.retention.columns.acquired")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("stats.retention.columns.retained")}
                    </TableHead>
                    <TableHead className="w-56">{t("stats.retention.columns.rate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(retention.data?.cohorts.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                        {t("stats.empty.title")}
                      </TableCell>
                    </TableRow>
                  )}
                  {retention.data?.cohorts.map((cohort) => (
                    <TableRow key={cohort.cohort}>
                      <TableCell className="font-medium">
                        {formatMonthLabel(cohort.cohort, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(cohort.acquired, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(cohort.retained, locale)}
                      </TableCell>
                      <TableCell>
                        {/* `rate` est une fraction (0→1), `null` si la cohorte est vide. */}
                        {cohort.rate === null ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Progress value={cohort.rate * 100} className="h-2" />
                            <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                              {formatFraction(cohort.rate, locale)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>

      {/* Journal brut — le détail derrière les courbes. Durées en secondes. */}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{t("stats.events.title")}</CardTitle>
            <CardDescription>{t("stats.events.description")}</CardDescription>
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_EVENTS}>{t("stats.events.all")}</SelectItem>
                <SelectItem value="join">{t("stats.events.join")}</SelectItem>
                <SelectItem value="leave">{t("stats.events.leave")}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>
        <div className="border-t">
          {events.isLoading ? (
            <div className="p-6">
              <StatsSkeleton rows={2} />
            </div>
          ) : events.error ? (
            <div className="p-6">
              <StatsError message={events.error} onRetry={events.reload} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("stats.events.columns.event")}</TableHead>
                    <TableHead>{t("stats.events.columns.guild")}</TableHead>
                    <TableHead className="text-right">
                      {t("stats.events.columns.members")}
                    </TableHead>
                    <TableHead>{t("stats.events.columns.lifetime")}</TableHead>
                    <TableHead>{t("stats.events.columns.source")}</TableHead>
                    <TableHead>{t("stats.events.columns.date")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(events.data?.events.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {t("stats.events.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {events.data?.events.map((event) => (
                    <TableRow key={String(event.id)}>
                      <TableCell>
                        <Badge variant={event.event === "join" ? "secondary" : "outline"}>
                          {t(`stats.events.${event.event}`, { defaultValue: event.event })}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{event.guild_id}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(event.member_count, locale)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(event.lifetime_seconds, locale)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {event.source
                          ? t(`stats.sources.${event.source}`, { defaultValue: event.source })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(event.created_at, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
