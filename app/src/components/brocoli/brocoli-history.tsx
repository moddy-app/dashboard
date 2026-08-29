/**
 * Menu de conversation : historique, nouvelle conversation, rafraîchissement,
 * archivage, et l'état de l'assistant (modèle, quota du jour).
 *
 * Tout est replié dans **un seul bouton** posé à côté du sélecteur de mode. Ces
 * commandes ne servent qu'entre deux conversations : leur donner un bandeau
 * permanent en haut de l'écran doublonnait le fil d'Ariane et volait une bande
 * de hauteur au fil, qui est le vrai sujet de la page.
 *
 * `GET /ai/conversations` rend les 30 conversations non archivées de l'appelant,
 * tous genres confondus : la page les filtre sur le serveur ouvert. Supprimer
 * archive (`DELETE`) — rien n'est réellement effacé côté backend, et le libellé
 * le dit.
 */

import { useTranslation } from 'react-i18next'
import { ArchiveIcon, HistoryIcon, MessageSquarePlusIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { relativeTime } from '@/lib/cases'
import { cn } from '@/lib/utils'
import type { AiConversation, AiStatus } from '@/types/ai'

interface BrocoliHistoryProps {
  conversations: AiConversation[]
  currentId: string | null
  loading: boolean
  /** Modèle et quota — affichés en pied de menu, jamais en bandeau. */
  status: AiStatus | null
  /** Un tour est en cours : rafraîchir ou archiver n'a pas de sens. */
  busy: boolean
  onOpen: (conversationId: string) => void
  onNew: () => void
  onReload: () => void
  onArchive: () => void
}

export function BrocoliHistory({
  conversations,
  currentId,
  loading,
  status,
  busy,
  onOpen,
  onNew,
  onReload,
  onArchive,
}: BrocoliHistoryProps) {
  const { t, i18n } = useTranslation()

  const quota = status?.quota
  const showQuota =
    quota && quota.messages_limit !== null && quota.messages_used_today !== null
  const exhausted = quota?.available === false

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <HistoryIcon data-icon="inline-start" />
          {t('brocoli.history.title')}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onNew}>
            <MessageSquarePlusIcon />
            {t('brocoli.history.new')}
          </DropdownMenuItem>

          {currentId && (
            <>
              <DropdownMenuItem disabled={busy} onSelect={onReload}>
                <RefreshCwIcon />
                {t('brocoli.reload')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={busy} onSelect={onArchive}>
                <ArchiveIcon />
                {t('brocoli.archive')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('brocoli.history.recent')}</DropdownMenuLabel>

        {loading ? (
          <div className="flex flex-col gap-1.5 px-2 py-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('brocoli.history.empty')}
          </p>
        ) : (
          <DropdownMenuGroup className="max-h-64 overflow-y-auto">
            {conversations.map((conversation) => (
              <DropdownMenuItem
                key={conversation.id}
                onSelect={() => onOpen(conversation.id)}
                className={cn(
                  'flex-col items-start gap-0.5',
                  conversation.id === currentId && 'bg-accent'
                )}
              >
                <span className="w-full truncate text-sm">
                  {/* Le backend n'impose pas de titre : sans lui, l'horodatage
                      est plus utile qu'un « Sans titre » répété trente fois. */}
                  {conversation.title?.trim() || t('brocoli.history.untitled')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(conversation.updated_at, i18n.language)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}

        {/* État de l'assistant : sa place est ici, consultable quand on la
            cherche, plutôt qu'affichée en permanence au-dessus du fil. */}
        {(showQuota || status?.model) && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
              {showQuota ? (
                <span className={cn('tabular-nums text-muted-foreground', exhausted && 'font-medium text-destructive')}>
                  {t('brocoli.quota', {
                    used: quota.messages_used_today,
                    limit: quota.messages_limit,
                  })}
                </span>
              ) : (
                <span />
              )}
              {status?.model && (
                <code className="truncate font-mono text-muted-foreground/70">{status.model}</code>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
