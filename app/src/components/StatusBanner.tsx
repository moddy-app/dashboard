import { AlertTriangle, Info, OctagonAlert, Wrench, type LucideIcon } from "lucide-react"

import { useStatusBanner } from "@/hooks/useStatusBanner"
import { renderInlineMarkdown } from "@/lib/inlineMarkdown"
import { cn } from "@/lib/utils"

interface LevelStyle {
  icon: LucideIcon
  className: string
}

const LEVEL_STYLES: Record<string, LevelStyle> = {
  major_outage: {
    icon: OctagonAlert,
    className:
      "bg-destructive/10 text-destructive border-destructive/20 dark:text-red-300",
  },
  partial_outage: {
    icon: AlertTriangle,
    className:
      "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  },
  degraded_performance: {
    icon: AlertTriangle,
    className:
      "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  },
  maintenance: {
    icon: Wrench,
    className: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
  },
}

/** Any non-operational level we don't explicitly recognize still gets shown, not hidden. */
const FALLBACK_STYLE: LevelStyle = {
  icon: Info,
  className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
}

/**
 * Live incident/maintenance banner from the Moddy status API. Renders
 * nothing when there's no active incident or maintenance (`message` is
 * null). Takes priority over any other banner — keep it first in the
 * layout, above the rest of the page.
 */
export function StatusBanner() {
  const banner = useStatusBanner()

  if (!banner?.message) return null

  const style = LEVEL_STYLES[banner.level] ?? FALLBACK_STYLE
  const Icon = style.icon

  return (
    <div
      role="status"
      className={cn(
        "flex w-full items-center justify-center gap-2 border-b px-4 py-2.5 text-center text-sm font-medium text-pretty",
        style.className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{renderInlineMarkdown(banner.message)}</span>
    </div>
  )
}

export default StatusBanner
