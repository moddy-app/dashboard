import type { ReactNode } from 'react'
import React from 'react'

/**
 * Cible de lien acceptée : URL absolue `http(s)` ou chemin relatif du site
 * (`/…`, mais pas `//hôte`, qui changerait d'origine). Un `javascript:`,
 * `data:` ou `vbscript:` est rendu en texte : le texte vient d'un backend de
 * confiance, ce contrôle est une seconde ligne de défense.
 */
export function isSafeInlineHref(url: string): boolean {
  const href = url.trim()
  if (href.startsWith('/')) return !href.startsWith('//') && !href.startsWith('/\\')
  try {
    const { protocol } = new URL(href)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Markdown inline minimal (gras, italique, lien) pour les bandeaux dont le
 * texte vient d'un backend contrôlé (jamais de contenu utilisateur). Pas de
 * blocs, pas d'images — un parser maison itératif évite une dépendance.
 */
export function parseInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch && !isSafeInlineHref(linkMatch[2])) {
      nodes.push(linkMatch[1])
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }
    if (linkMatch) {
      nodes.push(
        React.createElement(
          'a',
          {
            key: key++,
            href: linkMatch[2].trim(),
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'underline underline-offset-2',
          },
          linkMatch[1]
        )
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      nodes.push(React.createElement('strong', { key: key++ }, boldMatch[1]))
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      nodes.push(React.createElement('em', { key: key++ }, italicMatch[1]))
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const nextSpecial = remaining.search(/\[|\*/)
    if (nextSpecial === -1) {
      nodes.push(remaining)
      remaining = ''
    } else if (nextSpecial === 0) {
      nodes.push(remaining[0])
      remaining = remaining.slice(1)
    } else {
      nodes.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    }
  }

  return nodes
}
