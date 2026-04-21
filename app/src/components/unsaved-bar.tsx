import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBlocker } from "react-router-dom"
import { LoaderIcon, SaveIcon, UndoIcon, AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface UnsavedBarProps {
  isDirty: boolean
  isSaving?: boolean
  onSave: () => Promise<void> | void
  onDiscard: () => void
}

export function UnsavedBar({ isDirty, isSaving = false, onSave, onDiscard }: UnsavedBarProps) {
  const { t } = useTranslation()
  const [shaking, setShaking] = useState(false)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Separate blocking state we control manually to prevent React Router from
  // auto-proceeding blocked navigations when isDirty turns false after save.
  const [blockingEnabled, setBlockingEnabled] = useState(false)

  useEffect(() => {
    if (isDirty) setBlockingEnabled(true)
  }, [isDirty])

  const blocker = useBlocker(blockingEnabled && !isSaving)

  // Shake animation when a navigation is blocked
  useEffect(() => {
    if (blocker.state === "blocked") {
      setShaking(true)
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
      shakeTimer.current = setTimeout(() => setShaking(false), 500)
    }
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
    }
  }, [blocker.state])

  const handleSave = async () => {
    // Disable blocker synchronously BEFORE the state commit so that the
    // pending navigation is cancelled via blocker.reset() — not auto-proceeded.
    if (blocker.state === "blocked") {
      blocker.reset() // Cancel the blocked navigation; user stays on page
    }
    setBlockingEnabled(false)
    await onSave()
  }

  const handleDiscard = () => {
    const wasBlocked = blocker.state === "blocked"
    setBlockingEnabled(false)
    onDiscard()
    if (wasBlocked) {
      blocker.proceed() // Navigate away after discarding changes
    }
  }

  const isVisible = isDirty || blocker.state === "blocked"

  if (!isVisible) return null

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          20%       { transform: translateX(calc(-50% - 6px)) translateY(0); }
          40%       { transform: translateX(calc(-50% + 6px)) translateY(0); }
          60%       { transform: translateX(calc(-50% - 3px)) translateY(0); }
          80%       { transform: translateX(calc(-50% + 3px)) translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(16px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        className={cn(
          "fixed bottom-5 left-1/2 z-50",
          "flex items-center gap-2 pl-4 pr-2 py-2",
          "rounded-xl border border-border bg-card shadow-xl shadow-black/10",
          "backdrop-blur-sm",
          "w-[calc(100vw-2rem)] max-w-[420px]",
          shaking ? "animate-[shake_0.5s_ease-in-out]" : "animate-[slideUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
        )}
      >
        <AlertCircleIcon className="size-4 text-amber-500 shrink-0" />
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
