import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import type { ModuleStatus } from "@/lib/modules"
import { cn } from "@/lib/utils"

const DOT_CLASS: Record<ModuleStatus, string> = {
  active: "bg-success",
  paused: "bg-muted-foreground",
  simulation: "bg-warning",
  incomplete: "bg-warning",
  not_configured: "bg-muted-foreground/40",
}

/** Libellé traduit d'un statut de module. */
function useModuleStatusLabel(): (status: ModuleStatus) => string {
  const { t } = useTranslation()
  return (status) => t(`modules.status.${status}`)
}

/** Petit point de statut, discret (sidebar). Le libellé est dans `aria-label`. */
export function ModuleStatusDot({
  status,
  className,
}: {
  status: ModuleStatus
  className?: string
}) {
  const label = useModuleStatusLabel()(status)
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("size-2 shrink-0 rounded-full", DOT_CLASS[status], className)}
    />
  )
}

/** Pastille de statut : Badge stock + point coloré. */
export function ModuleStatusBadge({
  status,
  className,
}: {
  status: ModuleStatus
  className?: string
}) {
  const label = useModuleStatusLabel()(status)
  return (
    <Badge variant="outline" className={cn("shrink-0", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT_CLASS[status])} />
      {label}
    </Badge>
  )
}
