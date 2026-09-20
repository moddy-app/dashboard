import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { SearchIcon, SmilePlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGuildEmojis } from "@/hooks/useGuildEmojis"
import {
  customEmojiToken,
  emojiCdnUrl,
  isUnicodeEmoji,
  parseEmojiToken,
} from "@/lib/discord-emoji"
import { cn } from "@/lib/utils"

// Sélecteur d'émoji (serveur + Unicode) et rendu d'un émoji stocké.
// Les helpers de parsing vivent dans `@/lib/discord-emoji`.

export function EmojiView({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  const raw = value?.trim()
  if (!raw) return null

  // Un émoji de serveur n'est pas un caractère : `<:nom:id>` écrit tel quel
  // donnerait du texte brut au milieu d'un bouton.
  const custom = parseEmojiToken(raw)
  if (custom) {
    return (
      <img
        src={emojiCdnUrl(custom.id, custom.animated)}
        alt={`:${custom.name}:`}
        title={`:${custom.name}:`}
        loading="lazy"
        className={cn("size-[1.15em] shrink-0 object-contain", className)}
      />
    )
  }

  return <span className={cn("shrink-0 leading-none", className)}>{raw}</span>
}

/**
 * Jeu d'émojis Unicode proposé par défaut. Discord n'impose rien : c'est une
 * sélection de ceux qui servent réellement à étiqueter une catégorie de
 * support. N'importe quel autre reste saisissable au clavier dans la recherche.
 */
const UNICODE_EMOJIS: { char: string; keywords: string }[] = [
  { char: "🎫", keywords: "ticket billet support" },
  { char: "🎟️", keywords: "ticket billet" },
  { char: "📩", keywords: "message courrier contact" },
  { char: "✉️", keywords: "mail message contact" },
  { char: "💬", keywords: "chat discussion question" },
  { char: "❓", keywords: "question aide help" },
  { char: "❔", keywords: "question aide" },
  { char: "🆘", keywords: "sos aide urgence help" },
  { char: "🛟", keywords: "aide secours support" },
  { char: "🙋", keywords: "aide question main" },
  { char: "🐛", keywords: "bug erreur probleme" },
  { char: "🔧", keywords: "technique reparation outil" },
  { char: "🛠️", keywords: "technique outils maintenance" },
  { char: "⚙️", keywords: "reglages parametres technique" },
  { char: "🚨", keywords: "urgence alerte signalement" },
  { char: "⚠️", keywords: "alerte attention signalement" },
  { char: "🛡️", keywords: "moderation securite protection" },
  { char: "🔨", keywords: "moderation sanction ban" },
  { char: "👮", keywords: "moderation staff police" },
  { char: "🚔", keywords: "moderation signalement" },
  { char: "📝", keywords: "candidature formulaire ecrire" },
  { char: "📋", keywords: "candidature liste formulaire" },
  { char: "📄", keywords: "document fichier" },
  { char: "🗂️", keywords: "dossier classement" },
  { char: "💡", keywords: "idee suggestion" },
  { char: "✨", keywords: "suggestion nouveau" },
  { char: "🚀", keywords: "boost projet lancement" },
  { char: "🏆", keywords: "concours recompense" },
  { char: "🎁", keywords: "cadeau giveaway recompense" },
  { char: "🎉", keywords: "fete evenement giveaway" },
  { char: "🤝", keywords: "partenariat collaboration" },
  { char: "🧑‍💼", keywords: "partenariat business staff" },
  { char: "💼", keywords: "business partenariat recrutement" },
  { char: "💰", keywords: "paiement facture argent" },
  { char: "💳", keywords: "paiement facture achat" },
  { char: "🛒", keywords: "achat boutique commande" },
  { char: "📦", keywords: "commande livraison" },
  { char: "🔑", keywords: "acces cle compte" },
  { char: "🔒", keywords: "prive securite acces" },
  { char: "👤", keywords: "compte profil utilisateur" },
  { char: "👥", keywords: "equipe membres" },
  { char: "🌐", keywords: "site web international" },
  { char: "📢", keywords: "annonce information" },
  { char: "⭐", keywords: "favori important etoile" },
  { char: "❤️", keywords: "coeur soutien" },
  { char: "✅", keywords: "valide ok accepte" },
  { char: "❌", keywords: "refus erreur fermer" },
  { char: "🔍", keywords: "recherche enquete" },
]

interface EmojiPickerProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Serveur dont charger les émojis personnalisés. */
  guildId?: string | null
  disabled?: boolean
  className?: string
}

