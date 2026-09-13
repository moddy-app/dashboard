import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CopyIcon } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useUserProfile } from "@/hooks/useProfile"
import { DiscordMentionContext, copyId } from "@/lib/discord-mentions"
import type { DiscordMentionResolvers, MentionKind } from "@/lib/discord-mentions"
import { cn } from "@/lib/utils"

/**
 * Mentions Discord — le rendu.
 *
 * Un message d'archive porte la syntaxe du client Discord : `<@123>`, `<@&123>`,
 * `<#123>`, `@everyone`, `@here`, `</commande:123>`. Le dashboard n'est pas le
 * client Discord : personne ne résout ces identifiants pour lui. Deux règles en
 * découlent, et elles tiennent tout ce fichier.
 *
 * **1. Un utilisateur mentionné est résolu, pas deviné.** L'archive ne connaît
 * que les *auteurs* des messages (`authors[]`, instantané pris à la fermeture) :
 * quelqu'un qui a été mentionné sans jamais parler n'y figure pas. Pour ceux-là
 * on interroge Discord via `useUserProfile` — `GET /users/{id}/profile`, avec
 * repli sur `GET /users/{id}` qui est **public**, donc lisible même par un compte
 * suspendu. Le cache est au niveau du module : un id n'est résolu qu'une fois par
 * session, même mentionné cent fois.
 *
 * Rôles et salons n'ont **pas** d'équivalent : aucun endpoint ne résout un rôle
 * ou un salon hors du contexte d'un serveur qu'on administre, et le lecteur d'une
 * archive n'administre pas forcément ce serveur. Leur identifiant s'affiche donc
 * tel quel — jamais sous un nom inventé, jamais masqué.
 *
 * **2. Une pastille n'est pas un lien.** Cliquer une mention dans une archive
 * n'a aucun sens (le salon peut avoir été supprimé, le membre être parti). Le
 * clic droit, lui, copie l'identifiant : c'est ce qu'on vient y chercher.
 */

export function DiscordMentionProvider({
  children,
  resolveUser,
  resolveRole,
  resolveChannel,
  selfId,
  now,
}: DiscordMentionResolvers & { children: ReactNode }) {
  const value = useMemo(
    () => ({ resolveUser, resolveRole, resolveChannel, selfId, now }),
    [resolveUser, resolveRole, resolveChannel, selfId, now]
  )
  return <DiscordMentionContext.Provider value={value}>{children}</DiscordMentionContext.Provider>
}

/**
 * Une mention rendue. `id` absent pour `@everyone` / `@here` : il n'y a rien à
 * copier, et le menu contextuel ne s'affiche donc pas.
 */
export function MentionPill({
  kind,
  id,
  label,
  highlight = false,
}: {
  kind: MentionKind
  id?: string | null
  label: string
  highlight?: boolean
}) {
  const { t } = useTranslation()

  const pill = (
    <span
      className={cn(
        "rounded px-1 py-px font-medium",
        // Une mention du lecteur est plus marquée, comme chez Discord.
        highlight ? "bg-primary/25 text-primary" : "bg-primary/10 text-primary hover:bg-primary/20"
      )}
      // L'identifiant brut reste accessible au survol : c'est la donnée, le
      // nom n'en est qu'une lecture.
      title={id ?? undefined}
      data-mention={kind}
      data-mention-id={id ?? undefined}
    >
      {label}
    </span>
  )

  if (!id) return pill

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{pill}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuLabel>{t(`mentions.kinds.${kind}`)}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => void copyId(id, t("mentions.copied"))}>
            <CopyIcon />
            {t("mentions.copyId")}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Mention d'un utilisateur. Le nom vient d'abord de ce que l'appelant sait (les
 * auteurs de l'archive), sinon d'un appel réseau **mutualisé et mis en cache**.
 *
 * `useUserProfile(null)` ne déclenche aucune requête : le hook est donc appelé
 * inconditionnellement — comme l'exigent les règles des hooks — tout en ne
 * coûtant rien quand le nom est déjà connu.
 */
export function UserMention({
  id,
  name,
  highlight = false,
}: {
  id: string
  /** Nom déjà connu de l'appelant, ou `null` pour le faire résoudre. */
  name: string | null
  highlight?: boolean
}) {
  const profile = useUserProfile(name ? null : id)
  // Tant que la résolution n'a pas abouti (chargement, échec, utilisateur
  // supprimé), l'identifiant reste affiché : c'est la donnée, et elle est vraie.
  const resolved = name ?? profile.data?.display_name ?? id

  return <MentionPill kind="user" id={id} label={`@${resolved}`} highlight={highlight} />
}
