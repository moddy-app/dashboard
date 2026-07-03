import * as React from "react"
import { CheckCircle2Icon, InfoIcon, XCircleIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "default" | "success" | "error"

type ToastItem = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
}

type ToastContextValue = {
  toast: (input: ToastInput) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = ++counter
      setToasts((prev) => [
        ...prev,
        { id, title: input.title, description: input.description, variant: input.variant ?? "default" },
      ])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const icons: Record<ToastVariant, React.ReactNode> = {
  default: <InfoIcon className="size-4 text-muted-foreground" />,
  success: <CheckCircle2Icon className="size-4 text-emerald-500" />,
  error: <XCircleIcon className="size-4 text-destructive" />,
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3.5 text-popover-foreground shadow-lg",
        "animate-in slide-in-from-bottom-2 fade-in-0"
      )}
      role="status"
    >
      <div className="mt-0.5 shrink-0">{icons[item.variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-muted-foreground break-words">{item.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-0.5 text-muted-foreground opacity-70 transition hover:opacity-100"
        aria-label="Fermer"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
