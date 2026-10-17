import type { SVGProps } from 'react'
import { MegaphoneIcon, AlertOctagonIcon, WrenchIcon, InfoIcon, TriangleAlertIcon, CheckCircle2Icon, XIcon } from '@/components/icons'
import type { Banner, BannerType } from '@/services/banner'
import { cn } from '@/lib/utils'
import { parseInlineMarkdown } from '@/lib/inline-markdown'

// ─── Design system per type ───────────────────────────────────────────────────

interface TypeStyle {
  Icon: React.ComponentType<SVGProps<SVGSVGElement>>
  containerClass: string
  iconClass: string
  closeClass: string
}

const TYPE_STYLES: Record<BannerType, TypeStyle> = {
  announcement: {
    Icon: MegaphoneIcon,
    containerClass:
      'bg-primary/10 border-primary/20 text-primary',
    iconClass: 'text-primary',
    closeClass: 'hover:bg-primary/15',
  },
  incident: {
    Icon: AlertOctagonIcon,
    containerClass:
      'bg-destructive/10 border-destructive/20 text-destructive',
    iconClass: 'text-destructive',
    closeClass: 'hover:bg-destructive/15',
  },
  maintenance: {
    Icon: WrenchIcon,
    containerClass:
      'bg-warning/10 border-warning/20 text-warning',
    iconClass: 'text-warning',
    closeClass: 'hover:bg-warning/15',
  },
  information: {
    Icon: InfoIcon,
    containerClass:
      'bg-info/10 border-info/20 text-info',
    iconClass: 'text-info',
    closeClass: 'hover:bg-info/15',
  },
  warning: {
    Icon: TriangleAlertIcon,
    containerClass:
      'bg-warning/10 border-warning/20 text-warning',
    iconClass: 'text-warning',
    closeClass: 'hover:bg-warning/15',
  },
  resolved: {
    Icon: CheckCircle2Icon,
    containerClass:
      'bg-success/10 border-success/20 text-success',
    iconClass: 'text-success',
    closeClass: 'hover:bg-success/15',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InfoBannerProps {
  banner: Banner
  onDismiss: () => void
}

export function InfoBanner({ banner, onDismiss }: InfoBannerProps) {
  const nodes = parseInlineMarkdown(banner.message)

  if (banner.type !== null) {
    const { Icon, containerClass, iconClass, closeClass } = TYPE_STYLES[banner.type]
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

  // Custom icon_svg + color
  const accentColor = banner.color ?? '#6b7280'
  return (
    <div
      role="status"
      aria-live="polite"
      className="shrink-0 flex w-full items-center border-b px-6 py-3 text-sm"
      style={{
        backgroundColor: `${accentColor}18`,
        borderColor: `${accentColor}30`,
        color: accentColor,
      }}
    >
      <div className="flex flex-1 items-start justify-center gap-3">
        {banner.icon_svg ? (
          <span
            className="mt-0.5 size-4 shrink-0"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: banner.icon_svg }}
            style={{ color: accentColor }}
          />
        ) : null}
        <p className="leading-relaxed">{nodes}</p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Fermer"
        className="ml-4 shrink-0 rounded p-1 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${accentColor}20`)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}
