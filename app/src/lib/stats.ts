import type {
  MetricDescriptor,
  SeriesPoint,
  StatsSeries,
} from '@/types/stats'

/**
 * Helpers de lecture des statistiques. Ils portent les quatre règles du guide
 * d'intégration, pour qu'aucun écran n'ait à s'en souvenir :
 *
 * 1. **Ne jamais sommer une jauge** → `canShowTotal()`.
 * 2. **La journée en cours est incomplète** → `toChartRows()` la sépare pour
 *    qu'elle se dessine en pointillé.
 * 3. **Une valeur `null` est un trou, pas un zéro** → jamais convertie en `0`.
 * 4. **Les valeurs de dimension sont des chaînes** → `normalizeDims()`.
 */

// ─── Règles de lecture ────────────────────────────────────────────────────────

/**
 * Un total sur la période n'a de sens que pour une métrique additive. Sommer
 * une jauge (« serveurs ») sur 30 jours donnerait 30 × le nombre de serveurs.
 */
export function canShowTotal(additive: boolean): boolean {
  return additive
}

/** Somme d'une série additive, en ignorant les trous. */
export function sumSeries(points: SeriesPoint[]): number {
  return points.reduce((acc, p) => acc + (p.value ?? 0), 0)
}

/** Dernière valeur connue d'une série (une jauge se lit par son état, pas son total). */
export function lastKnownValue(points: SeriesPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].value !== null && points[i].value !== undefined) return points[i].value
  }
  return null
}

/**
 * Les valeurs de dimension partent **toutes** en chaînes, booléens compris :
 * `{"ok": "true"}`. Le backend refuse `{"ok": true}` en 422 parce qu'il ne
 * matcherait jamais rien. Les entrées vides sont retirées (pas de filtre).
 */
export function normalizeDims(dims: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(dims)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = String(value)
  }
  return out
}

// ─── Préparation des courbes ──────────────────────────────────────────────────

export interface ChartRow {
  day: string
  /** Valeur brute de tous les jours — porte le tooltip. `null` = trou. */
  value: number | null
  /** Jours clos : le trait plein de la courbe, les barres pleines. */
  solid: number | null
  /** Journée en cours **seule** — pour des barres (une barre n'a pas besoin de pont). */
  partial: number | null
  /**
   * Journée en cours **plus le dernier jour clos** — pour une courbe : sans ce
   * point d'ancrage, le segment pointillé serait détaché du trait plein.
   */
  partialBridge: number | null
  /** Point reconstruit sur une jauge éparse : pas de marqueur, pas de « mis à jour ». */
  filled: boolean
  /** Ce point est la journée en cours, donc incomplet. */
  isPartial: boolean
}

/**
 * Découpe une série pour que la journée en cours — **toujours** incomplète — se
 * distingue du reste de la courbe (pointillé, ou barre atténuée).
 *
 * Sans ça, chaque matin le dashboard donnerait l'impression d'un effondrement :
 * les compteurs ne sont vidés que toutes les 60 s et les jauges recalculées
 * toutes les 6 h, le dernier point est donc systématiquement sous-évalué.
 */
export function toChartRows(points: SeriesPoint[], partialDay: string | null): ChartRow[] {
  const partialIndex = partialDay ? points.findIndex((p) => p.day === partialDay) : -1
  return points.map((point, index) => {
    const isPartial = partialIndex >= 0 && index >= partialIndex
    const isAnchor = partialIndex > 0 && index === partialIndex - 1
    const value = point.value ?? null
    return {
      day: point.day,
      value,
      solid: isPartial ? null : value,
      partial: isPartial ? value : null,
      partialBridge: isPartial || isAnchor ? value : null,
      filled: point.filled === true,
      isPartial,
    }
  })
}

/** Une jauge éparse peut n'avoir aucune valeur connue en début de courbe. */
export function hasAnyValue(points: SeriesPoint[]): boolean {
  return points.some((p) => p.value !== null && p.value !== undefined)
}

// ─── Unités et formats ────────────────────────────────────────────────────────

/** `ai.cost` est stocké en micro-dollars. Le backend rend les deux formes. */
export function microUsdToUsd(microUsd: number): number {
  return microUsd / 1_000_000
}

export function formatNumber(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString(locale)
}

/** Format court pour les axes : `12,4 k`, `1,2 M`. */
export function formatCompact(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatUsd(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    // Sous le cent, arrondir à zéro masquerait une consommation réelle.
    maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
  }).format(value)
}

/** `share` et `error_rate` sont des fractions 0→1, jamais des pourcentages. */
export function formatFraction(value: number | null | undefined, locale: string, digits = 1): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(value)
}

/** `conversion_pct` / `retention_pct` arrivent **déjà** en pourcentage. */
export function formatPercentValue(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} %`
}

/** Formate une valeur selon l'unité déclarée par le catalogue. */
export function formatMetricValue(
  value: number | null | undefined,
  unit: string,
  locale: string
): string {
  if (value === null || value === undefined) return '—'
  if (unit === 'micro_usd') return formatUsd(microUsdToUsd(value), locale)
  if (unit === 'usd') return formatUsd(value, locale)
  if (unit === 'ratio') return formatFraction(value, locale)
  if (unit === 'seconds') return formatDuration(value, locale)
  return formatNumber(value, locale)
}

/** Les durées de `churn` et de `guild_events` sont en **secondes**. */
export function formatDuration(seconds: number | null | undefined, locale: string): string {
  if (seconds === null || seconds === undefined) return '—'
  const abs = Math.abs(seconds)
  const rtf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (abs < 60) return `${rtf.format(seconds)} s`
  if (abs < 3600) return `${rtf.format(seconds / 60)} min`
  if (abs < 86400) return `${rtf.format(seconds / 3600)} h`
  if (abs < 2_592_000) return `${rtf.format(seconds / 86400)} j`
  return `${rtf.format(seconds / 2_592_000)} mois`
}

/** `YYYY-MM-DD` → `9 sept.` — parsé en UTC, jamais regroupé après conversion. */
export function formatDayLabel(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

/** `YYYY-MM-DD` → `août 2026`, pour les cohortes mensuelles. */
export function formatMonthLabel(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

export function findMetric(
  metrics: MetricDescriptor[],
  metric: string
): MetricDescriptor | undefined {
  return metrics.find((m) => m.metric === metric)
}

/** Métriques utilisables dans une portée donnée (pas de sélecteur de serveur sinon). */
export function metricsForScope(
  metrics: MetricDescriptor[],
  scope: 'global' | 'guild'
): MetricDescriptor[] {
  return metrics.filter((m) => m.scopes.includes(scope))
}

/**
 * Total affichable d'une série : `null` quand la métrique n'est pas additive —
 * l'écran doit alors montrer l'état courant, jamais une somme.
 */
export function seriesTotal(series: StatsSeries): number | null {
  if (!series.additive) return null
  return sumSeries(series.points)
}
