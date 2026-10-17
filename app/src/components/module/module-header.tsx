import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ModuleStatusBadge } from "@/components/module/module-status-badge"
import { useGuildContext } from "@/contexts/GuildContext"
import { getModuleDefinition, getModuleStatus } from "@/lib/modules"

interface ModuleHeaderProps {
  moduleId: string
  /** Actions à droite du titre (sous le titre sur mobile). */
  actions?: ReactNode
}

export function ModuleHeader({ moduleId, actions }: ModuleHeaderProps) {
  const { t } = useTranslation()
  const { modules } = useGuildContext()
  const def = getModuleDefinition(moduleId)
  if (!def) return null
  const Icon = def.icon
  const status = getModuleStatus(moduleId, modules[moduleId])

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold leading-tight">{t(def.titleKey)}</h1>
            <ModuleStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">{t(def.descriptionKey)}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
