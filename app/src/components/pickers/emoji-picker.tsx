import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronDownIcon, SearchIcon, SmileIcon } from "@/components/icons"
import { useGuildContext } from "@/contexts/GuildContext"
import { useGuildEmojis } from "@/hooks/useGuildEmojis"
import { emojiCdnUrl, parseEmojiToken } from "@/lib/discord-emoji"
import { cn } from "@/lib/utils"

// Valeur : le caractère Unicode, ou `<:nom:id>` / `<a:nom:id>` pour un émoji
// personnalisé (la syntaxe que Discord met dans le texte).

interface UnicodeEmoji {
  unicode: string
  label: string
  tags: string[]
  group: number
}

interface RawEmoji {
  unicode: string
  label: string
  tags?: string[]
  group?: number
}

// Cache module : les données Unicode (~600 Ko) ne sont chargées qu'à la
// première ouverture de l'onglet, une fois par langue.
const unicodeCache = new Map<string, UnicodeEmoji[]>()

async function loadUnicode(lang: "fr" | "en"): Promise<UnicodeEmoji[]> {
  const hit = unicodeCache.get(lang)
  if (hit) return hit
  const mod = lang === "fr"
    ? await import("emojibase-data/fr/compact.json")
    : await import("emojibase-data/en/compact.json")
  const raw = mod.default as unknown as RawEmoji[]
  const list = raw
    // Sans groupe (indicateurs régionaux) ou groupe 2 (composants : teintes de peau).
    .filter((e) => e.group !== undefined && e.group !== 2)
    .map((e) => ({ unicode: e.unicode, label: e.label, tags: e.tags ?? [], group: e.group as number }))
  unicodeCache.set(lang, list)
  return list
}

const GROUP_ORDER = [0, 1, 3, 4, 5, 6, 7, 8, 9]

/** Rend un émoji (Unicode = texte, custom = image du CDN). */
export function EmojiGlyph({ value, className }: { value: string; className?: string }) {
  const custom = parseEmojiToken(value)
  if (custom) {
    return (
      <img
        src={emojiCdnUrl(custom.id, custom.animated, 48)}
        alt={custom.name}
        className={cn("size-5 shrink-0 object-contain", className)}
        loading="lazy"
      />
    )
  }
  return <span className={cn("shrink-0 leading-none", className)}>{value}</span>
}

export interface EmojiPickerProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Masque l'onglet des émojis du serveur. */
  unicodeOnly?: boolean
  /** Défaut : serveur sélectionné. */
  guildId?: string
  /** Ajoute le bouton « Aucun émoji ». */
  allowNone?: boolean
  placeholder?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
  /** Déclencheur personnalisé (ex. bouton icône d'une barre d'outils) à la place du champ. */
  trigger?: React.ReactNode
  /** Alignement de la fenêtre par rapport au déclencheur. */
  align?: "start" | "center" | "end"
}

