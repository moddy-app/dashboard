import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LoaderIcon, RotateCcwIcon, SearchIcon, SparklesIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { getAutomodBudget, setAutomodBudget } from "@/services/automod"
import type { AutomodBudget } from "@/types/api"

/** "20260806" → "2026-08-06" */
function formatDay(day: string): string {
  return /^\d{8}$/.test(day) ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : day
}

/**
 * Plafond quotidien d'appels IA de l'automod, en « unités » (un appel `mini`
 * en coûte 4). Réservé au staff : un admin de serveur ne relève pas son propre
 * plafond, ce panneau n'apparaît donc jamais dans le dashboard serveur.
 */
export function AutomodBudgetPanel() {
  const { t } = useTranslation()

  // Snowflake saisi à la main : gardé en chaîne, jamais converti en nombre.
  const [guildId, setGuildId] = useState("")
  const [budget, setBudget] = useState<AutomodBudget | null>(null)
  const [capInput, setCapInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const load = async (id: string) => {
    const target = id.trim()
    if (!target) return
    logger.event("staff:automod_budget", "Load", { guildId: target })
    setIsLoading(true)
    try {
      const result = await getAutomodBudget(target)
      setBudget(result)
      setCapInput(String(result.cap))
    } catch (e) {
      logger.error("staff:automod_budget", "Load failed", e)
      setBudget(null)
      handleSaveError(e, { title: t("staff.automodBudget.loadError") })
    } finally {
      setIsLoading(false)
    }
  }

  const save = async (cap: number | null) => {
    if (!budget) return
    logger.event("staff:automod_budget", "Save cap", { guildId: budget.guild_id, cap })
    setIsSaving(true)
    try {
      const result = await setAutomodBudget(budget.guild_id, cap)
      setBudget(result)
      setCapInput(String(result.cap))
      toast.success(t("staff.automodBudget.saved"))
    } catch (e) {
      logger.error("staff:automod_budget", "Save failed", e)
      handleSaveError(e, { title: t("staff.automodBudget.saveError") })
    } finally {
      setIsSaving(false)
    }
  }

  const parsedCap = Number.parseInt(capInput, 10)
  const canSave =
    Number.isFinite(parsedCap) && parsedCap >= 0 && budget !== null && parsedCap !== budget.cap

  const usageRatio = budget && budget.cap > 0 ? Math.min(budget.used_today / budget.cap, 1) : 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SparklesIcon className="size-4 text-violet-500" />
            {t("staff.automodBudget.title")}
          </CardTitle>
          <CardDescription>{t("staff.automodBudget.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(guildId)}
              placeholder={t("staff.automodBudget.guildIdPlaceholder")}
              className="flex-1 font-mono"
              inputMode="numeric"
            />
            <Button onClick={() => load(guildId)} disabled={isLoading || !guildId.trim()}>
              {isLoading ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SearchIcon className="size-4" />
              )}
              {t("staff.automodBudget.load")}
            </Button>
          </div>

          {budget && (
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{budget.guild_id}</span>
                  {budget.cap_overridden ? (
                    <Badge variant="secondary">{t("staff.automodBudget.overridden")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("staff.automodBudget.usingDefault")}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {t("staff.automodBudget.day", { day: formatDay(budget.day) })}
                </span>
              </div>

              {/* Consommation du jour */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("staff.automodBudget.usedToday")}</span>
                  <span className="tabular-nums font-medium">
                    {budget.used_today} / {budget.cap}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      usageRatio >= 1 ? "bg-destructive" : usageRatio > 0.8 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${usageRatio * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("staff.automodBudget.degradeHint", { default: budget.default_cap })}
                </p>
              </div>

              {/* Modification du plafond */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="number"
                  min={0}
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  className="w-full sm:w-40 tabular-nums"
                />
                <div className="flex gap-2">
                  <Button onClick={() => save(parsedCap)} disabled={!canSave || isSaving}>
                    {isSaving && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                    {t("staff.automodBudget.save")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => save(null)}
                    disabled={isSaving || !budget.cap_overridden}
                  >
                    <RotateCcwIcon className="size-4 mr-2" />
                    {t("staff.automodBudget.restoreDefault")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
