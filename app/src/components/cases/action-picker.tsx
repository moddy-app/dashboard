import { useTranslation } from "react-i18next"
import { InfinityIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACTION_META, actionTone } from "@/lib/cases"
import type { SanctionAction } from "@/types/cases"

// ─── Grille de sélection d'action ─────────────────────────────────────────────

export function ActionPicker({
  actions,
  value,
  onChange,
}: {
  actions: SanctionAction[]
  value: SanctionAction | null
  onChange: (a: SanctionAction) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-3 gap-2">
      {actions.map((a) => {
        const meta = ACTION_META[a]
        const tone = actionTone(a)
        const Icon = meta.icon
        const active = value === a
        return (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-colors",
              active
                ? "border-primary bg-accent"
                : "border-border hover:border-muted-foreground/40 hover:bg-muted/40"
            )}
          >
            <Icon className={cn("size-4", tone.text)} />
            <span className="text-xs font-medium text-foreground">{t(`cases.action.${a}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Champ d'échéance (datetime-local ↔ ISO) ──────────────────────────────────

/** ISO → valeur d'input datetime-local (heure locale, sans secondes). */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ExpiryField({
  value,
  onChange,
  temporary,
}: {
  value: string | null
  onChange: (iso: string | null) => void
  /** L'action sélectionnée est-elle temporisable ? */
  temporary: boolean
}) {
  const { t } = useTranslation()

  if (!temporary) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <InfinityIcon className="size-3.5 shrink-0" />
        {t("cases.form.notTemporary")}
      </div>
    )
  }

  const permanent = !value

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex w-full rounded-lg border bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            permanent ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("cases.form.permanent")}
        </button>
        <button
          type="button"
          onClick={() => {
            // par défaut : +7 jours
            const d = new Date(Date.now() + 7 * 24 * 3600 * 1000)
            onChange(d.toISOString())
          }}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            !permanent ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t("cases.form.temporary")}
        </button>
      </div>
      {!permanent && (
        <input
          type="datetime-local"
          value={isoToLocalInput(value)}
          onChange={(e) => {
            const v = e.target.value
            onChange(v ? new Date(v).toISOString() : null)
          }}
          className="w-full rounded-md border border-input bg-input/30 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      )}
    </div>
  )
}
