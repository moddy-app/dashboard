/**
 * Pastille d'une mention `#salon` / `@rôle` reconnue.
 *
 * Purement locale : la logique de résolution vit dans `@/lib/brocoli-mentions`.
 * Un nom inconnu n'arrive jamais ici — il reste du texte, plutôt qu'une
 * pastille qui laisserait croire que le salon existe.
 */

import { HashIcon, AtSignIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MentionTarget {
  kind: 'channel' | 'role'
  id: string
  name: string
}

export function MentionChip({
  target,
  onAccent = false,
}: {
  target: MentionTarget
  /**
   * Posée sur une surface déjà remplie en `primary` — la bulle de
   * l'utilisateur. Sans ça, la pastille peindrait du `text-primary` sur un fond
   * `primary` : elle devient littéralement invisible.
   */
  onAccent?: boolean
}) {
  const Icon = target.kind === 'channel' ? HashIcon : AtSignIcon
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 rounded-md px-1 py-px align-baseline font-medium',
        onAccent
          ? 'bg-primary-foreground/20 text-primary-foreground'
          : 'bg-primary/10 text-primary'
      )}
      // Le titre porte la nature exacte : deux pastilles se ressemblent, un
      // salon et un rôle ne se confondent pas pour autant.
      title={target.kind === 'channel' ? `#${target.name}` : `@${target.name}`}
    >
      <Icon className="size-3 self-center" aria-hidden />
      {target.name}
    </span>
  )
}
