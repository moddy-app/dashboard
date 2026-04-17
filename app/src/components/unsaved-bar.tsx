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

  // Bloque la navigation si des modifications non sauvegardées existent
  const blocker = useBlocker(isDirty && !isSaving)

  // Quand le bloqueur est activé → shake + allow anyway after confirm or shake
  useEffect(() => {
    if (blocker.state === 'blocked') {
      // Animation de tremblement
      setShaking(true)
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
      shakeTimer.current = setTimeout(() => {
        setShaking(false)
        // L'utilisateur a été informé visuellement — on peut laisser le choix
      }, 600)
    }
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
    }
  }, [blocker.state])

  const handleSave = async () => {
    await onSave()
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
  }

  const handleDiscard = () => {
    onDiscard()
    if (blocker.state === 'blocked') {
      blocker.proceed()
    }
  }

  // Shake global de la page
  useEffect(() => {
    if (shaking) {
      document.body.style.animation = 'shake 0.4s ease-in-out'
      const t = setTimeout(() => {
        document.body.style.animation = ''
      }, 400)
      return () => clearTimeout(t)
    }
  }, [shaking])

  if (!isDirty && blocker.state !== 'blocked') return null

  return (
    <>
      {/* Styles keyframes injectés une seule fois */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>

      <div
        className={cn(
          "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
          "flex items-center gap-3 px-4 py-2.5",
          "rounded-xl border border-border bg-card shadow-lg shadow-black/10",
          "backdrop-blur-sm",
          "min-w-[320px] max-w-sm w-full sm:w-auto",
          shaking && "animate-[shake_0.4s_ease-in-out]"
        )}
        style={{ animation: isDirty ? 'slideUp 0.2s ease-out forwards' : undefined }}
      >
        <AlertCircleIcon className="size-4 text-amber-500 shrink-0" />
        <p className="text-sm font-medium flex-1">
          {t('unsavedBar.message')}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground"
          >
            <UndoIcon className="size-4 mr-1.5" />
            {t('unsavedBar.discard')}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <LoaderIcon className="size-4 mr-1.5 animate-spin" />
            ) : (
              <SaveIcon className="size-4 mr-1.5" />
            )}
            {t('unsavedBar.save')}
          </Button>
        </div>
      </div>
    </>
  )
}
