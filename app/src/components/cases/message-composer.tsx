import * as React from "react"
import { SendHorizontalIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { initialsOf } from "@/lib/cases-format"
import { cn } from "@/lib/utils"
import { useViewer } from "@/hooks/useViewer"

export function MessageComposer({
  onSubmit,
  placeholder = "Ajouter un commentaire…",
}: {
  onSubmit: (content: string) => Promise<void>
  placeholder?: string
}) {
  const viewer = useViewer()
  const [value, setValue] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const ref = React.useRef<HTMLTextAreaElement>(null)

  const grow = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [])

  const submit = async () => {
    const content = value.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(content)
      setValue("")
      requestAnimationFrame(grow)
    } finally {
      setSubmitting(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      void submit()
    }
  }

  const avatarUrl = viewer.profile?.avatar_url ?? undefined
  const name = viewer.profile?.display_name ?? "Vous"
  const canSend = value.trim().length > 0 && !submitting

  return (
    <div className="flex gap-3">
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarImage src={avatarUrl} alt="" />
        <AvatarFallback className="text-[10px]">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "flex-1 rounded-xl border bg-card transition-colors",
          focused ? "border-ring ring-[3px] ring-ring/20" : "border-border"
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            grow()
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          className="min-h-0 resize-none border-0 bg-transparent px-3.5 py-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-2">
          <span className="pl-1 text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ⌘↵
            </kbd>{" "}
            pour envoyer
          </span>
          <Button size="sm" onClick={submit} disabled={!canSend}>
            {submitting ? (
              <Spinner className="size-3.5" />
            ) : (
              <SendHorizontalIcon />
            )}
            Commenter
          </Button>
        </div>
      </div>
    </div>
  )
}
