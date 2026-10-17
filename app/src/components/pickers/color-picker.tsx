import * as React from "react"
import { HexColorPicker } from "react-colorful"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon } from "@/components/icons"
import { DISCORD_SWATCHES, isHexColor, normalizeHex } from "@/lib/color"
import { cn } from "@/lib/utils"

export interface ColorPickerProps {
  /** `#RRGGBB`, ou `null` = couleur par défaut. */
  value: string | null
  onChange: (value: string | null) => void
  /** Couleur affichée quand `value` est `null`. */
  defaultColor?: string
  swatches?: string[]
  /** Ajoute « Couleur par défaut » (`onChange(null)`). */
  allowReset?: boolean
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

export function ColorPicker({
  value,
  onChange,
  defaultColor = "#5865F2",
  swatches = DISCORD_SWATCHES,
  allowReset,
  disabled,
  id,
  "aria-invalid": invalid,
}: ColorPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const shown = value ?? defaultColor
  const [text, setText] = React.useState(shown.replace("#", "").toUpperCase())

  // Le champ suit la valeur (nuancier, roue) ; une saisie en cours reste intacte.
  React.useEffect(() => {
    setText(shown.replace("#", "").toUpperCase())
  }, [shown])

  const typed = `#${text}`
  const textInvalid = text.length > 0 && !isHexColor(typed)

  const onText = (raw: string) => {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6).toUpperCase()
    setText(clean)
    if (clean.length === 6) onChange(normalizeHex(clean))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full ring-1 ring-foreground/15"
              style={{ backgroundColor: shown }}
            />
            <span className={cn("truncate tabular-nums", value === null && "text-muted-foreground")}>
              {value === null ? t("pickers.color.default") : value.toUpperCase()}
            </span>
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-3 p-3">
        <HexColorPicker
          color={shown}
          onChange={(c) => onChange(c.toUpperCase())}
          className="!w-full [&_.react-colorful\_\_saturation]:rounded-xl [&_.react-colorful\_\_hue]:mt-3 [&_.react-colorful\_\_hue]:h-3 [&_.react-colorful\_\_hue]:rounded-full [&_.react-colorful\_\_pointer]:size-5"
        />
        <InputGroup>
          <InputGroupAddon>#</InputGroupAddon>
          <InputGroupInput
            value={text}
            onChange={(e) => onText(e.target.value)}
            aria-label={t("pickers.color.hex")}
            aria-invalid={textInvalid || undefined}
            maxLength={7}
            spellCheck={false}
            className="tabular-nums"
          />
        </InputGroup>
        <div role="group" aria-label={t("pickers.color.swatches")} className="grid grid-cols-8 gap-1.5">
          {swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={hex}
              aria-pressed={shown.toUpperCase() === hex.toUpperCase()}
              onClick={() => onChange(hex.toUpperCase())}
              className={cn(
                "size-6 rounded-full ring-1 ring-foreground/15 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                shown.toUpperCase() === hex.toUpperCase() && "ring-2 ring-foreground"
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        {allowReset && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={value === null}
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
          >
            {t("pickers.color.reset")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
