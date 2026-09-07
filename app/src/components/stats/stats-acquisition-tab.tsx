import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2Icon, ClockIcon, InfoIcon, LinkIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDateTime, formatNumber, formatPercentValue } from "@/lib/stats"
import { getAcquisition, getInstalls } from "@/services/stats"
import { useStatsResource } from "@/hooks/useStatsResource"
import { StatsError, StatsSkeleton } from "./stats-primitives"

const ALL_SOURCES = "__all__"

/**
 * Acquisition — « quel canal marche ».
 *
 * Trois chiffres, et il faut les trois : `clicks` (liens ouverts, best-effort),
 * `started` (autorisation Discord accordée) et `installed` (le bot a vraiment
 * rejoint). `conversion_pct` et `retention_pct` sont volontairement côte à côte,
 * c'est tout l'intérêt de l'écran — **mais ils ne portent pas sur la même
 * période** : le premier sur la fenêtre, le second sur toute l'histoire. Les
 * en-têtes le disent, sans quoi la comparaison serait fausse.
 *
 * Une source avec des clics et zéro installation reste affichée : c'est
 * précisément le signal qu'un lien est cassé.
 */
export function StatsAcquisitionTab({ days }: { days: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [source, setSource] = useState<string>(ALL_SOURCES)

  const acquisition = useStatsResource(() => getAcquisition(days), [days])
  const installs = useStatsResource(
    () => getInstalls({ days, limit: 50, source: source === ALL_SOURCES ? undefined : source }),
    [days, source]
  )

  if (acquisition.isLoading) return <StatsSkeleton rows={3} />
  if (acquisition.error) {
    return <StatsError message={acquisition.error} onRetry={acquisition.reload} />
  }
  if (!acquisition.data) return null

  const sources = acquisition.data.sources
  // `clicks` est un compteur Redis best-effort : `null` quand il est
  // indisponible. On le signale plutôt que de laisser croire à un zéro.
  const clicksUnavailable = sources.length > 0 && sources.every((s) => s.clicks === null)

  return (
    <div className="flex flex-col gap-6">
      {clicksUnavailable && (
        <Alert>
          <InfoIcon />
          <AlertTitle>{t("stats.acquisition.clicksUnavailable.title")}</AlertTitle>
          <AlertDescription>
            {t("stats.acquisition.clicksUnavailable.description")}
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="px-6 py-4">
          <CardTitle className="text-base">{t("stats.acquisition.title")}</CardTitle>
          <CardDescription>{t("stats.acquisition.description")}</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("stats.acquisition.columns.source")}</TableHead>
                <TableHead className="text-right">
                  <HeaderHint label={t("stats.acquisition.columns.clicks")} hint={t("stats.acquisition.hints.clicks")} />
                </TableHead>
                <TableHead className="text-right">
                  <HeaderHint label={t("stats.acquisition.columns.started")} hint={t("stats.acquisition.hints.started")} />
                </TableHead>
                <TableHead className="text-right">
                  <HeaderHint label={t("stats.acquisition.columns.installed")} hint={t("stats.acquisition.hints.installed")} />
                </TableHead>
                <TableHead className="text-right">
                  <HeaderHint
                    label={t("stats.acquisition.columns.conversion")}
                    hint={t("stats.acquisition.hints.conversion", { days })}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <HeaderHint
                    label={t("stats.acquisition.columns.retention")}
                    hint={t("stats.acquisition.hints.retention")}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {t("stats.empty.title")}
                  </TableCell>
                </TableRow>
              )}
              {sources.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <LinkIcon className="size-3.5 text-muted-foreground" />
                      {t(`stats.sources.${row.source}`, { defaultValue: row.source })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatNumber(row.clicks, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.started, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.installed, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercentValue(row.conversion_pct, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      {formatPercentValue(row.retention_pct, locale)}
                      <span className="text-xs text-muted-foreground">
                        {t("stats.acquisition.stillHere", {
                          still: formatNumber(row.still_here, locale),
                          acquired: formatNumber(row.acquired_all_time, locale),
                        })}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Détail d'une campagne : `source` est pauvre par construction (c'est une
          dimension), tout le contenu est dans les UTM. */}
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{t("stats.installs.title")}</CardTitle>
            <CardDescription>{t("stats.installs.description")}</CardDescription>
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_SOURCES}>{t("stats.installs.allSources")}</SelectItem>
                {sources.map((row) => (
                  <SelectItem key={row.source} value={row.source}>
                    {t(`stats.sources.${row.source}`, { defaultValue: row.source })}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>
        <div className="overflow-x-auto border-t">
          {installs.isLoading ? (
            <div className="p-6">
              <StatsSkeleton rows={2} />
            </div>
          ) : installs.error ? (
            <div className="p-6">
              <StatsError message={installs.error} onRetry={installs.reload} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stats.installs.columns.guild")}</TableHead>
                  <TableHead>{t("stats.installs.columns.source")}</TableHead>
                  <TableHead>{t("stats.installs.columns.utm")}</TableHead>
                  <TableHead>{t("stats.installs.columns.date")}</TableHead>
                  <TableHead className="text-right">
                    {t("stats.installs.columns.status")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(installs.data?.installs.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {t("stats.installs.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {installs.data?.installs.map((install) => (
                  <TableRow key={`${install.guild_id}-${install.first_seen_at}`}>
                    {/* Snowflake : affiché tel quel, jamais parsé en Number. */}
                    <TableCell className="font-mono text-xs">{install.guild_id}</TableCell>
                    <TableCell>
                      {t(`stats.sources.${install.source}`, { defaultValue: install.source })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(install.utm).length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          Object.entries(install.utm).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="font-normal">
                              {key.replace(/^utm_/, "")}: {value}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(install.first_seen_at, locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      {install.confirmed ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          {t("stats.installs.confirmed")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <ClockIcon className="size-3.5" />
                          {t("stats.installs.pending")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}

/** En-tête de colonne portant son explication : les trois chiffres ne se lisent pas pareil. */
function HeaderHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted underline-offset-4">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  )
}
