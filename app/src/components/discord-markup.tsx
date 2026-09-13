import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { emojiCdnUrl } from "@/lib/discord-emoji"
import { formatDiscordTimestamps } from "@/lib/welcome-dm"
import { MentionPill, UserMention } from "@/components/discord-mention"
import { useDiscordMentions } from "@/lib/discord-mentions"
import type { DiscordMentionResolvers } from "@/lib/discord-mentions"

/**
 * Rendu du markdown Discord.
 *
 * Couvre ce que Discord rend réellement : gras, italique, souligné, barré,
 * spoiler, code (inline et bloc), citations, titres `#`/`##`/`###`, petit texte
 * `-#`, liens `[texte](url)`, liens nus, émojis custom `<:nom:id>` /
 * `<a:nom:id>`, **mentions** (`<@id>`, `<@&id>`, `<#id>`, `@everyone`, `@here`,
 * `</commande:id>`) et **horodatages** `<t:…>`.
 *
 * Les mentions ne sont résolues que si un `DiscordMentionProvider` en donne les
 * moyens ; sans lui, l'identifiant s'affiche tel quel plutôt que sous un nom
 * inventé. Voir `discord-mention.tsx`.
 *
 * Volontairement absent : listes et tables (Discord ne les rend pas dans une
 * bio), et l'interactivité des spoilers (l'aperçu les montre révélés).
 */

/** Ce qu'un rendu transporte de haut en bas : de quoi résoudre et dater. */
type MarkupContext = DiscordMentionResolvers & { now: number; locale: string }

// ─── Inline ───────────────────────────────────────────────────────────────────

/**
 * Un seul balayage, ordre d'alternance significatif : les délimiteurs longs
 * passent avant les courts (`**` avant `*`, `__` avant `_`), sinon `**gras**`
 * serait lu comme deux italiques vides.
 */
const INLINE_SOURCE = [
    /```(?:[a-zA-Z0-9+#-]*\n)?([\s\S]+?)```/.source, // 1 bloc de code
    /`([^`\n]+?)`/.source, //                            2 code inline
    /<(a?):(\w+):(\d+)>/.source, //                      3 animé 4 nom 5 id
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.source, //  6 texte 7 url
    /\*\*([\s\S]+?)\*\*/.source, //                      8 gras
    /__([\s\S]+?)__/.source, //                          9 souligné
    /~~([\s\S]+?)~~/.source, //                         10 barré
    /\|\|([\s\S]+?)\|\|/.source, //                     11 spoiler
    /\*([^*\n]+?)\*/.source, //                         12 italique
    /_([^_\n]+?)_/.source, //                           13 italique
    /(https?:\/\/[^\s<]+[^\s<.,:;"')\]}])/.source, //   14 lien nu
    // Les mentions arrivent après le lien nu : aucune ne commence là où une URL
    // commence, l'ordre n'a donc pas d'incidence — et ajouter à la fin évite de
    // renuméroter les groupes ci-dessus.
    /<@!?(\d{15,25})>/.source, //                       15 id utilisateur
    /<@&(\d{15,25})>/.source, //                        16 id rôle
    /<#(\d{15,25})>/.source, //                         17 id salon
    /<\/([\w -]{1,64}):(\d{15,25})>/.source, //         18 nom 19 id commande
    /<t:(-?\d{1,15})(?::[tTdDfFR])?>/.source, //        20 horodatage
    /(@everyone|@here)/.source, //                      21 mention de masse
].join("|")

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

function parseInline(text: string, keyPrefix: string, ctx: MarkupContext): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  // Regex neuve à chaque appel : la fonction se rappelle elle-même pour le
  // contenu de chaque balise, et un objet `RegExp` global partagé verrait son
  // `lastIndex` écrasé par l'appel imbriqué — boucle infinie à la clé.
  const re = new RegExp(INLINE_SOURCE, "g")
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const key = `${keyPrefix}-${match.index}`
    const [, codeBlock, codeInline, animated, emojiName, emojiId, linkText, linkUrl,
      bold, underline, strike, spoiler, italicStar, italicUnderscore, autolink,
      userId, roleId, channelId, commandName, commandId, timestampSeconds,
      globalMention] = match

    // `?? undefined` : un groupe non capturé vaut `undefined`, pas `""` — une
    // chaîne vide capturée (```` `` ````) doit rester une chaîne vide.
    if (codeBlock !== undefined) {
      nodes.push(
        <pre key={key}>
          <code>{codeBlock}</code>
        </pre>
      )
    } else if (codeInline !== undefined) {
      nodes.push(<code key={key}>{codeInline}</code>)
    } else if (emojiId !== undefined) {
      nodes.push(
        <img
          key={key}
          // `webp` + `animated=true` : le format que sert le client Discord.
          // Sans le paramètre, un émoji animé revient figé sur sa première image.
          src={emojiCdnUrl(emojiId, animated === "a")}
          alt={`:${emojiName}:`}
          className="emoji"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      )
    } else if (linkUrl !== undefined) {
      nodes.push(
        <Link key={key} href={linkUrl}>
          {parseInline(linkText, key, ctx)}
        </Link>
      )
    } else if (bold !== undefined) {
      nodes.push(<strong key={key}>{parseInline(bold, key, ctx)}</strong>)
    } else if (underline !== undefined) {
      nodes.push(<u key={key}>{parseInline(underline, key, ctx)}</u>)
    } else if (strike !== undefined) {
      nodes.push(<s key={key}>{parseInline(strike, key, ctx)}</s>)
    } else if (spoiler !== undefined) {
      nodes.push(
        <span key={key} className="dpp-spoiler">
          {parseInline(spoiler, key, ctx)}
        </span>
      )
    } else if (italicStar !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicStar, key, ctx)}</em>)
    } else if (italicUnderscore !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicUnderscore, key, ctx)}</em>)
    } else if (autolink !== undefined) {
      nodes.push(
        <Link key={key} href={autolink}>
          {autolink}
        </Link>
      )
    } else if (userId !== undefined) {
      // Le nom connu de l'appelant d'abord ; sinon `UserMention` va le chercher
      // chez Discord (cache partagé). La mention du lecteur est mise en évidence.
      nodes.push(
        <UserMention
          key={key}
          id={userId}
          name={ctx.resolveUser?.(userId) ?? null}
          highlight={Boolean(ctx.selfId) && userId === ctx.selfId}
        />
      )
    } else if (roleId !== undefined) {
      nodes.push(
        <MentionPill
          key={key}
          kind="role"
          id={roleId}
          label={`@${ctx.resolveRole?.(roleId) ?? roleId}`}
        />
      )
    } else if (channelId !== undefined) {
      nodes.push(
        <MentionPill
          key={key}
          kind="channel"
          id={channelId}
          label={`#${ctx.resolveChannel?.(channelId) ?? channelId}`}
        />
      )
    } else if (commandId !== undefined) {
      nodes.push(
        <MentionPill key={key} kind="command" id={commandId} label={`/${commandName}`} />
      )
    } else if (timestampSeconds !== undefined) {
      // Une balise d'horodatage est mise en forme par le **client** Discord :
      // brute, elle serait illisible. Le formateur est celui de l'aperçu des
      // messages de bienvenue, et `now` vient du contexte pour rester pur.
      nodes.push(
        <time key={key} dateTime={new Date(Number(timestampSeconds) * 1000).toISOString()}>
          {formatDiscordTimestamps(match[0], ctx.locale, ctx.now)}
        </time>
      )
    } else if (globalMention !== undefined) {
      // `@everyone` n'a pas d'identifiant : rien à copier, donc pas de menu.
      nodes.push(<MentionPill key={key} kind="everyone" label={globalMention} />)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))

  return nodes
}

