import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CopyIcon, ExternalLinkIcon, HashIcon, ServerIcon, TextIcon, UserIcon } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { copyId } from "@/lib/discord-mentions"
import type { TranscriptDetail, TranscriptMessage } from "@/types/transcripts"

/**
 * Clic droit sur un message d'archive : copier les identifiants.
 *
 * Une archive est ce qu'on ouvre **pour enquêter** — retrouver un membre dans la
 * base, chercher un salon, coller une référence dans un autre ticket. Or tout y
 * est rendu sous forme lisible (un pseudo, un nom de salon), et l'identifiant,
 * la seule donnée stable, n'apparaît nulle part. Le clic droit est l'endroit où
 * Discord lui-même le met : on garde le geste.
 *
 * Le lien « ouvrir dans Discord » n'est proposé que si le salon est connu —
 * `channel_id` est `null` sur une archive dont le salon a été supprimé, et une
 * URL construite sur un trou mènerait à une page d'erreur.
 */
export function MessageContextMenu({
  message,
  transcript,
  authorLabel,
  children,
}: {
  message: TranscriptMessage
  transcript: TranscriptDetail
  authorLabel: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const copied = t("mentions.copied")

  const discordUrl =
    transcript.guild_id && transcript.channel_id
      ? `https://discord.com/channels/${transcript.guild_id}/${transcript.channel_id}/${message.id}`
      : null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuGroup>
          <ContextMenuLabel className="truncate">{authorLabel}</ContextMenuLabel>
          {/* Un message peut n'être fait que d'images ou de composants : sans
              texte, l'entrée n'aurait rien à copier. */}
          {message.content && (
            <ContextMenuItem onSelect={() => void copyId(message.content ?? "", copied)}>
              <TextIcon />
              {t("modules.tickets.transcript.contextMenu.copyText")}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => void copyId(message.id, copied)}>
            <CopyIcon />
            {t("modules.tickets.transcript.contextMenu.copyMessageId")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void copyId(message.author_id, copied)}>
            <UserIcon />
            {t("modules.tickets.transcript.contextMenu.copyUserId")}
          </ContextMenuItem>
        </ContextMenuGroup>

        <ContextMenuSeparator />

        <ContextMenuGroup>
          {transcript.channel_id && (
            <ContextMenuItem onSelect={() => void copyId(transcript.channel_id ?? "", copied)}>
              <HashIcon />
              {t("modules.tickets.transcript.contextMenu.copyChannelId")}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => void copyId(transcript.guild_id, copied)}>
            <ServerIcon />
            {t("modules.tickets.transcript.contextMenu.copyGuildId")}
          </ContextMenuItem>
        </ContextMenuGroup>

        {discordUrl && (
          <>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuItem asChild>
                <a href={discordUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon />
                  {t("modules.tickets.transcript.contextMenu.openInDiscord")}
                </a>
              </ContextMenuItem>
            </ContextMenuGroup>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Clic droit sur une personne (liste des participants, en-tête d'un groupe) :
 * copier son identifiant. Même geste, cible différente.
 */
export function UserContextMenu({
  userId,
  label,
  children,
}: {
  userId: string
  label: string
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuGroup>
          <ContextMenuLabel className="truncate">{label}</ContextMenuLabel>
          <ContextMenuItem onSelect={() => void copyId(userId, t("mentions.copied"))}>
            <CopyIcon />
            {t("modules.tickets.transcript.contextMenu.copyUserId")}
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
