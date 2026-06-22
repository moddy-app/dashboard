import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Éditeur de texte enrichi (contentEditable) qui colore en direct :
//   • les placeholders `{token}` (bleu, gras, surligné) — affichage uniquement,
//     la valeur envoyée reste le texte brut ;
//   • la syntaxe Markdown : les marqueurs (`#`, `**`, `*`, `~~`, `` ` ``, `-#`)
//     sont grisés et le contenu est mis en forme (gras, italique, titres…).
//
// Invariant clé : dans la couche éditable, le texte rendu est STRICTEMENT
// identique au texte brut (mêmes caractères) — seul le style change. Cela permet
// de préserver la position du curseur à travers les re-rendus.
//
// Réutilisable ailleurs dans le dashboard, avec ou sans `placeholders`.
// ─────────────────────────────────────────────────────────────────────────────

export interface RichTextEditorHandle {
  /** Insère du texte à la position du curseur (ou à la fin si non focus). */
  insertText: (text: string) => void
  focus: () => void
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  /** Placeholder affiché (rendu enrichi, grisé) quand la valeur est vide. */
  placeholder?: string
  /**
   * Liste des placeholders reconnus (ex: `['{author}', '{url}']`).
   * - Fournie : seuls ces tokens sont surlignés.
   * - Omise : tout token `{…}` est surligné.
   */
  placeholders?: string[]
  maxLength?: number
  minHeight?: number
  disabled?: boolean
  className?: string
  id?: string
}

const SYNTAX = "text-muted-foreground/50"
const PLACEHOLDER_CLS =
  "text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/15 rounded-[3px] px-0.5"
const EMOJI_CLS =
  "text-blue-600 dark:text-blue-400 font-medium bg-blue-500/10 rounded-[3px] px-1"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function grey(text: string): string {
  return `<span class="${SYNTAX}">${escapeHtml(text)}</span>`
}

// Marqueurs inline : emoji custom, timestamp Discord, placeholder, gras, italique,
// barré, code. L'ordre des alternatives donne la priorité.
const INLINE_RE =
  /(<a?:\w+:\d+>)|(<t:[^>\n]*>)|(\{[a-zA-Z0-9_.]+\})|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(`[^`\n]+`)/g

function inline(seg: string, phSet: Set<string> | null, pretty: boolean): string {
  let out = ""
  let last = 0
  let m: RegExpExecArray | null
  // IMPORTANT : regex locale (et non le const partagé) car `inline` est récursif —
  // une regex `g` partagée verrait son lastIndex réinitialisé par l'appel récursif,
  // ce qui relancerait la boucle externe à l'infini (→ RangeError: invalid string length).
  const re = new RegExp(INLINE_RE.source, INLINE_RE.flags)
  while ((m = re.exec(seg))) {
    out += escapeHtml(seg.slice(last, m.index))
    const tok = m[0]
    if (m[1]) {
      // Emoji custom <:name:id>
      const name = tok.match(/<a?:(\w+):/)?.[1] ?? "emoji"
      if (pretty) {
        out += `<span class="${EMOJI_CLS}">:${escapeHtml(name)}:</span>`
      } else {
        // char-preserving : on garde tous les caractères, on grise le superflu
        const idPart = tok.slice(tok.indexOf(name) + name.length) // ":id>"
        out += grey(tok.slice(0, tok.indexOf(name))) + escapeHtml(name) + grey(idPart)
      }
    } else if (m[2]) {
      // Timestamp Discord <t:…:R>
      const inner = tok.slice(3, -1) // entre "<t:" et ">"
      out += grey("<t:") + inline(inner, phSet, pretty) + grey(">")
    } else if (m[3]) {
      // Placeholder {token}
      const known = !phSet || phSet.has(tok.toLowerCase())
      out += known
        ? `<span class="${PLACEHOLDER_CLS}">${escapeHtml(tok)}</span>`
        : escapeHtml(tok)
    } else if (m[4] || m[5]) {
      // Gras ** ou __
      const mark = tok.slice(0, 2)
      const innerB = tok.slice(2, -2)
      out += grey(mark) + `<span class="font-semibold">${inline(innerB, phSet, pretty)}</span>` + grey(mark)
    } else if (m[6] || m[7]) {
      // Italique * ou _
      const mark = tok[0]
      const innerI = tok.slice(1, -1)
      out += grey(mark) + `<span class="italic">${inline(innerI, phSet, pretty)}</span>` + grey(mark)
    } else if (m[8]) {
      // Barré ~~
      const innerS = tok.slice(2, -2)
      out += grey("~~") + `<span class="line-through">${inline(innerS, phSet, pretty)}</span>` + grey("~~")
    } else if (m[9]) {
      // Code `…`
      const innerC = tok.slice(1, -1)
      out +=
        grey("`") +
        `<span class="font-mono text-[0.9em] bg-muted rounded-[3px] px-0.5">${escapeHtml(innerC)}</span>` +
        grey("`")
    }
    last = re.lastIndex
  }
  out += escapeHtml(seg.slice(last))
  return out
}

