import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCwIcon, TrendingDownIcon, TrendingUpIcon, XCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Fenêtres proposées partout dans le panneau. Le backend accepte 1→400 jours. */
export const STATS_WINDOWS = [7, 30, 90] as const
export type StatsWindowDays = (typeof STATS_WINDOWS)[number]

export function StatsRangePicker({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (days: number) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={String(value)}
      // Radix renvoie "" quand on déselectionne : une fenêtre vide n'existe pas.
      onValueChange={(next) => next && onChange(Number(next))}
      disabled={disabled}
      aria-label={t("stats.range.label")}
    >
      {STATS_WINDOWS.map((days) => (
        <ToggleGroupItem key={days} value={String(days)} className="px-3">
          {t("stats.range.days", { count: days })}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/**
 * Tuile de chiffre-clé. `hint` sert aux mentions obligatoires : « approximatif »
 * pour une métrique HyperLogLog, « jour incomplet » pour la journée en cours.
 */
export function StatTile({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  icon: Icon,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  /** `null` = aucune valeur connue avant la fenêtre → « — », surtout pas « 0 ». */
  delta?: number | null
  deltaLabel?: string
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const hasDelta = delta !== undefined && delta !== null && delta !== 0
  const isUp = (delta ?? 0) > 0

  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="flex items-start gap-3 p-4">
        {Icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl leading-none font-semibold tabular-nums">{value}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {hasDelta && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                  isUp ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                )}
              >
                {isUp ? (
                  <TrendingUpIcon className="size-3.5" />
                ) : (
                  <TrendingDownIcon className="size-3.5" />
                )}
                {isUp ? "+" : ""}
                {delta?.toLocaleString()}
                {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
              </span>
            )}
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Mention « ~ » obligatoire sur une métrique approximative (HyperLogLog, ±0,8 %). */
export function ApproximateMark() {
  const { t } = useTranslation()
  return (
    <Tooltip>
      {/* `span` plutôt qu'un bouton : c'est une annotation, pas une action. */}
      <TooltipTrigger asChild>
        <span className="cursor-help text-muted-foreground">~</span>
      </TooltipTrigger>
      <TooltipContent>{t("stats.approximate")}</TooltipContent>
    </Tooltip>
  )
}

export function StatsSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

export function StatsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <XCircleIcon className="size-8 text-destructive" />
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon className="size-4" />
          {t("stats.retry")}
        </Button>
      )}
    </div>
  )
}
