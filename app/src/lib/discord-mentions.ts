import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import { copyText } from '@/lib/cases'

/**
 * Résolution des mentions Discord — la partie **sans rendu**.
 *
 * Séparée de `components/discord-mention.tsx` parce qu'un module qui exporte à
 * la fois des composants et des valeurs casse le rafraîchissement à chaud de
 * Vite. Les composants restent là-bas, le contexte et les helpers vivent ici.
 */

export interface DiscordMentionResolvers {
  /** Nom affichable d'un utilisateur, ou `null` si inconnu de l'appelant. */
  resolveUser?: (id: string) => string | null
  resolveRole?: (id: string) => string | null
  resolveChannel?: (id: string) => string | null
  /**
   * Le lecteur : sa propre mention est mise en évidence, comme chez Discord.
   * C'est la seule identité dont on soit certain.
   */
  selfId?: string | null
  /**
   * Instant de référence des horodatages relatifs (`<t:…:R>`). Passé par le
   * contexte plutôt que lu pendant le rendu : un `Date.now()` dans le corps d'un
   * composant le rendrait impur.
   */
  now?: number
}

export type MentionKind = 'user' | 'role' | 'channel' | 'everyone' | 'command'

/**
 * Instant par défaut, figé au chargement du module. Les appelants qui n'ont pas
 * de mentions à résoudre (l'aperçu d'une bio) obtiennent quand même des dates
 * cohérentes, sans rendre le composant impur.
 */
const MODULE_NOW = Date.now()

export const DiscordMentionContext = createContext<DiscordMentionResolvers>({})

export function useDiscordMentions(): DiscordMentionResolvers & { now: number } {
  const context = useContext(DiscordMentionContext)
  return { ...context, now: context.now ?? MODULE_NOW }
}

/** Copie best-effort : un presse-papiers refusé se dit, il ne casse rien. */
export async function copyId(value: string, successMessage: string) {
  if (await copyText(value)) toast.success(successMessage)
  else toast.info(value)
}
