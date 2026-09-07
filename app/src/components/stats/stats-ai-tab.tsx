import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CoinsIcon, CpuIcon, HashIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatFraction, formatNumber, formatUsd, toChartRows } from "@/lib/stats"
import { getAiUsage } from "@/services/stats"
import { useStatsResource } from "@/hooks/useStatsResource"
import { SeriesChart } from "./series-chart"
import { StatTile, StatsError, StatsSkeleton } from "./stats-primitives"

/**
 * Consommation IA. Le coût est stocké en **micro-dollars** et le backend rend
 * les deux formes : on affiche `*_usd` tel quel plutôt que de refaire la
 * conversion, pour qu'elle ne dépende pas du front.
 */
export function StatsAiTab({ days }: { days: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  // Snowflake saisi à la main : gardé en chaîne, jamais converti en nombre.
  const [guildInput, setGuildInput] = useState("")
  const [guildFilter, setGuildFilter] = useState("")

  const { data, isLoading, error, reload } = useStatsResource(
    () => getAiUsage({ days, guild_id: guildFilter || undefined }),
    [days, guildFilter]
  )

  const rows = data
    ? toChartRows(
        data.daily_cost.map((point) => ({ day: point.day, value: point.cost_usd })),
        data.window?.partial_day ?? null
      )
    : []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{t("stats.ai.title")}</CardTitle>
            <CardDescription>{t("stats.ai.description")}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              value={guildInput}
              onChange={(e) => setGuildInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setGuildFilter(guildInput.trim())}
              placeholder={t("stats.ai.guildIdPlaceholder")}
              className="w-full font-mono sm:w-56"
              inputMode="numeric"
            />
            <Button variant="outline" onClick={() => setGuildFilter(guildInput.trim())}>
              {t("stats.ai.filter")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <StatsSkeleton rows={2} />
          ) : error ? (
            <StatsError message={error} onRetry={reload} />
          ) : data ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  icon={CoinsIcon}
                  label={t("stats.ai.cost")}
                  value={formatUsd(data.cost_usd, locale)}
                />
                <StatTile
                  icon={HashIcon}
                  label={t("stats.ai.tokens")}
                  value={formatNumber(data.tokens, locale)}
                />
                <StatTile
                  icon={CpuIcon}
                  label={t("stats.ai.calls")}
                  value={formatNumber(data.calls, locale)}
                />
                <StatTile
                  icon={TriangleAlertIcon}
                  label={t("stats.ai.failedCalls")}
                  value={formatNumber(data.failed_calls, locale)}
                  hint={t("stats.ai.failureRate", {
                    rate: formatFraction(data.failure_rate, locale, 2),
                  })}
                />
              </div>

              {rows.length > 0 && (
                <SeriesChart rows={rows} label={t("stats.ai.dailyCost")} unit="usd" kind="bar" />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data && data.by_model.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="px-6 py-4">
            <CardTitle className="text-base">{t("stats.ai.byModel.title")}</CardTitle>
            <CardDescription>{t("stats.ai.byModel.description")}</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stats.ai.byModel.columns.model")}</TableHead>
                  <TableHead className="text-right">{t("stats.ai.byModel.columns.cost")}</TableHead>
                  <TableHead className="text-right">
                    {t("stats.ai.byModel.columns.tokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("stats.ai.byModel.columns.calls")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_model.map((model) => (
                  <TableRow key={model.model}>
                    <TableCell className="font-mono text-xs">{model.model}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(model.cost_usd, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(model.tokens, locale)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(model.calls, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}
