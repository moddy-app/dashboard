import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  Heading2Icon,
  SmileIcon,
  LinkIcon,
  LoaderIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichFormat,
} from "@/components/rich-text-editor"
import { getEmojis } from "@/services/guilds"
import type { GuildEmoji } from "@/types/api"
import { cn } from "@/lib/utils"

// Éditeur de message réutilisable (n'importe quel module) : éditeur enrichi +
// barre de mise en forme façon Word (état actif au curseur), émojis du serveur,
// compteur de caractères et insertion de variables.

interface MessageEditorProps {
  value: string
  onChange: (value: string) => void
  /** Variables insérables et surlignées (ex: `['{author}', '{url}']`). */
  variables?: string[]
  /** Serveur dont charger les émojis personnalisés (optionnel). */
  guildId?: string | number
  maxLength?: number
  placeholder?: string
  minHeight?: number
  className?: string
}

const FORMATS: RichFormat[] = ["heading", "bold", "italic", "strike"]

export function MessageEditor({
  value,
  onChange,
  variables,
  guildId,
  maxLength = 1500,
  placeholder,
  minHeight = 120,
  className,
}: MessageEditorProps) {
  const { t } = useTranslation()
  const editorRef = useRef<RichTextEditorHandle>(null)

  // null = en cours de chargement ; [] = chargé (éventuellement vide).
  const [emojis, setEmojis] = useState<GuildEmoji[] | null>(guildId == null ? [] : null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [activeFormats, setActiveFormats] = useState<RichFormat[]>([])

  useEffect(() => {
    if (guildId == null) return
    let active = true
    getEmojis(guildId)
      .then((e) => active && setEmojis(e ?? []))
      .catch(() => active && setEmojis([]))
    return () => {
      active = false
    }
  }, [guildId])

  const handleToggle = (vals: string[]) => {
    const set = new Set(vals)
    const prev = new Set(activeFormats)
    for (const f of FORMATS) {
      if (set.has(f) !== prev.has(f)) {
        editorRef.current?.toggleFormat(f)
        break
      }
    }
  }

  const formatButtons: { value: RichFormat; icon: typeof BoldIcon; label: string }[] = [
    { value: "heading", icon: Heading2Icon, label: t("messageEditor.heading") },
    { value: "bold", icon: BoldIcon, label: t("messageEditor.bold") },
    { value: "italic", icon: ItalicIcon, label: t("messageEditor.italic") },
    { value: "strike", icon: StrikethroughIcon, label: t("messageEditor.strike") },
  ]

  return (
    <div className="flex flex-col gap-2">
      {/* Boîte éditeur (toolbar + zone de texte + compteur) */}
      <div className="rounded-md border border-input overflow-hidden transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {/* Barre d'outils */}
        <div className="flex items-center gap-1 border-b bg-muted/40 px-1.5 py-1">
          <ToggleGroup type="multiple" value={activeFormats} size="sm" onValueChange={handleToggle}>
            {formatButtons.map(({ value: v, icon: Icon, label }) => (
              <Tooltip key={v}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={v}
                    aria-label={label}
                    className="size-8 p-0 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                    // Conserve la sélection/curseur dans l'éditeur (sinon le clic défocus).
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Icon className="size-4" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>

          <div className="mx-0.5 h-5 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.wrapSelection("[", "](https://)")}
                className="size-8 p-0"
              >
                <LinkIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("messageEditor.link")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={emojiOpen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEmojiOpen((o) => !o)}
                className={cn("size-8 p-0", emojiOpen && "bg-accent text-accent-foreground")}
              >
                <SmileIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("messageEditor.emojis")}</TooltipContent>
          </Tooltip>

          <span className="ml-auto pr-1 text-[11px] tabular-nums text-muted-foreground">
            {value.length}/{maxLength}
          </span>
        </div>

        {/* Panneau émojis (inline → scroll OK même dans une modale) */}
        {emojiOpen && (
          <div className="border-b bg-muted/20 p-2">
            {emojis === null ? (
              <div className="flex items-center justify-center py-5">
                <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : emojis.length === 0 ? (
              <p className="py-5 text-center text-xs text-muted-foreground">
                {t("messageEditor.noEmojis")}
              </p>
            ) : (
              <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto overscroll-contain">
                {emojis.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    title={`:${e.name}:`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() =>
                      editorRef.current?.insertText(`<${e.animated ? "a" : ""}:${e.name}:${e.id}>`)
                    }
                    className="flex items-center justify-center rounded p-1 hover:bg-accent transition-colors"
                  >
                    <img
                      src={`https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=32`}
                      alt={e.name}
                      className="size-6 object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Zone de texte (l'éditeur enrichi, sans bordure propre) */}
        <RichTextEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          placeholders={variables}
          maxLength={maxLength}
          minHeight={minHeight}
          onSelectionChange={setActiveFormats}
          className={cn(
            "rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent",
            className
          )}
        />
      </div>

      {/* Variables insérables */}
      {variables && variables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t("messageEditor.variables")}</span>
          {variables.map((v) => (
            <button
              key={v}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editorRef.current?.insertText(v)}
              className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:bg-accent transition-colors"
              title={t("messageEditor.insertVariable")}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
