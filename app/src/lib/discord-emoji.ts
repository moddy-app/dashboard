// Émojis personnalisés de Discord.
//
// Un émoji custom n'est pas un caractère : c'est une **image du CDN**, servie en
// `webp` (le format que le client Discord demande aujourd'hui). Un émoji animé
// ne bouge que si `animated=true` accompagne la requête — sans ce paramètre, le
// CDN renvoie la première image fixe.
//
// Le seul endroit du code qui connaît cette URL, pour que le markdown, les
// réactions, les boutons et les autocollants la fabriquent tous pareil.

const CDN = 'https://cdn.discordapp.com/emojis'

export function emojiCdnUrl(id: string, animated: boolean, size = 48): string {
  const params = new URLSearchParams({ size: String(size) })
  if (animated) params.set('animated', 'true')
  return `${CDN}/${id}.webp?${params.toString()}`
}

/** `<a:party:123>` / `<:hug:456>` — la syntaxe que Discord met dans le texte. */
const EMOJI_TOKEN = /^<(a?):([^:\s]+):(\d+)>$/

export interface ParsedEmoji {
  name: string
  id: string
  animated: boolean
}

/**
 * Reconnaît un jeton d'émoji custom **seul** (une réaction, un libellé de
 * bouton). Rend `null` pour un émoji Unicode, qui est du texte et se rend comme
 * tel — inutile d'aller chercher une image pour un 👍.
 */
export function parseEmojiToken(value: string): ParsedEmoji | null {
  const match = EMOJI_TOKEN.exec(value.trim())
  if (!match) return null
  return { animated: match[1] === 'a', name: match[2], id: match[3] }
}
