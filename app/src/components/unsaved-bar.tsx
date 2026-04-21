import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { LoaderIcon, SaveIcon, UndoIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"

interface UnsavedBarProps {
  isDirty: boolean
  isSaving?: boolean
  onSave: () => Promise<void> | void
  onDiscard: () => void
}

export function UnsavedBar({ isDirty, isSaving = false, onSave, onDiscard }: UnsavedBarProps) {
  const { t } = useTranslation()
  // A counter that increments on every blocked-navigation attempt. We key the
  // shake animation on this counter so the animation replays every time the
  // user tries to leave — not just the first time the blocker triggers.
  const [shakeKey, setShakeKey] = useState(0)
  const [highlight, setHighlight] = useState(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const blocker = useBlocker(isDirty && !isSaving)

  // Browser-level guard for tab close / page refresh
  useEffect(() => {
    if (!isDirty || isSaving) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy Chrome/Firefox: returnValue must be set truthy
      e.returnValue = ""
      return ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty, isSaving])

  // Trigger shake + highlight each time a new blocked attempt arrives
  useEffect(() => {
    if (blocker.state === "blocked") {
      logger.warn("unsaved-bar", "Navigation blocked — shake & highlight")
      setShakeKey((k) => k + 1)
      setHighlight(true)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlight(false), 1400)
    }
  }, [blocker.state])

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
    const wasBlocked = blocker.state === "blocked"
    onDiscard()
    if (wasBlocked) blocker.proceed()
  }

  const isVisible = isDirty || blocker.state === "blocked"

  if (!isVisible) return null

  return (
    <>
      <style>{`
        @keyframes unsavedbar-shake {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          15%      { transform: translateX(calc(-50% - 10px)) translateY(0) rotate(-0.5deg); }
          30%      { transform: translateX(calc(-50% + 10px)) translateY(0) rotate(0.5deg); }
          45%      { transform: translateX(calc(-50% - 7px)) translateY(0); }
          60%      { transform: translateX(calc(-50% + 7px)) translateY(0); }
          75%      { transform: translateX(calc(-50% - 3px)) translateY(0); }
          90%      { transform: translateX(calc(-50% + 3px)) translateY(0); }
        }
        @keyframes unsavedbar-slide-up {
          from { transform: translateX(-50%) translateY(16px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
        @keyframes unsavedbar-glow {
          0%   { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 0 0 0 rgb(245 158 11 / 0); }
          30%  { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 0 0 6px rgb(245 158 11 / 0.25); }
          100% { box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 0 0 0 rgb(245 158 11 / 0); }
        }
        @keyframes unsavedbar-icon-pulse {
          0%, 100% { transform: scale(1); }
          30%      { transform: scale(1.35); }
          60%      { transform: scale(0.95); }
        }
      `}</style>

      <div
        key={shakeKey}
        className={cn(
          "fixed bottom-5 left-1/2 z-50",
          "flex items-center gap-2 pl-4 pr-2 py-2",
          "rounded-xl border bg-card shadow-xl shadow-black/10",
          "backdrop-blur-sm",
          "w-[calc(100vw-2rem)] max-w-[560px]",
          "transition-colors duration-300",
          highlight
            ? "border-amber-400/80 dark:border-amber-500/80"
            : "border-border"
        )}
        style={{
          animation:
            shakeKey > 0
              ? "unsavedbar-shake 0.55s cubic-bezier(.36,.07,.19,.97), unsavedbar-glow 1.2s ease-out"
              : "unsavedbar-slide-up 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
      >
        <AlertCircleIcon
          className="size-4 text-amber-500 shrink-0"
          style={{
            animation:
              shakeKey > 0
                ? "unsavedbar-icon-pulse 0.55s ease-out"
                : undefined,
          }}
        />
        <p className="text-sm font-medium flex-1 min-w-0 truncate">
          {t("unsavedBar.message")}
        </p>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            disabled={isSaving}
            className="h-8 px-3 text-muted-foreground hover:text-foreground gap-1.5"
          >
            <UndoIcon className="size-3.5" />
            <span className="hidden sm:inline">{t("unsavedBar.discard")}</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 px-3 gap-1.5"
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
    </>
  )
}
