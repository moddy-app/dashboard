import { AlertCircleIcon, WifiOffIcon, LockIcon, ServerCrashIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

type ErrorKind = "not_found" | "forbidden" | "network" | "server" | "api"

function getKind(error: string | null): ErrorKind {
  if (!error) return "api"
  const msg = error.toLowerCase()
  // Détection HTTP code ou mots-clés (EN + FR)
  if (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("introuvable") ||
    msg.includes("inexistant")
  ) return "not_found"
  if (
    msg.includes("403") ||
    msg.includes("forbidden") ||
    msg.includes("accès refusé") ||
    msg.includes("acces refuse") ||
    msg.includes("permission")
  ) return "forbidden"
  if (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("connexion") ||
    msg.includes("cors") ||
    msg.includes("offline")
  ) return "network"
  if (
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("server error") ||
    msg.includes("erreur serveur") ||
    msg.includes("non disponible")
  ) return "server"
  // Message API connu → affiché directement
  return "api"
}

interface ErrorStateProps {
  /** Message d'erreur brut (string depuis ApiError.message ou GuildContext.guildError) */
  error: string | null
  onRetry?: () => void
  /** Bouton supplémentaire — ex: "Rafraîchir mes serveurs" pour les 404 guild */
  onSecondaryAction?: () => void
  secondaryActionLabel?: string
}

/**
 * Affiche une erreur avec icône contextuelle.
 * - Pour les erreurs connues (404, 403, réseau, serveur) : icône + message amical
 * - Pour les messages API directement lisibles : juste l'icône + le message
 * Toujours utilisé DANS un wrapper centrant (voir ErrorPage).
 */
export function ErrorState({ error, onRetry, onSecondaryAction, secondaryActionLabel }: ErrorStateProps) {
  const { t } = useTranslation()
  const kind = getKind(error)

  type Config = { icon: typeof AlertCircleIcon; color: string; message: string }

  const config: Record<ErrorKind, Config> = {
    not_found: {
      icon: AlertCircleIcon,
      color: "text-amber-500",
      message: t("errors.notFound.description"),
    },
    forbidden: {
      icon: LockIcon,
      color: "text-red-500",
      message: t("errors.forbidden.description"),
    },
    network: {
      icon: WifiOffIcon,
      color: "text-blue-500",
      message: t("errors.network.description"),
    },
    server: {
      icon: ServerCrashIcon,
      color: "text-red-500",
      message: t("errors.server.description"),
    },
    // Message API lisible → on l'affiche tel quel
    api: {
      icon: AlertCircleIcon,
      color: "text-muted-foreground",
      message: error ?? t("errors.generic.description"),
    },
  }

  const { icon: Icon, color, message } = config[kind]

  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="size-11 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className={`size-5 ${color}`} />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCwIcon className="size-4 mr-1.5" />
            {t("errors.retry")}
          </Button>
        )}
        {onSecondaryAction && secondaryActionLabel && (
          <Button variant="default" size="sm" onClick={onSecondaryAction}>
            <RefreshCwIcon className="size-4 mr-1.5" />
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Wrapper centrant ErrorState — à utiliser dans les pages pour un état d'erreur pleine zone.
 */
export function ErrorPage({
  error,
  onRetry,
  onSecondaryAction,
  secondaryActionLabel,
}: {
  error: string | null
  onRetry?: () => void
  onSecondaryAction?: () => void
  secondaryActionLabel?: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[40vh] p-8">
      <ErrorState
        error={error}
        onRetry={onRetry}
        onSecondaryAction={onSecondaryAction}
        secondaryActionLabel={secondaryActionLabel}
      />
    </div>
  )
}
