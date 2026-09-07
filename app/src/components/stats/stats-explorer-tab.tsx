import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  formatDayLabel,
  formatFraction,
  formatMetricValue,
  lastKnownValue,
  metricsForScope,
  seriesTotal,
  toChartRows,
} from "@/lib/stats"
import { getStatsBreakdown, getStatsSeries, getTopGuilds } from "@/services/stats"
import { useStatsResource } from "@/hooks/useStatsResource"
import type { MetricDescriptor, MetricScope, StatsCatalog } from "@/types/stats"
import { SeriesChart } from "./series-chart"
import { ApproximateMark, StatsError, StatsSkeleton } from "./stats-primitives"

const NO_DIMENSION = "__none__"

/**
 * Explorateur de métriques — **entièrement piloté par le catalogue**.
 *
 * Rien n'est codé en dur : la liste des métriques, les filtres proposés
 * (`dims`), la présence d'un sélecteur de serveur (`scopes`), le format des
 * valeurs (`unit`), la mention « approximatif » et surtout le droit d'afficher
 * un total (`additive`) en viennent tous. Une métrique hors catalogue est un
 * `422` côté backend : le catalogue est son allowlist, pas de la documentation.
 */
export function StatsExplorerTab({ catalog, days }: { catalog: StatsCatalog; days: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const metrics = catalog.metrics
  const [metricName, setMetricName] = useState(() => metrics[0]?.metric ?? "")
  const [scope, setScope] = useState<MetricScope>("global")
  const [scopeId, setScopeId] = useState("")
  const [dimension, setDimension] = useState(NO_DIMENSION)

  const metric: MetricDescriptor | undefined = useMemo(
    () => metrics.find((m) => m.metric === metricName),
    [metrics, metricName]
  )

  // Une métrique sans portée `guild` ne propose pas de sélecteur de serveur.
  const supportsGuild = metric?.scopes.includes("guild") ?? false
  const effectiveScope: MetricScope = supportsGuild && scope === "guild" ? "guild" : "global"
  // `scope_id` est obligatoire en portée guild : sans lui la requête est un 422.
  const isReady = Boolean(metric) && (effectiveScope === "global" || scopeId.trim().length > 0)

  const series = useStatsResource(
    () =>
      getStatsSeries({
        metric: metricName,
        days,
        scope: effectiveScope,
        scope_id: effectiveScope === "guild" ? scopeId.trim() : undefined,
      }),
    [metricName, days, effectiveScope, scopeId],
    { enabled: isReady }
  )

  const hasDimension = dimension !== NO_DIMENSION && (metric?.dims.includes(dimension) ?? false)
  const breakdown = useStatsResource(
    () =>
      getStatsBreakdown({
        metric: metricName,
        by: dimension,
        days,
        scope: effectiveScope,
        scope_id: effectiveScope === "guild" ? scopeId.trim() : undefined,
        limit: 20,
      }),
    [metricName, dimension, days, effectiveScope, scopeId],
    { enabled: isReady && hasDimension }
  )

  // Le classement n'a de sens que pour un compteur de portée serveur.
  const canRankGuilds = supportsGuild && metric?.type === "counter"
  const topGuilds = useStatsResource(
    () => getTopGuilds({ metric: metricName, days, limit: 10 }),
    [metricName, days],
    { enabled: canRankGuilds }
  )

  const handleMetricChange = (next: string) => {
    setMetricName(next)
    // Les `dims` sont propres à chaque métrique : un `by` conservé d'une
    // métrique à l'autre serait refusé en 422.
    setDimension(NO_DIMENSION)
    const target = metrics.find((m) => m.metric === next)
    if (!target?.scopes.includes("guild")) setScope("global")
  }

  const grouped = useMemo(
    () => ({
      counter: metricsForScope(metrics, "global").filter((m) => m.type === "counter"),
      gauge: metrics.filter((m) => m.type === "gauge"),
      unique: metrics.filter((m) => m.type === "unique"),
      guildOnly: metrics.filter((m) => !m.scopes.includes("global")),
    }),
    [metrics]
  )

  const total = series.data ? seriesTotal(series.data) : null
  const current = series.data ? lastKnownValue(series.data.points) : null
  const rows = series.data ? toChartRows(series.data.points, series.data.partial_day) : []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("stats.explorer.title")}</CardTitle>
          <CardDescription>{t("stats.explorer.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="stats-metric">{t("stats.explorer.metric")}</FieldLabel>
              <Select value={metricName} onValueChange={handleMetricChange}>
                <SelectTrigger id="stats-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      ["counter", grouped.counter],
                      ["gauge", grouped.gauge],
                      ["unique", grouped.unique],
                      ["guildOnly", grouped.guildOnly],
                    ] as const
                  ).map(([key, items]) =>
                    items.length === 0 ? null : (
                      <SelectGroup key={key}>
                        <SelectLabel>{t(`stats.explorer.groups.${key}`)}</SelectLabel>
                        {items.map((m) => (
                          <SelectItem key={m.metric} value={m.metric}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  )}
                </SelectContent>
              </Select>
              {metric?.notes && <FieldDescription>{metric.notes}</FieldDescription>}
            </Field>

            {supportsGuild && (
              <Field>
                <FieldLabel htmlFor="stats-scope">{t("stats.explorer.scope")}</FieldLabel>
                <Select value={effectiveScope} onValueChange={(v) => setScope(v as MetricScope)}>
                  <SelectTrigger id="stats-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {metric?.scopes.includes("global") && (
                        <SelectItem value="global">{t("stats.explorer.scopeGlobal")}</SelectItem>
                      )}
                      <SelectItem value="guild">{t("stats.explorer.scopeGuild")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {effectiveScope === "guild" && (
              <Field>
                <FieldLabel htmlFor="stats-scope-id">{t("stats.explorer.guildId")}</FieldLabel>
                {/* Snowflake : saisi et transmis en chaîne, jamais parsé. */}
                <Input
                  id="stats-scope-id"
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  placeholder={t("stats.explorer.guildIdPlaceholder")}
                  className="font-mono"
                  inputMode="numeric"
                />
              </Field>
            )}

            {(metric?.dims.length ?? 0) > 0 && (
              <Field>
                <FieldLabel htmlFor="stats-dimension">{t("stats.explorer.breakdownBy")}</FieldLabel>
                <Select value={dimension} onValueChange={setDimension}>
                  <SelectTrigger id="stats-dimension">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_DIMENSION}>{t("stats.explorer.noBreakdown")}</SelectItem>
                      {metric?.dims.map((dim) => (
                        <SelectItem key={dim} value={dim}>
                          {t(`stats.dimensions.${dim}`, { defaultValue: dim })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Courbe */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{metric?.label ?? metricName}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t(`stats.types.${metric?.type ?? "counter"}`)}</Badge>
              {metric?.approximate && (
                <Badge variant="outline" className="gap-1">
                  <ApproximateMark />
                  {t("stats.approximateBadge")}
                </Badge>
              )}
              {metric?.sparse && <Badge variant="outline">{t("stats.sparseBadge")}</Badge>}
            </CardDescription>
          </div>
          <div className="text-right">
            {/* Un total ne s'affiche que si la métrique est additive : sommer une
                jauge sur 30 jours donnerait 30 × le nombre de serveurs. */}
            {total !== null ? (
              <>
                <p className="text-2xl leading-none font-semibold tabular-nums">
                  {formatMetricValue(total, series.data?.unit ?? "count", locale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("stats.explorer.totalOverWindow", { days })}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl leading-none font-semibold tabular-nums">
                  {metric?.approximate && <ApproximateMark />}
                  {formatMetricValue(current, series.data?.unit ?? "count", locale)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("stats.explorer.currentState")}
                </p>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!isReady ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("stats.explorer.needGuildId")}
            </p>
          ) : series.isLoading ? (
            <StatsSkeleton rows={1} className="h-56" />
          ) : series.error ? (
            <StatsError message={series.error} onRetry={series.reload} />
          ) : series.data ? (
            <>
              <SeriesChart
                rows={rows}
                label={series.data.label}
                unit={series.data.unit}
                kind={series.data.type === "counter" ? "bar" : "area"}
              />
              {series.data.partial_day && (
                <p className="text-xs text-muted-foreground">
                  {t("stats.partialDayNotice", {
                    day: formatDayLabel(series.data.partial_day, locale),
                  })}
                </p>
              )}
              {metric?.sparse && (
                <p className="text-xs text-muted-foreground">{t("stats.sparseNotice")}</p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Répartition par dimension */}
      {hasDimension && (
        <Card className="gap-0 py-0">
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-base">
              {t("stats.breakdown.title", {
                dimension: t(`stats.dimensions.${dimension}`, { defaultValue: dimension }),
              })}
            </CardTitle>
            <CardDescription>{t("stats.breakdown.description")}</CardDescription>
          </CardHeader>
          <div className="border-t">
            {breakdown.isLoading ? (
              <div className="p-6">
                <StatsSkeleton rows={2} />
              </div>
            ) : breakdown.error ? (
              <div className="p-6">
                <StatsError message={breakdown.error} onRetry={breakdown.reload} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("stats.breakdown.columns.key")}</TableHead>
                      <TableHead className="text-right">
                        {t("stats.breakdown.columns.value")}
                      </TableHead>
                      <TableHead className="w-56">{t("stats.breakdown.columns.share")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(breakdown.data?.items.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                          {t("stats.empty.title")}
                        </TableCell>
                      </TableRow>
                    )}
                    {breakdown.data?.items.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">
                          {/* `unknown` = les lignes qui n'ont pas cette dimension. */}
                          {item.key === "unknown" ? (
                            <span className="text-muted-foreground">
                              {t("stats.breakdown.unknown")}
                            </span>
                          ) : (
                            item.key
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMetricValue(item.value, breakdown.data?.unit ?? "count", locale)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {/* `share` est une fraction 0→1, pas un pourcentage. */}
                            <Progress value={item.share * 100} className="h-2" />
                            <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                              {formatFraction(item.share, locale)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Classement de serveurs */}
      {canRankGuilds && (
        <Card className="gap-0 py-0">
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-base">{t("stats.topGuilds.title")}</CardTitle>
            <CardDescription>{t("stats.topGuilds.description")}</CardDescription>
          </CardHeader>
          <div className="border-t">
            {topGuilds.isLoading ? (
              <div className="p-6">
                <StatsSkeleton rows={2} />
              </div>
            ) : topGuilds.error ? (
              <div className="p-6">
                <StatsError message={topGuilds.error} onRetry={topGuilds.reload} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t("stats.topGuilds.columns.guild")}</TableHead>
                      <TableHead className="text-right">
                        {t("stats.topGuilds.columns.value")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(topGuilds.data?.items.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                          {t("stats.empty.title")}
                        </TableCell>
                      </TableRow>
                    )}
                    {topGuilds.data?.items.map((item, index) => (
                      <TableRow key={item.guild_id}>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {index + 1}
                        </TableCell>
                        {/* Seuls des ids sont renvoyés — gardés en chaîne. */}
                        <TableCell className="font-mono text-xs">{item.guild_id}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMetricValue(
                            item.value_usd ?? item.value,
                            item.value_usd !== undefined ? "usd" : topGuilds.data?.unit ?? "count",
                            locale
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
      )}
    </div>
  )
}
