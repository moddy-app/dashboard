import { useEffect } from "react"
import { useRouteError, isRouteErrorResponse } from "react-router-dom"
import { useTranslation } from "react-i18next"
import * as Sentry from "@sentry/react"
import { AlertTriangleIcon, RefreshCwIcon, HomeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Extrait un message + une stack lisibles quelle que soit la forme de l'erreur. */
function describe(error: unknown): { title: string; detail: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      detail: typeof error.data === "string" ? error.data : JSON.stringify(error.data, null, 2),
    }
  }
  if (error instanceof Error) {
    return { title: error.message, detail: error.stack ?? error.message }
  }
  return { title: "Unknown error", detail: String(error) }
}

/**
 * ErrorBoundary de route (data router `errorElement`).
 * UI soignée + détail technique repliable, et remontée à Sentry.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  const { title, detail } = describe(error)

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangleIcon className="size-6 text-destructive" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">{t("errors.boundary.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("errors.boundary.description")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCwIcon className="size-4" />
            {t("errors.boundary.reload")}
          </Button>
          <Button variant="outline" asChild>
            <a href="/">
              <HomeIcon className="size-4" />
              {t("errors.boundary.home")}
            </a>
          </Button>
        </div>

        <details className="w-full text-left">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("errors.boundary.details")}
          </summary>
          <div className="mt-2 overflow-hidden rounded-xl border bg-muted/40">
            <p className="border-b bg-muted/60 px-3 py-2 font-mono text-xs wrap-break-word text-foreground">
              {title}
            </p>
            <pre className="max-h-64 overflow-auto px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {detail}
            </pre>
          </div>
        </details>
      </div>
    </div>
  )
}
