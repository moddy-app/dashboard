import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { LoaderIcon, SaveIcon, UndoIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logger } from "@/lib/logger"

interface UnsavedBarProps {
  isDirty: boolean
  isSaving?: boolean
  onSave: () => Promise<void> | void
  onDiscard: () => void
}

function shakePageRoot() {
  const root = document.getElementById("root")
  if (!root) return
  root.classList.remove("page-shake")
  void root.offsetWidth
  root.classList.add("page-shake")
  root.addEventListener("animationend", () => root.classList.remove("page-shake"), { once: true })
}

function highlightBar(el: HTMLElement) {
  el.classList.remove("bar-highlight")
  void el.offsetWidth
  el.classList.add("bar-highlight")
}

export function UnsavedBar({ isDirty, isSaving = false, onSave, onDiscard }: UnsavedBarProps) {
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const blocker = useBlocker(isDirty && !isSaving)

  // Browser-level guard for tab close / page refresh
  useEffect(() => {
    if (!isDirty || isSaving) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
      return ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty, isSaving])

  // Shake la page + highlight la barre à chaque navigation bloquée
  useEffect(() => {
    if (blocker.state !== "blocked") return
    logger.warn("unsaved-bar", "Navigation blocked — shaking page")

    shakePageRoot()

    if (barRef.current) {
      highlightBar(barRef.current)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => {
        barRef.current?.classList.remove("bar-highlight")
      }, 1400)
    }
  }, [blocker.state, blocker.location])

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
    }
  }, [])

  const handleSave = async () => {
    logger.event("unsaved-bar", "Save clicked")
    if (blocker.state === "blocked") blocker.reset()
    await onSave()
  }

  const handleDiscard = () => {
    logger.event("unsaved-bar", "Discard clicked")
    // Reset blocker FIRST to cancel the pending navigation, then discard changes.
    // If we discard first, isDirty becomes false and React Router may auto-proceed.
    if (blocker.state === "blocked") blocker.reset()
    onDiscard()
  }

  const isVisible = isDirty || blocker.state === "blocked"

  if (!isVisible) return null

  const bar = (
    <div
      ref={barRef}
      className="fixed bottom-5 left-1/2 z-[9999] flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl border border-border bg-card shadow-xl shadow-black/10 backdrop-blur-sm w-[calc(100vw-2rem)] max-w-[560px] transition-colors duration-300 [&.bar-highlight]:border-primary/60 dark:[&.bar-highlight]:border-primary/50"
      style={{
        transform: "translateX(-50%)",
        animation: "unsavedbar-slide-up 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      <style>{`
        @keyframes unsavedbar-slide-up {
          from { transform: translateX(-50%) translateY(16px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>

      <TriangleAlertIcon className="size-4 text-amber-500 shrink-0" />
      <p className="text-sm font-medium flex-1 min-w-0 truncate">
        {t("unsavedBar.message")}
      </p>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          disabled={isSaving}
          className="h-8 px-3 text-muted-foreground hover:text-foreground gap-1.5 whitespace-nowrap"
        >
          <UndoIcon className="size-3.5" />
          <span className="hidden sm:inline">{t("unsavedBar.discard")}</span>
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 px-3 gap-1.5 whitespace-nowrap"
        >
          {isSaving ? (
            <LoaderIcon className="size-3.5 animate-spin" />
          ) : (
            <SaveIcon className="size-3.5" />
          )}
          {t("unsavedBar.save")}
        </Button>
      </div>
    </div>
  )

  return createPortal(bar, document.body)
}
