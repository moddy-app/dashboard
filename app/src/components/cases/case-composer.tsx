import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SendHorizonalIcon, LoaderIcon, LockIcon, MessageSquareIcon } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX = 2000

interface CaseComposerProps {
  onSubmit: (content: string, asNote: boolean) => Promise<void>
  /** Autorise la bascule « note interne » (staff uniquement). */
  canNote?: boolean
}

export function CaseComposer({ onSubmit, canNote = false }: CaseComposerProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState("")
  const [asNote, setAsNote] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const trimmed = value.trim()
  const disabled = trimmed.length === 0 || submitting || trimmed.length > MAX

  const submit = async () => {
    if (disabled) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed, asNote)
      setValue("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        asNote && "border-amber-300 dark:border-amber-900"
      )}
    >
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={asNote ? t("cases.composer.notePlaceholder") : t("cases.composer.placeholder")}
        maxLength={MAX}
        className="min-h-[84px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="flex items-center justify-between gap-2 border-t px-2.5 py-2">
        <div className="flex items-center gap-2">
          {canNote && (
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setAsNote(false)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  !asNote ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquareIcon className="size-3" />
                {t("cases.composer.comment")}
              </button>
              <button
                type="button"
                onClick={() => setAsNote(true)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  asNote ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LockIcon className="size-3" />
                {t("cases.composer.note")}
              </button>
            </div>
          )}
          <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
            {trimmed.length}/{MAX}
          </span>
        </div>
        <Button size="sm" onClick={submit} disabled={disabled}>
          {submitting ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : (
            <SendHorizonalIcon className="size-4" />
          )}
          {asNote ? t("cases.composer.addNote") : t("cases.composer.send")}
        </Button>
      </div>
    </div>
  )
}
