/**
 * Historique des conversations du serveur ouvert.
 *
 * `GET /ai/conversations` rend les 30 conversations non archivées de l'appelant,
 * tous genres confondus : la page les filtre sur ce serveur. Supprimer archive
 * (`DELETE`) — rien n'est réellement effacé côté backend, et le libellé le dit.
 */

import { useTranslation } from 'react-i18next'
import { HistoryIcon, MessageSquarePlusIcon } from 'lucide-react'
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
import type { AiConversation } from '@/types/ai'

interface BrocoliHistoryProps {
  conversations: AiConversation[]
  currentId: string | null
  loading: boolean
  onOpen: (conversationId: string) => void
  onNew: () => void
}

export function BrocoliHistory({
  conversations,
  currentId,
  loading,
  onOpen,
  onNew,
}: BrocoliHistoryProps) {
  const { t, i18n } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <HistoryIcon data-icon="inline-start" />
          {t('brocoli.history.title')}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onNew}>
            <MessageSquarePlusIcon />
            {t('brocoli.history.new')}
          </DropdownMenuItem>
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
          <DropdownMenuGroup>
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
