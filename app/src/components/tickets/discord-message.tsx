import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  DownloadIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  MusicIcon,
  VideoIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { DiscordMarkup } from "@/components/discord-markup"
import { cn } from "@/lib/utils"
import { discordColorToHex, formatBytes, isImageAttachment } from "@/lib/transcripts"
import type {
  TranscriptAttachment,
  TranscriptComponent,
  TranscriptEmbed,
  TranscriptMessage,
  TranscriptSticker,
} from "@/types/transcripts"

// Rendu du **contenu** d'un message archivé, dans toutes les formes que Discord
// sait produire : markdown, embeds classiques, Components V2 (conteneurs,
// sections, galeries, séparateurs, fichiers, boutons), autocollants et pièces
// jointes.
//
// Deux règles tiennent tout le fichier :
//
// 1. **Rien n'est jamais injecté en HTML.** Le texte vient de membres et de
//    staff : il passe par `DiscordMarkup`, qui rend des nœuds React contrôlés.
// 2. **Rien ne disparaît en silence.** Une URL de CDN expirée, un composant d'un
//    bot plus récent que ce dashboard, un média sans aperçu : chacun laisse une
//    trace lisible plutôt qu'un trou dans la conversation.

// ─── Contenu complet d'un message ─────────────────────────────────────────────

export function DiscordMessageBody({
  message,
  className,
}: {
  message: TranscriptMessage
  className?: string
}) {
  const hasBody =
    Boolean(message.content) ||
    message.components.length > 0 ||
    message.embeds.length > 0 ||
    message.attachments.length > 0 ||
    message.stickers.length > 0

  if (!hasBody) return null

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {message.content && (
        <div className="text-sm leading-relaxed wrap-break-word">
          <DiscordMarkup text={message.content} />
        </div>
      )}

      {message.components.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          {message.components.map((component, index) => (
            <DiscordComponent key={index} component={component} />
          ))}
        </div>
      )}

      {message.embeds.map((embed, index) => (
        <DiscordEmbed key={index} embed={embed} />
      ))}

      {message.stickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.stickers.map((sticker, index) => (
            <StickerTile key={index} sticker={sticker} />
          ))}
        </div>
      )}

      {message.attachments.length > 0 && <AttachmentList attachments={message.attachments} />}
    </div>
  )
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

