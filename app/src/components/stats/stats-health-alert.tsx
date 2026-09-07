import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangleIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { logger } from "@/lib/logger"
import { getStatsHealth } from "@/services/stats"

/**
 * Bandeau de santé de la collecte.
 *
 * Il s'affiche **si et seulement si** `ok: false`, avec le contenu de `alerts`,
 * déjà rédigé en clair par le backend. Ça veut dire qu'une création de
 * partition a été ratée côté bot : les données restent lisibles mais ne seront
 * plus purgeables. Le reste de la réponse n'est que de la fraîcheur, informatif.
 *
 * Sur une base où le bot n'a jamais tourné, tout est vide plutôt qu'en erreur —
 * et une erreur de lecture ne rend rien : ce bandeau ne doit jamais devenir le
 * problème de la page.
 */
export function StatsHealthAlert() {
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    getStatsHealth()
      .then((health) => {
        if (cancelled || health.ok) return
        setAlerts(health.alerts ?? [])
      })
      .catch((e: unknown) => logger.warn("stats", "Health check unavailable", e))
    return () => {
      cancelled = true
    }
  }, [])

  if (alerts.length === 0) return null

  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>{t("stats.health.title")}</AlertTitle>
      <AlertDescription>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {alerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
