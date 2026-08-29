/**
 * Rendu du texte de Brocoli.
 *
 * ⚠️ **Jamais de HTML brut.** Brocoli cite des pseudos, des noms de salons et
 * des valeurs de configuration écrits par des tiers : le texte est parsé en
 * nœuds React, sans `dangerouslySetInnerHTML`, donc aucune injection n'est
 * possible même si le contenu est hostile.
 *
 * Markdown volontairement **restreint** à ce qu'un assistant produit vraiment :
 * titres, listes à puces et numérotées, gras / italique / barré, code inline et
 * blocs, citations, filets, liens. Pas de tables, pas d'images, pas de HTML.
 *
 * Distinct de `DiscordMarkup` (`src/components/discord-markup.tsx`), qui rend la
 * grammaire *de Discord* (spoilers, émojis custom, `-#`) pour l'aperçu d'une
 * bio : les deux dialectes ne se recouvrent pas et les mélanger ferait rendre à
 * chacun des balises que l'autre n'écrit jamais.
 */

import { memo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { renderMentionText, type MentionSource } from '@/lib/brocoli-mentions'

// ─── Liens ────────────────────────────────────────────────────────────────────

/**
 * Seuls `http`/`https` sont suivis. Un `javascript:` ou un `data:` glissé dans
 * un lien markdown est rendu en texte : c'est la seconde ligne de défense, le
 * parseur ne reconnaissant déjà que des URL absolues en `http(s)`.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  if (!isSafeUrl(href)) return <>{children}</>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-3 hover:no-underline"
    >
      {children}
    </a>
  )
}

// ─── Inline ───────────────────────────────────────────────────────────────────

/**
 * Un seul balayage. L'ordre d'alternance est significatif : les délimiteurs
 * longs passent avant les courts (`**` avant `*`), sinon `**gras**` serait lu
 * comme deux italiques vides.
 */
const INLINE_SOURCE = [
  /`([^`\n]+?)`/.source, //                             1 code inline
  /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/.source, //   2 texte 3 url
  /\*\*([\s\S]+?)\*\*/.source, //                       4 gras
  /__([\s\S]+?)__/.source, //                           5 gras
  /~~([\s\S]+?)~~/.source, //                           6 barré
  /\*([^*\n]+?)\*/.source, //                           7 italique
  /_([^_\n]+?)_/.source, //                             8 italique
  /(https?:\/\/[^\s<]+[^\s<.,:;"')\]}])/.source, //     9 lien nu
].join('|')

function parseInline(
  text: string,
  keyPrefix: string,
  mentions: MentionSource | null
): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  // Regex neuve à chaque appel : `parseInline` se rappelle elle-même pour le
  // contenu de chaque balise, et un objet `RegExp` global partagé au niveau du
  // module verrait son `lastIndex` écrasé par l'appel imbriqué — boucle
  // infinie, onglet figé.
  const re = new RegExp(INLINE_SOURCE, 'g')

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      // Seul le texte **nu** est balayé : à l'intérieur d'un `code` ou d'une URL,
      // un `#` n'est pas une mention.
      nodes.push(...renderMentionText(text.slice(last, match.index), mentions, `${keyPrefix}-${last}`))
    }
    const key = `${keyPrefix}-${match.index}`
    const [, code, linkText, linkUrl, boldStar, boldScore, strike, italicStar, italicScore, autolink] =
      match

    if (code !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] wrap-anywhere"
        >
          {code}
        </code>
      )
    } else if (linkUrl !== undefined) {
      nodes.push(
        <Link key={key} href={linkUrl}>
          {parseInline(linkText, key, mentions)}
        </Link>
      )
    } else if (boldStar !== undefined) {
      nodes.push(<strong key={key}>{parseInline(boldStar, key, mentions)}</strong>)
    } else if (boldScore !== undefined) {
      nodes.push(<strong key={key}>{parseInline(boldScore, key, mentions)}</strong>)
    } else if (strike !== undefined) {
      nodes.push(<s key={key}>{parseInline(strike, key, mentions)}</s>)
    } else if (italicStar !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicStar, key, mentions)}</em>)
    } else if (italicScore !== undefined) {
      nodes.push(<em key={key}>{parseInline(italicScore, key, mentions)}</em>)
    } else if (autolink !== undefined) {
      nodes.push(
        <Link key={key} href={autolink}>
          {autolink}
        </Link>
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    nodes.push(...renderMentionText(text.slice(last), mentions, `${keyPrefix}-${last}`))
  }
  return nodes
}

// ─── Blocs ────────────────────────────────────────────────────────────────────

