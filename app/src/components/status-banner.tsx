import type { SVGProps } from 'react'
import { AlertOctagonIcon, TriangleAlertIcon, WrenchIcon, ActivityIcon, XIcon } from '@/components/icons'
import type { StatusBanner as StatusBannerData, StatusLevel } from '@/services/status-banner'
import { cn } from '@/lib/utils'
import { parseInlineMarkdown } from '@/lib/inline-markdown'

interface LevelStyle {
  Icon: React.ComponentType<SVGProps<SVGSVGElement>>
  containerClass: string
  iconClass: string
  closeClass: string
}

const LEVEL_STYLES: Record<string, LevelStyle> = {
  degraded_performance: {
    Icon: TriangleAlertIcon,
    containerClass:
      'bg-warning/10 border-warning/20 text-warning',
    iconClass: 'text-warning',
    closeClass: 'hover:bg-warning/15',
  },
  partial_outage: {
    Icon: AlertOctagonIcon,
    containerClass:
      'bg-warning/10 border-warning/20 text-warning',
    iconClass: 'text-warning',
    closeClass: 'hover:bg-warning/15',
  },
  major_outage: {
    Icon: AlertOctagonIcon,
    containerClass:
      'bg-destructive/10 border-destructive/20 text-destructive',
    iconClass: 'text-destructive',
    closeClass: 'hover:bg-destructive/15',
  },
  maintenance: {
    Icon: WrenchIcon,
    containerClass:
      'bg-info/10 border-info/20 text-info',
    iconClass: 'text-info',
    closeClass: 'hover:bg-info/15',
  },
}

/** Un niveau non listé (nouvel état côté health.moddy.app) retombe ici — jamais d'erreur. */
const FALLBACK_STYLE: LevelStyle = {
  Icon: ActivityIcon,
  containerClass:
    'bg-muted/60 border-border text-foreground',
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
      className={cn('shrink-0 flex w-full items-center border-b px-6 py-3 text-sm', containerClass)}
    >
      <div className="flex flex-1 items-start justify-center gap-3">
        <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
        <p className="leading-relaxed">{nodes}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Fermer"
        className={cn('ml-4 shrink-0 rounded p-1 transition-colors', closeClass)}
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}
