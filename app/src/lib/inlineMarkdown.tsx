import type { ReactNode } from "react"

/**
 * Renders the tiny markdown subset the status banner API emits: `**bold**`
 * and a single `[text](url)` link. No dependency on a full markdown
 * parser — the payload is constrained to these two constructs — and text
 * segments stay as React text nodes (never `dangerouslySetInnerHTML`), so
 * there's nothing to sanitize.
 */
export function renderInlineMarkdown(text: string): ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>)
    } else {
      nodes.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:opacity-80"
        >
          {match[2]}
        </a>
      )
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}
