import type { ReactNode } from "react"

/**
 * Rendu du markdown Discord, pour l'aperçu de la bio du bot.
 *
 * Couvre ce que Discord rend réellement dans une description de profil :
 * gras, italique, souligné, barré, spoiler, code (inline et bloc), citations,
 * titres `#`/`##`/`###`, petit texte `-#`, liens `[texte](url)`, liens nus et
 * émojis custom `<:nom:id>` / `<a:nom:id>`.
 *
 * Volontairement absent : listes et tables (Discord ne les rend pas dans une
 * bio), et l'interactivité des spoilers (l'aperçu les montre révélés).
 */

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
].join("|")

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  )
}

function parseInline(text: string, keyPrefix: string): ReactNode[] {
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
      bold, underline, strike, spoiler, italicStar, italicUnderscore, autolink] = match

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
      const ext = animated === "a" ? "gif" : "png"
      nodes.push(
        <img
          key={key}
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=32`}
          alt={`:${emojiName}:`}
          className="emoji"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      )
    } else if (linkUrl !== undefined) {
      nodes.push(
        <Link key={key} href={linkUrl}>
          {parseInline(linkText, key)}
        </Link>
      )
    } else if (bold !== undefined) {
      nodes.push(<strong key={key}>{parseInline(bold, key)}</strong>)
    } else if (underline !== undefined) {
      nodes.push(<u key={key}>{parseInline(underline, key)}</u>)
    } else if (strike !== undefined) {
      nodes.push(<s key={key}>{parseInline(strike, key)}</s>)
    } else if (spoiler !== undefined) {
      nodes.push(
        <span key={key} className="dpp-spoiler">
          {parseInline(spoiler, key)}
        </span>
      )
    } else if (italicStar !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicStar, key)}</em>)
    } else if (italicUnderscore !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicUnderscore, key)}</em>)
    } else if (autolink !== undefined) {
      nodes.push(
        <Link key={key} href={autolink}>
          {autolink}
        </Link>
      )
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

function renderBlocks(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const lines = text.split("\n")
  let paragraph: string[] = []
  let quote: string[] = []

  const flushParagraph = (i: number) => {
    if (paragraph.length === 0) return
    out.push(...parseInline(paragraph.join("\n"), `${keyPrefix}-p${i}`))
    paragraph = []
  }
  const flushQuote = (i: number) => {
    if (quote.length === 0) return
    out.push(
      <blockquote key={`${keyPrefix}-q${i}`}>
        {parseInline(quote.join("\n"), `${keyPrefix}-qi${i}`)}
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
      out.push(<Tag key={`${keyPrefix}-h${i}`}>{parseInline(headingText, `${keyPrefix}-hi${i}`)}</Tag>)
    } else if (small !== undefined) {
      out.push(
        <small key={`${keyPrefix}-s${i}`}>{parseInline(smallText, `${keyPrefix}-si${i}`)}</small>
      )
    }
  })

  flushParagraph(lines.length)
  flushQuote(lines.length)
  return out
}

export function DiscordMarkup({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  const fences = new RegExp(FENCE_SOURCE, "g")
  while ((match = fences.exec(text)) !== null) {
    if (match.index > last) nodes.push(...renderBlocks(text.slice(last, match.index), `b${last}`))
    nodes.push(...parseInline(match[0], `f${match.index}`))
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(...renderBlocks(text.slice(last), `b${last}`))

  return <>{nodes}</>
}