function DiscordEmbed({ embed }: { embed: TranscriptEmbed }) {
  const { i18n } = useTranslation()
  const accent = discordColorToHex(embed.color)
  const timestamp = embed.timestamp ? new Date(embed.timestamp) : null

  return (
    <div
      className="min-w-0 max-w-full overflow-hidden rounded-lg border border-l-4 bg-muted/40 p-3 sm:max-w-lg"
      // Barre d'accent : c'est la seule couleur que porte l'embed, et elle vient
      // de la donnée — pas du thème.
      style={accent ? { borderLeftColor: accent } : undefined}
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {embed.author && (
            <div className="flex min-w-0 items-center gap-2">
              {embed.author.icon_url && (
                <img
                  src={embed.author.icon_url}
                  alt=""
                  loading="lazy"
                  className="size-5 shrink-0 rounded-full object-cover"
                />
              )}
              <span className="truncate text-xs font-semibold">{embed.author.name}</span>
            </div>
          )}

          {embed.title &&
            (embed.url ? (
              <a
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {embed.title}
              </a>
            ) : (
              <p className="text-sm font-semibold">{embed.title}</p>
            ))}

          {embed.description && (
            <div className="text-sm leading-relaxed text-muted-foreground wrap-break-word">
              <DiscordMarkup text={embed.description} />
            </div>
          )}

          {embed.fields.length > 0 && (
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {embed.fields.map((field, index) => (
                <div
                  key={index}
                  // Discord met trois champs `inline` par ligne ; un champ non
                  // inline occupe la largeur entière.
                  className={cn("min-w-0", !field.inline && "sm:col-span-3")}
                >
                  <p className="text-xs font-semibold">{field.name}</p>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground wrap-break-word">
                    <DiscordMarkup text={field.value} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {embed.thumbnail && (
          <img
            src={embed.thumbnail}
            alt=""
            loading="lazy"
            className="size-16 shrink-0 rounded-md object-cover"
          />
        )}
      </div>

      {embed.image && (
        <img
          src={embed.image}
          alt=""
          loading="lazy"
          className="mt-2 max-h-80 w-full rounded-md object-contain"
        />
      )}

      {(embed.footer || timestamp) && (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {embed.footer?.icon_url && (
            <img
              src={embed.footer.icon_url}
              alt=""
              loading="lazy"
              className="size-4 shrink-0 rounded-full object-cover"
            />
          )}
          <span className="truncate">
            {[embed.footer?.text, timestamp?.toLocaleString(i18n.language, {
              dateStyle: "medium",
              timeStyle: "short",
            })]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Components V2 ────────────────────────────────────────────────────────────

function DiscordComponent({ component }: { component: TranscriptComponent }) {
  const { t } = useTranslation()

  switch (component.kind) {
    case "text":
      return (
        <div className="text-sm leading-relaxed wrap-break-word">
          <DiscordMarkup text={component.content} />
        </div>
      )

    case "container": {
      const accent = discordColorToHex(component.accent_color)
      return (
        <Spoiler active={component.spoiler}>
          <div
            className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-lg border border-l-4 bg-muted/40 p-3 sm:max-w-lg"
            style={accent ? { borderLeftColor: accent } : undefined}
          >
            {component.components.map((child, index) => (
              <DiscordComponent key={index} component={child} />
            ))}
          </div>
        </Spoiler>
      )
    }

    case "section":
      return (
        // L'accessoire d'une section (vignette ou bouton) est posé à droite du
        // texte, comme chez Discord, et repasse dessous sur mobile.
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {component.content.map((child, index) => (
              <DiscordComponent key={index} component={child} />
            ))}
          </div>
          {component.accessory && (
            <div className="shrink-0">
              <DiscordComponent component={component.accessory} />
            </div>
          )}
        </div>
      )

    case "thumbnail":
      return (
        <Spoiler active={component.spoiler}>
          <MediaImage url={component.url} description={component.description} className="size-20" />
        </Spoiler>
      )

    case "gallery":
      return (
        <div
          className={cn(
            "grid min-w-0 gap-2",
            component.items.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"
          )}
        >
          {component.items.map((item, index) => (
            <Spoiler key={index} active={item.spoiler}>
              <MediaImage
                url={item.url}
                description={item.description}
                className="aspect-square w-full"
              />
            </Spoiler>
          ))}
        </div>
      )

    case "file":
      return (
        <Spoiler active={component.spoiler}>
          <AttachmentList
            attachments={[
              {
                filename: component.filename ?? t("modules.tickets.transcript.unnamedFile"),
                url: component.url,
                size: component.size,
                content_type: null,
              },
            ]}
          />
        </Spoiler>
      )

    case "separator":
      return component.divider ? (
        <Separator className={cn(component.spacing === "large" ? "my-2" : "my-1")} />
      ) : (
        <div className={component.spacing === "large" ? "h-4" : "h-2"} />
      )

    case "row":
      return (
        <div className="flex min-w-0 flex-wrap gap-2">
          {component.components.map((child, index) => (
            <DiscordComponent key={index} component={child} />
          ))}
        </div>
      )

    case "button": {
      const label = component.label ?? component.emoji ?? "—"
      // Les boutons d'une archive ne font plus rien : seul un bouton-lien garde
      // un sens, les autres sont rendus inertes plutôt que cliquables à vide.
      if (component.url) {
        return (
          <Button variant="outline" size="sm" asChild>
            <a href={component.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              {label}
            </a>
          </Button>
        )
      }
      return (
        <Button
          variant={component.style === "danger" ? "destructive" : "secondary"}
          size="sm"
          disabled
        >
          {component.emoji && <span aria-hidden>{component.emoji}</span>}
          {component.label}
        </Button>
      )
    }

    case "select":
      return (
        <div className="min-w-0 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
          <p className="truncate">
            {component.placeholder ?? t("modules.tickets.transcript.selectMenu")}
          </p>
          {component.options.length > 0 && (
            <p className="mt-1 truncate text-xs">
              {component.options.map((o) => o.label).join(" · ")}
            </p>
          )}
        </div>
      )

    default:
      // Un bot plus récent que ce dashboard : on le dit, plutôt que d'afficher
      // un message vide qui passerait pour un bug de l'archive.
      return (
        <Badge variant="secondary">{t("modules.tickets.transcript.unsupportedComponent")}</Badge>
      )
  }
}

/** Contenu masqué (spoiler) — révélé au clic, comme dans le client Discord. */
function Spoiler({ active, children }: { active: boolean; children: React.ReactNode }) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  if (!active || revealed) return <>{children}</>

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="relative block w-full overflow-hidden rounded-lg text-left"
    >
      <div className="pointer-events-none blur-md select-none" aria-hidden>
        {children}
      </div>
      <span className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg bg-background/40 text-xs font-medium">
        <EyeOffIcon className="size-3.5" />
        {t("modules.tickets.transcript.spoiler")}
      </span>
    </button>
  )
}

function MediaImage({
  url,
  description,
  className,
}: {
  url: string | null
  description: string | null
  className?: string
}) {
  const { t } = useTranslation()

  // L'URL est le CDN de Discord : elle **expire** et personne ne la re-signe.
  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed text-muted-foreground",
          className
        )}
      >
        <ImageIcon className="size-4" />
      </div>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block min-w-0">
      <img
        src={url}
        alt={description ?? t("modules.tickets.transcript.imageAlt")}
        loading="lazy"
        className={cn("rounded-md border object-cover", className)}
      />
    </a>
  )
}

function StickerTile({ sticker }: { sticker: TranscriptSticker }) {
  if (!sticker.url) {
    return <Badge variant="secondary">{sticker.name}</Badge>
  }
  return (
    <img
      src={sticker.url}
      alt={sticker.name}
      loading="lazy"
      className="size-24 rounded-md object-contain"
    />
  )
}

// ─── Pièces jointes ───────────────────────────────────────────────────────────

/** Icône d'un fichier, d'après son type MIME — un rendu, pas un composant. */
function AttachmentIcon({ attachment }: { attachment: TranscriptAttachment }) {
  const type = attachment.content_type ?? ""
  if (type.startsWith("video/")) return <VideoIcon />
  if (type.startsWith("audio/")) return <MusicIcon />
  if (type.startsWith("image/")) return <ImageIcon />
  if (type.startsWith("text/") || type.includes("json")) return <FileTextIcon />
  return <FileIcon />
}

/**
 * Les images sont prévisualisées, le reste reste une **référence** : nom et
 * taille survivent à l'expiration du lien, l'URL non. D'où un aperçu qui bascule
 * en fiche nommée dès que l'image ne charge pas.
 */
function AttachmentList({ attachments }: { attachments: TranscriptAttachment[] }) {
  const images = attachments.filter((a) => isImageAttachment(a) && a.url)
  const files = attachments.filter((a) => !images.includes(a))

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {images.length > 0 && (
        <div
          className={cn(
            "grid min-w-0 gap-2",
            images.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"
          )}
        >
          {images.map((attachment, index) => (
            <ImagePreview key={index} attachment={attachment} />
          ))}
        </div>
      )}

      {files.length > 0 && (
        <AttachmentGroup>
          {files.map((attachment, index) => (
            <FileCard key={index} attachment={attachment} />
          ))}
        </AttachmentGroup>
      )}
    </div>
  )
}

function ImagePreview({ attachment }: { attachment: TranscriptAttachment }) {
  const [broken, setBroken] = useState(false)

  if (broken || !attachment.url) return <FileCard attachment={attachment} expired={broken} />

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block min-w-0 overflow-hidden rounded-lg border"
    >
      <img
        src={attachment.url}
        alt={attachment.filename}
        loading="lazy"
        onError={() => setBroken(true)}
        className="max-h-72 w-full object-cover"
      />
    </a>
  )
}

function FileCard({
  attachment,
  expired = false,
}: {
  attachment: TranscriptAttachment
  expired?: boolean
}) {
  const { t, i18n } = useTranslation()

  const description = [
    attachment.size ? formatBytes(attachment.size, i18n.language) : null,
    expired || !attachment.url ? t("modules.tickets.transcript.linkExpired") : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Attachment state={expired || !attachment.url ? "error" : "done"} size="sm">
      <AttachmentMedia variant="icon">
        <AttachmentIcon attachment={attachment} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.filename}</AttachmentTitle>
        {description && <AttachmentDescription>{description}</AttachmentDescription>}
      </AttachmentContent>
      {attachment.url && (
        <AttachmentActions>
          <AttachmentAction asChild>
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("modules.tickets.transcript.openAttachment")}
            >
              {expired ? <LinkIcon /> : <DownloadIcon />}
            </a>
          </AttachmentAction>
        </AttachmentActions>
      )}
    </Attachment>
  )
}