function renderLine(line: string, phSet: Set<string> | null, pretty: boolean): string {
  // Titre # / ## / ###
  const h = line.match(/^(#{1,3})(\s+)(.*)$/)
  if (h) {
    const [, hashes, sp, rest] = h
    const size = hashes.length === 1 ? "text-lg" : hashes.length === 2 ? "text-base" : "text-sm"
    return grey(hashes + sp) + `<span class="font-bold ${size}">${inline(rest, phSet, pretty)}</span>`
  }
  // Sous-texte Discord -#
  const sub = line.match(/^(-#)(\s+)(.*)$/)
  if (sub) {
    const [, mark, sp, rest] = sub
    return grey(mark + sp) + `<span class="text-xs text-muted-foreground">${inline(rest, phSet, pretty)}</span>`
  }
  // Citation >
  const q = line.match(/^(>)(\s+)(.*)$/)
  if (q) {
    const [, mark, sp, rest] = q
    return grey(mark + sp) + `<span class="text-muted-foreground">${inline(rest, phSet, pretty)}</span>`
  }
  return inline(line, phSet, pretty)
}

function renderRichText(
  value: string,
  placeholders?: string[],
  pretty = false
): string {
  const phSet = placeholders ? new Set(placeholders.map((p) => p.toLowerCase())) : null
  return value
    .split("\n")
    .map((line) => renderLine(line, phSet, pretty))
    .join("\n")
}

// ─── Helpers curseur ─────────────────────────────────────────────────────────

function getSelectionOffsets(el: HTMLElement): [number, number] {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    const len = (el.textContent ?? "").length
    return [len, len]
  }
  const range = sel.getRangeAt(0)
  const pre = range.cloneRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  const start = pre.toString().length
  const end = start + range.toString().length
  return [start, end]
}

function setCaret(el: HTMLElement, offset: number) {
  let remaining = offset
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    remaining -= len
  }
  // Fin du contenu
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

// ─── Composant ───────────────────────────────────────────────────────────────

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    { value, onChange, placeholder, placeholders, maxLength, minHeight = 110, disabled, className, id },
    ref
  ) {
    const elRef = useRef<HTMLDivElement>(null)

    const paint = useCallback(
      (text: string) => {
        const el = elRef.current
        if (!el) return
        el.innerHTML = text ? renderRichText(text, placeholders, false) : ""
      },
      [placeholders]
    )

    const commit = useCallback(
      (text: string, caret: number) => {
        const el = elRef.current
        if (!el) return
        paint(text)
        setCaret(el, Math.min(caret, text.length))
        onChange(text)
      },
      [onChange, paint]
    )

    const handleInput = useCallback(() => {
      const el = elRef.current
      if (!el) return
      let text = el.textContent ?? ""
      let caret = getSelectionOffsets(el)[1]
      if (maxLength && text.length > maxLength) {
        text = text.slice(0, maxLength)
        caret = Math.min(caret, maxLength)
      }
      commit(text, caret)
    }, [commit, maxLength])

    const insertText = useCallback(
      (insert: string) => {
        const el = elRef.current
        if (!el) return
        const text = el.textContent ?? ""
        let [start, end] = getSelectionOffsets(el)
        if (document.activeElement !== el) {
          start = text.length
          end = text.length
        }
        let next = text.slice(0, start) + insert + text.slice(end)
        if (maxLength && next.length > maxLength) {
          next = next.slice(0, maxLength)
        }
        const caret = Math.min(start + insert.length, next.length)
        el.focus()
        commit(next, caret)
      },
      [commit, maxLength]
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          // On insère un vrai "\n" (pas de <br>/<div>) pour préserver l'invariant.
          e.preventDefault()
          insertText("\n")
        }
      },
      [insertText]
    )

    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        e.preventDefault()
        const text = e.clipboardData.getData("text/plain")
        insertText(text)
      },
      [insertText]
    )

    useImperativeHandle(ref, () => ({
      insertText,
      focus: () => elRef.current?.focus(),
    }))

    // Synchronise le DOM quand `value` change depuis l'extérieur (reset, switch…).
    useEffect(() => {
      const el = elRef.current
      if (!el) return
      if ((el.textContent ?? "") !== value) {
        paint(value)
      }
    }, [value, paint])

    return (
      <div className="relative">
        <div
          id={id}
          ref={elRef}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          style={{ minHeight }}
          className={cn(
            "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
        />
        {!value && placeholder && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground/45"
            dangerouslySetInnerHTML={{ __html: renderRichText(placeholder, placeholders, true) }}
          />
        )}
      </div>
    )
  }
)