// ─── Blocs ────────────────────────────────────────────────────────────────────

/** `#` à `###`, `-#` (petit texte) et `>` (citation), en début de ligne. */
const BLOCK_RE = /^(?:(#{1,3})\s+(.*)|(-#)\s+(.*)|>\s?(.*))$/

/**
 * Les blocs de code multilignes échappent au découpage par ligne : ils sont
 * extraits d'abord, sinon leurs `#` internes deviendraient des titres.
 */
const FENCE_SOURCE = /```(?:[a-zA-Z0-9+#-]*\n)?[\s\S]+?```/.source

function renderBlocks(text: string, keyPrefix: string, ctx: MarkupContext): ReactNode[] {
  const out: ReactNode[] = []
  const lines = text.split("\n")
  let paragraph: string[] = []
  let quote: string[] = []

  const flushParagraph = (i: number) => {
    if (paragraph.length === 0) return
    out.push(...parseInline(paragraph.join("\n"), `${keyPrefix}-p${i}`, ctx))
    paragraph = []
  }
  const flushQuote = (i: number) => {
    if (quote.length === 0) return
    out.push(
      <blockquote key={`${keyPrefix}-q${i}`}>
        {parseInline(quote.join("\n"), `${keyPrefix}-qi${i}`, ctx)}
      </blockquote>
    )
    quote = []
  }

  lines.forEach((line, i) => {
    const m = BLOCK_RE.exec(line)
    if (!m) {
      flushQuote(i)
      // Les sauts de ligne sont conservés par `white-space: break-spaces`.
      paragraph.push(line)
      return
    }
    const [, hashes, headingText, small, smallText, quoteText] = m

    if (quoteText !== undefined) {
      flushParagraph(i)
      quote.push(quoteText)
      return
    }
    flushParagraph(i)
    flushQuote(i)

    if (hashes !== undefined) {
      const Tag = (["h1", "h2", "h3"] as const)[hashes.length - 1]
      out.push(<Tag key={`${keyPrefix}-h${i}`}>{parseInline(headingText, `${keyPrefix}-hi${i}`, ctx)}</Tag>)
    } else if (small !== undefined) {
      out.push(
        <small key={`${keyPrefix}-s${i}`}>{parseInline(smallText, `${keyPrefix}-si${i}`, ctx)}</small>
      )
    }
  })

  flushParagraph(lines.length)
  flushQuote(lines.length)
  return out
}

export function DiscordMarkup({ text }: { text: string }) {
  const { i18n } = useTranslation()
  const mentions = useDiscordMentions()
  // Le contexte est reconstruit à chaque rendu, mais il n'est que lu : les
  // nœuds produits ne dépendent que de `text` et de ces valeurs.
  const ctx: MarkupContext = { ...mentions, locale: i18n.language }

  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  const fences = new RegExp(FENCE_SOURCE, "g")
  while ((match = fences.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...renderBlocks(text.slice(last, match.index), `b${last}`, ctx))
    }
    nodes.push(...parseInline(match[0], `f${match.index}`, ctx))
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(...renderBlocks(text.slice(last), `b${last}`, ctx))

  return <>{nodes}</>
}
