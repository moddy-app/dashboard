import { useTranslation } from "react-i18next"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { formatCompact, formatDayLabel, formatMetricValue, type ChartRow } from "@/lib/stats"

interface SeriesChartProps {
  rows: ChartRow[]
  /** Libellé de la métrique, affiché dans l'infobulle. */
  label: string
  /** Unité du catalogue — décide du format des valeurs (`micro_usd` → dollars). */
  unit: string
  kind?: "line" | "area" | "bar"
  color?: string
  className?: string
}

/**
 * Courbe (ou histogramme) d'une métrique journalière.
 *
 * Deux règles de lecture sont portées ici plutôt que par les écrans :
 *
 * - **La journée en cours est incomplète.** Elle est tracée en pointillé (ou en
 *   barre atténuée), à partir des séries séparées par `toChartRows()`.
 * - **`null` est un trou, pas un zéro.** `connectNulls={false}` laisse le trou
 *   visible : une jauge éparse sans valeur connue ne doit pas plonger à zéro,
 *   un serveur n'a jamais zéro membre et la courbe se lirait comme un incident.
 *
 * Les deux séries visibles portent `tooltipType="none"` : l'infobulle est servie
 * par une série transparente posée sur la valeur brute, sinon la journée en
 * cours afficherait une ligne vide (son trait plein vaut `null`).
 */
export function SeriesChart({
  rows,
  label,
  unit,
  kind = "line",
  color = "var(--chart-2)",
  className,
}: SeriesChartProps) {
  const { i18n, t } = useTranslation()
  const locale = i18n.language

  const config = {
    value: { label, color },
  } satisfies ChartConfig

  const axis = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="day"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={24}
        tickFormatter={(day: string) => formatDayLabel(day, locale)}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={48}
        tickMargin={4}
        tickFormatter={(value: number) =>
          unit === "micro_usd"
            ? formatMetricValue(value, unit, locale)
            : formatCompact(value, locale)
        }
      />
      <ChartTooltip
        // Un histogramme mérite son survol de colonne ; une courbe, non.
        cursor={kind === "bar"}
        content={
          <ChartTooltipContent
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as ChartRow | undefined
              if (!row) return ""
              const day = formatDayLabel(row.day, locale)
              return row.isPartial ? `${day} · ${t("stats.chart.partialDay")}` : day
            }}
            formatter={(value) => (
              <div className="flex flex-1 items-center justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {formatMetricValue(typeof value === "number" ? value : null, unit, locale)}
                </span>
              </div>
            )}
          />
        }
      />
    </>
  )

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-56 w-full", className)}>
      {kind === "bar" ? (
        <BarChart accessibilityLayer data={rows}>
          {axis}
          {/* Une seule série : deux barres côte à côte se partageraient la
              largeur de la journée. La journée en cours est atténuée via sa
              cellule plutôt que par une série séparée. */}
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.day} fillOpacity={row.isPartial ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      ) : kind === "area" ? (
        <AreaChart accessibilityLayer data={rows}>
          {axis}
          <Area
            dataKey="value"
            stroke="transparent"
            fill="transparent"
            dot={false}
            activeDot={{ r: 4, fill: "var(--color-value)", stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Area
            dataKey="solid"
            stroke="var(--color-value)"
            fill="var(--color-value)"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
            tooltipType="none"
          />
          <Area
            dataKey="partialBridge"
            stroke="var(--color-value)"
            strokeDasharray="4 4"
            fill="var(--color-value)"
            fillOpacity={0.06}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
            tooltipType="none"
          />
        </AreaChart>
      ) : (
        <LineChart accessibilityLayer data={rows}>
          {axis}
          <Line
            dataKey="value"
            stroke="transparent"
            dot={false}
            activeDot={{ r: 4, fill: "var(--color-value)", stroke: "var(--background)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="solid"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            connectNulls={false}
            tooltipType="none"
          />
          <Line
            dataKey="partialBridge"
            stroke="var(--color-value)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            activeDot={false}
            connectNulls={false}
            tooltipType="none"
          />
        </LineChart>
      )}
    </ChartContainer>
  )
}
