import { useState } from 'react'
import {
  Megaphone,
  AlertOctagon,
  Wrench,
  Info,
  TriangleAlert,
  CheckCircle2,
  X,
  type LucideProps,
} from 'lucide-react'
import type { Banner, BannerType } from '@/services/banner'

// ─── Markdown ─────────────────────────────────────────────────────────────────

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      nodes.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {linkMatch[1]}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      nodes.push(<strong key={key++}>{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      nodes.push(<em key={key++}>{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const nextSpecial = remaining.search(/\[|\*/)
    if (nextSpecial === -1) {
      nodes.push(remaining)
      remaining = ''
    } else if (nextSpecial === 0) {
      nodes.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      nodes.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return nodes
}

// ─── Design system per type ───────────────────────────────────────────────────

interface TypeStyle {
  Icon: React.ComponentType<LucideProps>
  containerClass: string
  iconClass: string
  closeClass: string
}

const TYPE_STYLES: Record<BannerType, TypeStyle> = {
  announcement: {
    Icon: Megaphone,
    containerClass:
      'bg-primary/10 border-primary/20 text-primary dark:bg-primary/15 dark:border-primary/30',
    iconClass: 'text-primary',
    closeClass: 'hover:bg-primary/15 dark:hover:bg-primary/25',
  },
  incident: {
    Icon: AlertOctagon,
    containerClass:
      'bg-destructive/10 border-destructive/20 text-destructive dark:bg-destructive/15 dark:border-destructive/30',
    iconClass: 'text-destructive',
    closeClass: 'hover:bg-destructive/15 dark:hover:bg-destructive/25',
  },
  maintenance: {
    Icon: Wrench,
    containerClass:
      'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
    iconClass: 'text-amber-600 dark:text-amber-400',
    closeClass: 'hover:bg-amber-500/15 dark:hover:bg-amber-500/25',
  },
  information: {
    Icon: Info,
    containerClass:
      'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:bg-sky-500/15 dark:border-sky-500/30 dark:text-sky-400',
    iconClass: 'text-sky-600 dark:text-sky-400',
    closeClass: 'hover:bg-sky-500/15 dark:hover:bg-sky-500/25',
  },
  warning: {
    Icon: TriangleAlert,
    containerClass:
      'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400',
    iconClass: 'text-orange-600 dark:text-orange-400',
    closeClass: 'hover:bg-orange-500/15 dark:hover:bg-orange-500/25',
  },
  resolved: {
    Icon: CheckCircle2,
    containerClass:
      'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    closeClass: 'hover:bg-emerald-500/15 dark:hover:bg-emerald-500/25',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InfoBannerProps {
  banner: Banner
}

export function InfoBanner({ banner }: InfoBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const nodes = parseInlineMarkdown(banner.message)

  if (banner.type !== null) {
    const { Icon, containerClass, iconClass, closeClass } = TYPE_STYLES[banner.type]
    return (
      <div
        role="status"
        aria-live="polite"
        className={`sticky top-0 z-[100] flex w-full items-center border-b px-6 py-3 text-sm ${containerClass}`}
      >
        <div className="flex flex-1 items-start justify-center gap-3">
          <Icon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} aria-hidden />
          <p className="leading-relaxed">{nodes}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Fermer"
          className={`ml-4 shrink-0 rounded p-1 transition-colors ${closeClass}`}
        >
          <X className="size-4" aria-hidden />
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
      className="sticky top-0 z-[100] flex w-full items-center border-b px-6 py-3 text-sm"
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
        onClick={() => setDismissed(true)}
        aria-label="Fermer"
        className="ml-4 shrink-0 rounded p-1 transition-colors"
        style={{ ['--hover-bg' as string]: `${accentColor}20` }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${accentColor}20`)}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