export function EmojiPicker({
  value,
  onChange,
  unicodeOnly,
  guildId: guildIdProp,
  allowNone,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
  trigger,
  align = "start",
}: EmojiPickerProps) {
  const { t, i18n } = useTranslation()
  const ctx = useGuildContext()
  const guildId = guildIdProp ?? ctx.selectedGuildId
  const [open, setOpen] = React.useState(false)
  const [tab, setTab] = React.useState<"server" | "unicode">("unicode")
  const [query, setQuery] = React.useState("")
  const [unicode, setUnicode] = React.useState<UnicodeEmoji[] | null>(null)
  const [unicodeFailed, setUnicodeFailed] = React.useState(false)

  const { emojis, loading: emojisLoading } = useGuildEmojis(unicodeOnly ? null : guildId, open)
  const hasServer = !unicodeOnly && (emojisLoading || emojis.length > 0)
  const lang = i18n.language?.startsWith("fr") ? "fr" : "en"

  // Ouverture : repartir d'une recherche vide, onglet serveur s'il en a.
  // Les émojis du serveur arrivent après l'ouverture : tant que l'utilisateur
  // n'a pas choisi d'onglet, on bascule dessus à leur arrivée.
  const tabTouched = React.useRef(false)
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setQuery("")
      tabTouched.current = false
      setTab(hasServer && emojis.length > 0 ? "server" : "unicode")
    }
  }
  React.useEffect(() => {
    if (open && !tabTouched.current && emojis.length > 0) setTab("server")
  }, [open, emojis.length])

  React.useEffect(() => {
    if (!open || unicode) return
    let cancelled = false
    loadUnicode(lang)
      .then((list) => !cancelled && setUnicode(list))
      .catch(() => !cancelled && setUnicodeFailed(true))
    return () => {
      cancelled = true
    }
  }, [open, unicode, lang])

  // Langue changée : recharger le jeu de données correspondant.
  React.useEffect(() => {
    setUnicode(null)
    setUnicodeFailed(false)
  }, [lang])

  const activeTab = hasServer ? tab : "unicode"
  const q = query.trim().toLowerCase()

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  const filteredUnicode = React.useMemo(() => {
    if (!unicode) return []
    if (!q) return unicode
    return unicode.filter(
      (e) => e.label.toLowerCase().includes(q) || e.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [unicode, q])

  const unicodeGroups = React.useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ group: g, items: filteredUnicode.filter((e) => e.group === g) })).filter(
        (g) => g.items.length > 0
      ),
    [filteredUnicode]
  )

  const filteredServer = emojis.filter((e) => !q || e.name.toLowerCase().includes(q))

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className="flex h-9 w-full items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {value ? (
              <EmojiGlyph value={value} />
            ) : (
              <>
                <SmileIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">
                  {placeholder ?? t("pickers.emoji.placeholder")}
                </span>
              </>
            )}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 gap-2 p-2">
        <InputGroup>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pickers.emoji.search")}
            aria-label={t("pickers.emoji.search")}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        {hasServer && (
          <Tabs value={activeTab} onValueChange={(v) => {
              tabTouched.current = true
              setTab(v as "server" | "unicode")
            }}>
            <TabsList className="w-full">
              <TabsTrigger value="server">{t("pickers.emoji.server")}</TabsTrigger>
              <TabsTrigger value="unicode">{t("pickers.emoji.unicode")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="max-h-64 overflow-y-auto">
          {activeTab === "server" ? (
            emojisLoading ? (
              <Loading />
            ) : filteredServer.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("pickers.emoji.empty")}</p>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {filteredServer.map((e) => {
                  const token = `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`
                  return (
                    <EmojiCell
                      key={e.id}
                      label={e.name}
                      selected={value === token}
                      disabled={e.available === false}
                      onClick={() => pick(token)}
                    >
                      <EmojiGlyph value={token} className="size-6" />
                    </EmojiCell>
                  )
                })}
              </div>
            )
          ) : unicodeFailed ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("pickers.emoji.failed")}</p>
          ) : !unicode ? (
            <Loading />
          ) : unicodeGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("pickers.emoji.empty")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {unicodeGroups.map(({ group, items }) => (
                <section key={group} className="flex flex-col gap-1">
                  <h3 className="px-1 text-xs font-medium text-muted-foreground">
                    {t(`pickers.emoji.groups.${group}`)}
                  </h3>
                  <div className="grid grid-cols-8 gap-1">
                    {items.map((e) => (
                      <EmojiCell
                        key={e.unicode}
                        label={e.label}
                        selected={value === e.unicode}
                        onClick={() => pick(e.unicode)}
                      >
                        <span className="text-xl leading-none">{e.unicode}</span>
                      </EmojiCell>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        {allowNone && value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>
            {t("pickers.emoji.none")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Spinner />
      {t("pickers.emoji.loading")}
    </div>
  )
}

function EmojiCell({
  label,
  selected,
  disabled,
  onClick,
  children,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
        selected && "bg-muted ring-1 ring-ring/50"
      )}
    >
      {children}
    </button>
  )
}
