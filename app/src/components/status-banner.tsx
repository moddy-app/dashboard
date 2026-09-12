import { AlertOctagon, TriangleAlert, Wrench, ActivityIcon, X, type LucideProps } from 'lucide-react'
import type { StatusBanner as StatusBannerData, StatusLevel } from '@/services/status-banner'
import { parseInlineMarkdown } from '@/lib/inline-markdown'

interface LevelStyle {
  Icon: React.ComponentType<LucideProps>
  containerClass: string
  iconClass: string
  closeClass: string
}

const LEVEL_STYLES: Record<string, LevelStyle> = {
  degraded_performance: {
    Icon: TriangleAlert,
    containerClass:
      'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
    iconClass: 'text-amber-600 dark:text-amber-400',
    closeClass: 'hover:bg-amber-500/15 dark:hover:bg-amber-500/25',
  },
  partial_outage: {
    Icon: AlertOctagon,
    containerClass:
      'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400',
    iconClass: 'text-orange-600 dark:text-orange-400',
    closeClass: 'hover:bg-orange-500/15 dark:hover:bg-orange-500/25',
  },
  major_outage: {
    Icon: AlertOctagon,
    containerClass:
      'bg-destructive/10 border-destructive/20 text-destructive dark:bg-destructive/15 dark:border-destructive/30',
    iconClass: 'text-destructive',
    closeClass: 'hover:bg-destructive/15 dark:hover:bg-destructive/25',
  },
  maintenance: {
    Icon: Wrench,
    containerClass:
      'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400',
    iconClass: 'text-sky-600 dark:text-sky-400',
    closeClass: 'hover:bg-sky-500/15 dark:hover:bg-sky-500/25',
  },
}

/** Un niveau non listé (nouvel état côté health.moddy.app) retombe ici — jamais d'erreur. */
const FALLBACK_STYLE: LevelStyle = {
  Icon: ActivityIcon,
  containerClass:
    'bg-muted/60 border-border text-foreground dark:bg-muted/40',
  iconClass: 'text-muted-foreground',
  closeClass: 'hover:bg-muted',
}

function styleForLevel(level: StatusLevel): LevelStyle {
  return LEVEL_STYLES[level] ?? FALLBACK_STYLE
}

interface StatusBannerProps {
  banner: StatusBannerData
  onDismiss: () => void
}

/**
 * Bandeau d'incident/maintenance du status page (`health.moddy.app`), à ne
 * pas confondre avec `InfoBanner` (annonces admin sur `/banners/active`) :
 * deux sources indépendantes, qui peuvent s'empiler. `message` est du
 * markdown déjà rédigé par le backend (gras + lien `[View status](url)`
 * inclus) — on ne fait que le rendre, jamais de logique de libellé ici.
 */
export function StatusBanner({ banner, onDismiss }: StatusBannerProps) {
  const { Icon, containerClass, iconClass, closeClass } = styleForLevel(banner.level)
  const nodes = parseInlineMarkdown(banner.message ?? '')

  return (
    <div
      role="status"
      aria-live="polite"
      className={`shrink-0 flex w-full items-center border-b px-6 py-3 text-sm ${containerClass}`}
    >
      <div className="flex flex-1 items-start justify-center gap-3">
        <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden />
        <p className="leading-relaxed">{nodes}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Fermer"
        className={`ml-4 shrink-0 rounded p-1 transition-colors ${closeClass}`}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
