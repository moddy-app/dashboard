import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MoreHorizIcon, PauseIcon, PlayIcon, RotateLeftIcon } from "@/components/icons"
import { useGuildContext } from "@/contexts/GuildContext"
import { handleSaveError } from "@/lib/handle-error"
import { getModuleDefinition, getModuleStatus, readModuleState } from "@/lib/modules"
import type { ModuleState } from "@/types/api"

interface ModuleStateControlProps {
  moduleId: string
  /**
   * Réinitialisation propre au module (service dédié : logs, tickets, altguard,
   * bot_customization…). Par défaut : `disableModule` du contexte.
   */
  onReset?: () => Promise<void> | void
}

/**
 * Pause / reprise / simulation + menu « … » (réinitialiser). Masqué tant que le
 * module n'a jamais été configuré : il n'y a encore rien à arrêter ni à effacer.
 */
export function ModuleStateControl({ moduleId, onReset }: ModuleStateControlProps) {
  const { t } = useTranslation()
  const { modules, setModuleState, disableModule } = useGuildContext()
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const def = getModuleDefinition(moduleId)
  const config = modules[moduleId]
  if (!def || getModuleStatus(moduleId, config) === "not_configured") return null

  const state = readModuleState((config as { state?: unknown } | undefined)?.state)

  const change = async (next: ModuleState) => {
    if (next === state || busy) return
    setBusy(true)
    try {
      await setModuleState(moduleId, next)
      toast.success(t(`modules.stateControl.done.${next}`))
    } catch (e) {
      handleSaveError(e, { title: t("modules.stateControl.error") })
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setBusy(true)
    try {
      if (onReset) await onReset()
      else await disableModule(moduleId)
      toast.success(t("modules.stateControl.resetDone"))
      setConfirmOpen(false)
    } catch (e) {
      handleSaveError(e, { title: t("modules.stateControl.resetError") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {def.supportsSimulation ? (
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={state}
          disabled={busy}
          onValueChange={(v) => v && change(v as ModuleState)}
          aria-label={t("modules.stateControl.label")}
        >
          <ToggleGroupItem value="active">{t("modules.status.active")}</ToggleGroupItem>
          <ToggleGroupItem value="simulation">{t("modules.status.simulation")}</ToggleGroupItem>
          <ToggleGroupItem value="paused">{t("modules.status.paused")}</ToggleGroupItem>
        </ToggleGroup>
      ) : (
        def.supportsPause && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => change(state === "paused" ? "active" : "paused")}
          >
            {busy ? (
              <Spinner data-icon="inline-start" />
            ) : state === "paused" ? (
              <PlayIcon data-icon="inline-start" />
            ) : (
              <PauseIcon data-icon="inline-start" />
            )}
            {state === "paused" ? t("modules.stateControl.resume") : t("modules.stateControl.pause")}
          </Button>
        )
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={t("modules.stateControl.more")}>
            <MoreHorizIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <RotateLeftIcon />
              {t("modules.stateControl.reset")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.stateControl.resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("modules.stateControl.resetDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void reset()
              }}
            >
              {busy && <Spinner data-icon="inline-start" />}
              {t("modules.stateControl.reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