/**
 * Bouton + popover. La valeur reste une chaîne Discord (`<:nom:id>` ou un
 * caractère Unicode) : c'est ce que l'API stocke, et le champ de recherche
 * accepte un collage direct pour tout ce qui n'est pas dans la liste.
 */
export function EmojiPicker({
  value,
  onChange,
  guildId,
  disabled,
  className,
}: EmojiPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { emojis, isLoading } = useGuildEmojis(open ? guildId : null)

  const needle = query.trim().toLowerCase()

  const guildMatches = useMemo(
    () => (needle ? emojis.filter((e) => e.name.toLowerCase().includes(needle)) : emojis),
    [emojis, needle]
  )

  const unicodeMatches = useMemo(
    () =>
      needle
        ? UNICODE_EMOJIS.filter((e) => e.keywords.includes(needle) || e.char === query.trim())
        : UNICODE_EMOJIS,
    [needle, query]
  )

  /** Un caractère collé dans la recherche est proposé tel quel. */
  const pasted = useMemo(() => {
    const raw = query.trim()
    if (!raw || raw.length > 8) return null
    if (UNICODE_EMOJIS.some((e) => e.char === raw)) return null
    return isUnicodeEmoji(raw) ? raw : null
  }, [query])

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery("")
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={t("emojiPicker.label")}
            className="size-9 p-0 text-lg"
          >
            {value ? (
              <EmojiView value={value} className="size-5 text-xl" />
            ) : (
              <SmilePlusIcon className="text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="p-2">
            <InputGroup className="h-9">
              <InputGroupInput
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("emojiPicker.search")}
              />
              <InputGroupAddon>
                <SearchIcon className="size-4 opacity-50" />
              </InputGroupAddon>
            </InputGroup>
          </div>

          {pasted && (
            <div className="px-2 pb-2">
              <button
                type="button"
                onClick={() => pick(pasted)}
                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="text-lg leading-none">{pasted}</span>
                {t("emojiPicker.usePasted")}
              </button>
            </div>
          )}

          <Tabs defaultValue="guild">
            <TabsList className="mx-2 w-[calc(100%-1rem)]">
              <TabsTrigger value="guild" className="flex-1">
                {t("emojiPicker.guild")}
              </TabsTrigger>
              <TabsTrigger value="unicode" className="flex-1">
                {t("emojiPicker.standard")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guild" className="p-2">
              {isLoading ? (
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <Skeleton key={i} className="size-8 rounded-md" />
                  ))}
                </div>
              ) : guildMatches.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  {emojis.length === 0 ? t("emojiPicker.noGuildEmoji") : t("emojiPicker.noMatch")}
                </p>
              ) : (
                <div className="no-scrollbar grid max-h-56 grid-cols-8 gap-1 overflow-y-auto overscroll-contain">
                  {guildMatches.map((emoji) => (
                    <button
                      key={emoji.id}
                      type="button"
                      title={`:${emoji.name}:`}
                      onClick={() => pick(customEmojiToken(emoji))}
                      className="flex size-8 items-center justify-center rounded-md transition-colors hover:bg-accent"
                    >
                      <img
                        src={emojiCdnUrl(emoji.id, Boolean(emoji.animated))}
                        alt={emoji.name}
                        loading="lazy"
                        className="size-5 object-contain"
                      />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="unicode" className="p-2">
              {unicodeMatches.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  {t("emojiPicker.noMatch")}
                </p>
              ) : (
                <div className="no-scrollbar grid max-h-56 grid-cols-8 gap-1 overflow-y-auto overscroll-contain">
                  {unicodeMatches.map((emoji) => (
                    <button
                      key={emoji.char}
                      type="button"
                      onClick={() => pick(emoji.char)}
                      className="flex size-8 items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-accent"
                    >
                      {emoji.char}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={t("emojiPicker.clear")}
          className="size-9 p-0 text-muted-foreground"
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      )}
    </div>
  )
}
