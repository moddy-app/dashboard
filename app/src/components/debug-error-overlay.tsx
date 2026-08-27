import { useDebugMode } from "@/hooks/useDebugMode"
import { AlertCircleIcon, BugIcon, XIcon } from "lucide-react"
import { useState } from "react"

interface DebugErrorOverlayProps {
  error: unknown
  context?: string
}

/**
 * Affiche les détails complets d'une erreur — uniquement en mode ?debug=true.
 */
export function DebugErrorOverlay({ error, context }: DebugErrorOverlayProps) {
  const isDebug = useDebugMode()
  const [dismissed, setDismissed] = useState(false)

  if (!isDebug || !error || dismissed) return null

  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const status = (error as { status?: number }).status

  return (
    <div className="fixed bottom-20 right-4 z-[9999] max-w-sm w-full bg-destructive/10 border border-destructive/30 rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-start gap-2 p-3 bg-destructive/20">
        <BugIcon className="size-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-destructive">
            DEBUG {status ? `— HTTP ${status}` : "— Error"}
            {context && <span className="opacity-70"> [{context}]</span>}
          </p>
          <p className="text-xs text-destructive/80 break-all">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-destructive/60 hover:text-destructive"
        >
          <XIcon className="size-3" />
        </button>
      </div>
      {stack && (
        <pre className="text-[10px] text-destructive/60 p-3 overflow-auto max-h-48 bg-destructive/5 leading-relaxed">
          {stack}
        </pre>
      )}
    </div>
  )
}

/**
 * Badge discret affiché en bas à droite quand ?debug=true est actif.
 */
export function DebugModeBadge() {
  const isDebug = useDebugMode()
  if (!isDebug) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9998] flex items-center gap-1.5 bg-amber-500/90 text-white text-xs font-mono px-2 py-1 rounded-full shadow pointer-events-none">
      <BugIcon className="size-3" />
      DEBUG MODE
    </div>
  )
}

/**
 * Affiche une icône d'erreur inline avec détails en debug.
 */
export function InlineError({ error, label }: { error: unknown; label?: string }) {
  const isDebug = useDebugMode()
  if (!error) return null

  const message = error instanceof Error ? error.message : String(error)
  const status = (error as { status?: number }).status

  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-medium">{label ?? "Erreur"}</p>
        {isDebug && (
          <p className="text-xs opacity-70 break-all font-mono mt-0.5">
            {status ? `[HTTP ${status}] ` : ""}{message}
          </p>
        )}
      </div>
    </div>
  )
}
