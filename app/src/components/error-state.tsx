import { AlertCircleIcon, WifiOffIcon, LockIcon, ServerCrashIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

type ErrorKind = "not_found" | "forbidden" | "network" | "server" | "generic"

function getKind(error: string | null): ErrorKind {
  if (!error) return "generic"
  const msg = error.toLowerCase()
  if (msg.includes("404") || msg.includes("not found")) return "not_found"
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("access denied")) return "forbidden"
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("cors")) return "network"
  if (msg.includes("500") || msg.includes("502") || msg.includes("server")) return "server"
  return "generic"
}

interface ErrorStateProps {
  error: string | null
  onRetry?: () => void
  className?: string
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const { t } = useTranslation()
  const kind = getKind(error)

  const config: Record<ErrorKind, { icon: typeof AlertCircleIcon; color: string; title: string; description: string }> = {
    not_found: {
      icon: AlertCircleIcon,
      color: "text-amber-500",
      title: t("errors.notFound.title"),
      description: t("errors.notFound.description"),
    },
    forbidden: {
      icon: LockIcon,
      color: "text-red-500",
      title: t("errors.forbidden.title"),
      description: t("errors.forbidden.description"),
    },
    network: {
      icon: WifiOffIcon,
      color: "text-blue-500",
      title: t("errors.network.title"),
      description: t("errors.network.description"),
    },
    server: {
      icon: ServerCrashIcon,
      color: "text-red-500",
      title: t("errors.server.title"),
      description: t("errors.server.description"),
    },
    generic: {
      icon: AlertCircleIcon,
      color: "text-muted-foreground",
      title: t("errors.generic.title"),
      description: error ?? t("errors.generic.description"),
    },
  }

  const { icon: Icon, color, title, description } = config[kind]

  return (
    <div className={`flex flex-col items-center justify-center gap-4 text-center py-12 ${className ?? ""}`}>
      <div className={`size-12 rounded-full bg-muted flex items-center justify-center`}>
        <Icon className={`size-6 ${color}`} />
      </div>
      <div className="max-w-sm">
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        {error && kind === "generic" && (
          <p className="text-xs text-muted-foreground/60 mt-2 font-mono bg-muted px-2 py-1 rounded break-all">
            {error}
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon className="size-4 mr-2" />
          {t("errors.retry")}
        </Button>
      )}
    </div>
  )
}