const HEADING_RE = /^(#{1,4})\s+(.*)$/
const BULLET_RE = /^\s*[-*+]\s+(.*)$/
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/
const FENCE_RE = /^\s*```([a-zA-Z0-9+#._-]*)\s*$/

const HEADING_CLASS = [
  'mt-4 mb-2 text-base font-semibold first:mt-0',
  'mt-4 mb-2 text-[0.95rem] font-semibold first:mt-0',
  'mt-3 mb-1.5 text-sm font-semibold first:mt-0',
  'mt-3 mb-1.5 text-sm font-medium first:mt-0',
]

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <pre className="my-2 overflow-x-auto rounded-lg border bg-muted/60 p-3 first:mt-0 last:mb-0">
      <code className={cn('font-mono text-xs leading-relaxed', language && `language-${language}`)}>
        {code}
      </code>
    </pre>
  )
}

/**
 * Découpe le texte en blocs. Les blocs de code sont extraits **en premier** :
 * sinon leurs `#` internes deviendraient des titres et leurs `-` des puces.
 */
function renderBlocks(source: string, mentions: MentionSource | null): ReactNode[] {
  const lines = source.split('\n')
  const out: ReactNode[] = []

  let paragraph: string[] = []
  let bullets: string[] = []
  let ordered: string[] = []
  let quote: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    const text = paragraph.join('\n').trim()
    paragraph = []
    if (!text) return
    out.push(
      <p key={`p${out.length}`} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">
        {parseInline(text, `p${out.length}`, mentions)}
      </p>
    )
  }
  const flushBullets = () => {
    if (bullets.length === 0) return
    const entries = bullets
    bullets = []
    out.push(
      <ul key={`u${out.length}`} className="my-2 flex list-disc flex-col gap-1 pl-5 first:mt-0 last:mb-0">
        {entries.map((entry, i) => (
          <li key={i}>{parseInline(entry, `u${out.length}-${i}`, mentions)}</li>
        ))}
      </ul>
    )
  }
  const flushOrdered = () => {
    if (ordered.length === 0) return
    const entries = ordered
    ordered = []
    out.push(
      <ol key={`o${out.length}`} className="my-2 flex list-decimal flex-col gap-1 pl-5 first:mt-0 last:mb-0">
        {entries.map((entry, i) => (
          <li key={i}>{parseInline(entry, `o${out.length}-${i}`, mentions)}</li>
        ))}
      </ol>
    )
  }
  const flushQuote = () => {
    if (quote.length === 0) return
    const text = quote.join('\n')
    quote = []
    out.push(
      <blockquote
        key={`q${out.length}`}
        className="my-2 border-l-2 border-border pl-3 text-muted-foreground first:mt-0 last:mb-0"
      >
        {parseInline(text, `q${out.length}`, mentions)}
      </blockquote>
    )
  }
  /** Tout sauf le type de bloc qu'on s'apprête à ouvrir. */
  const flushAll = () => {
    flushParagraph()
    flushBullets()
    flushOrdered()
    flushQuote()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Bloc de code : on consomme jusqu'à la clôture, ou jusqu'à la fin du texte
    // — pendant le stream, la clôture n'est pas encore arrivée et le bloc doit
    // quand même s'afficher au lieu de faire disparaître la réponse.
    const fence = FENCE_RE.exec(line)
    if (fence) {
      flushAll()
      const body: string[] = []
      i++
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        body.push(lines[i])
        i++
      }
      out.push(<CodeBlock key={`c${out.length}`} code={body.join('\n')} language={fence[1]} />)
      continue
    }

    if (RULE_RE.test(line)) {
      flushAll()
      out.push(<hr key={`h${out.length}`} className="my-3 border-border" />)
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      flushAll()
      const level = heading[1].length
      const Tag = (['h3', 'h4', 'h5', 'h6'] as const)[level - 1]
      out.push(
        <Tag key={`t${out.length}`} className={HEADING_CLASS[level - 1]}>
          {parseInline(heading[2], `t${out.length}`, mentions)}
        </Tag>
      )
      continue
    }

    const quoteLine = QUOTE_RE.exec(line)
    if (quoteLine) {
      flushParagraph()
      flushBullets()
      flushOrdered()
      quote.push(quoteLine[1])
      continue
    }

    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      flushParagraph()
      flushOrdered()
      flushQuote()
      bullets.push(bullet[1])
      continue
    }

    const orderedLine = ORDERED_RE.exec(line)
    if (orderedLine) {
      flushParagraph()
      flushBullets()
      flushQuote()
      ordered.push(orderedLine[2])
      continue
    }

    // Ligne vide : ferme le bloc courant plutôt que de coller deux paragraphes.
    if (line.trim() === '') {
      flushAll()
      continue
    }

    flushBullets()
    flushOrdered()
    flushQuote()
    paragraph.push(line)
  }

  flushAll()
  return out
}

/**
 * `text` peut être partiel (fragment de flux) : le rendu doit rester correct à
 * chaque frame, d'où des blocs tolérants à une syntaxe non terminée.
 */
export const BrocoliMarkdown = memo(function BrocoliMarkdown({
  text,
  className,
  mentions = null,
}: {
  text: string
  className?: string
  /** Salons et rôles du serveur, pour rendre `#salon` / `@rôle` en pastilles. */
  mentions?: MentionSource | null
}) {
  return (
    <div className={cn('min-w-0 text-sm leading-relaxed', className)}>
      {renderBlocks(text, mentions)}
    </div>
  )
})
