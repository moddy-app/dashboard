import * as React from "react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { CloseIcon } from "@/components/icons"
import { useUserProfile } from "@/hooks/useProfile"
import { parseUserId } from "@/lib/discord-id"
import { cn } from "@/lib/utils"

export interface UserIdPickerProps {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

const FIELD_CLASS =
  "rounded-4xl border border-input bg-input/30 text-sm transition-colors outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"

/**
 * Sélecteur d'utilisateur hors serveur : on saisit un identifiant (ou une
 * mention), le profil est résolu et affiché. Hors contexte serveur uniquement :
 * dans un serveur, `MemberPicker` cherche par nom.
 */
export function UserIdPicker({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: UserIdPickerProps) {
  const { t } = useTranslation()
  const [text, setText] = React.useState("")
  const profile = useUserProfile(value)
  const typed = text.trim()
  const badInput = typed.length > 0 && parseUserId(typed) === null

  const commit = (raw: string) => {
    const parsed = parseUserId(raw)
    if (parsed) {
      onChange(parsed)
      setText("")
    }
  }

  if (value) {
    const user = profile.data
    const name = user?.display_name ?? value
    return (
      <div
        className={cn(
          FIELD_CLASS,
          "flex h-9 w-full items-center gap-2 pr-1.5 pl-3",
          disabled && "opacity-50",
          invalid && "border-destructive ring-[3px] ring-destructive/20"
        )}
      >
        {profile.loading ? (
          <Spinner />
        ) : (
          <Avatar className="size-5">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
            <AvatarFallback className="text-[10px]">{name.slice(0, 2)}</AvatarFallback>
          </Avatar>
        )}
        {profile.error ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {t("pickers.user.notFound")}
          </span>
        ) : (
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="truncate">{name}</span>
            {user && <span className="truncate text-xs text-muted-foreground">@{user.username}</span>}
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={t("pickers.user.clear")}
          onClick={() => onChange(null)}
          className="flex size-6 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={text}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid || badInput || undefined}
        placeholder={placeholder ?? t("pickers.user.placeholder")}
        onChange={(e) => {
          setText(e.target.value)
          commit(e.target.value)
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text")
          if (parseUserId(pasted)) {
            e.preventDefault()
            commit(pasted)
          }
        }}
      />
      {badInput && <p className="px-3 text-xs text-destructive">{t("pickers.user.invalid")}</p>}
    </div>
  )
}
