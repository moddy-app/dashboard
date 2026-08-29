/**
 * Le fil de conversation.
 *
 * Le comportement de défilement est **délégué à `MessageScroller`** — suivi du
 * flux, ancrage d'un nouveau tour près du haut, conservation de la position
 * quand une image ou un bloc de code change la hauteur, bouton « revenir au
 * dernier message ». Rien de tout ça n'est réimplémenté ici.
 *
 * Trois réglages portent l'essentiel de la sensation :
 * - `autoScroll` — on ne suit le flux que si le lecteur est déjà au bord vif ;
 *   dès qu'il remonte, on le laisse où il est.
 * - `defaultScrollPosition="last-anchor"` — une conversation rouverte s'ouvre
 *   sur le **dernier tour**, pas sur son bord absolu : on voit ce qu'on avait
 *   demandé et où commence la réponse.
 * - `scrollPreviousItemPeek` — un bandeau du tour précédent reste visible, pour
 *   que le nouveau tour ne semble pas commencer sur une page blanche.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { streamErrorKey } from '@/lib/brocoli'
import { getAvatarUrl, type User } from '@/lib/auth'
import { BrocoliActionRecord } from './brocoli-action'
import { BrocoliMarkdown } from './brocoli-markdown'
import { BrocoliToolStep } from './brocoli-tool-step'
import { renderMentionText, type MentionSource } from '@/lib/brocoli-mentions'
import type { BrocoliItem, BrocoliRunState } from '@/types/ai'

/**
 * Décalage des lignes secondaires (étapes d'outils, traces d'action) pour
 * qu'elles s'alignent sur le texte de Brocoli.
 *
 * Vaut `''` tant que l'avatar de Brocoli est désactivé : il valait la largeur
 * de l'avatar (`min-w-8`) plus le `gap-2` de `Message`, soit `ps-10`, à
 * rétablir en même temps que lui.
 */
const ASSISTANT_INDENT = ''

/** Colonne de lecture : partagée par le fil, ses squelettes et la saisie. */
export const READING_COLUMN = 'mx-auto w-full max-w-3xl px-4'

function BrocoliAvatar() {
  return (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
        <SparklesIcon className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}

// ─── Lignes du fil ────────────────────────────────────────────────────────────

function UserRow({
  text,
  user,
  mentions,
}: {
  text: string
  user: User | null
  mentions: MentionSource | null
}) {
  return (
    <Message align="end">
      <MessageAvatar>
        <Avatar className="size-8">
          {user && (
            <AvatarImage src={getAvatarUrl(user.user_id, user.avatar, user.avatar_url)} alt="" />
          )}
          <AvatarFallback>{(user?.username ?? '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </MessageAvatar>
      <MessageContent>
        <Bubble>
          {/* Message de l'utilisateur : texte brut, sauts de ligne conservés.
              Pas de markdown — il n'en a pas écrit, et l'interpréter
              transformerait un `*` littéral en italique. Seules les mentions
              sont rendues, parce qu'il les a bel et bien composées. */}
          <BubbleContent className="whitespace-pre-wrap">
            {renderMentionText(text, mentions, 'user', true)}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

function AssistantRow({
  text,
  streaming,
  mentions,
}: {
  text: string
  streaming: boolean
  mentions: MentionSource | null
}) {
  const { t } = useTranslation()

  // L'apparition mot à mot vaut pour **toute la vie du message**, pas seulement
  // pendant le flux : la couper à `run_end` remplacerait les spans par du texte
  // nu et ferait claquer les derniers mots encore en cours d'animation. Un
  // message relu depuis le transcript n'a jamais été « en flux » : il ne
  // s'anime pas, ce qui serait absurde au chargement d'une page.
  // Ajustement d'état **pendant le rendu** : lire une ref au rendu est
  // interdit, et un effet arriverait une frame trop tard.
  const [everStreamed, setEverStreamed] = useState(streaming)
  if (streaming && !everStreamed) setEverStreamed(true)

  return (
    <Message>
      {/* TEMPORAIRE — avatar de Brocoli désactivé, à remettre plus tard :
          <MessageAvatar className="self-start">
            <BrocoliAvatar />
          </MessageAvatar>
          Le décalage des étapes d'outils (`ASSISTANT_INDENT`) suit le même
          état : les deux se rétablissent ensemble. */}
      <MessageContent>
        {/* `ghost` : une réponse d'assistant se lit comme un document, pas
            comme une bulle de messagerie contrainte à 80 % de largeur. */}
        <Bubble variant="ghost">
          <BubbleContent>
            {text ? (
              <BrocoliMarkdown text={text} mentions={mentions} animate={everStreamed} />
            ) : (
              <Marker role="status" className="w-auto">
                <MarkerContent className="shimmer">{t('brocoli.thinking')}</MarkerContent>
              </Marker>
            )}
            {/* Pas de curseur de frappe : l'apparition mot à mot dit déjà que
                le texte continue d'arriver, et deux signaux pour la même chose
                se gênent. */}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

function NoticeRow({ code, message }: { code: string; message: string }) {
  const { t } = useTranslation()
  const info = code === 'max_iterations'

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        info
          ? 'border-border bg-muted/40 text-muted-foreground'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      )}
      role={info ? undefined : 'alert'}
    >
      {info ? (
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      )}
      <span className="min-w-0 wrap-break-word">
        {t(streamErrorKey(code as never), { defaultValue: message || t('brocoli.streamErrors.internal') })}
      </span>
    </div>
  )
}

/**
 * Suit le bas du fil pendant qu'un tour coule.
 *
 * `MessageScroller` ne suit de lui-même que si le lecteur est déjà au bord vif —
 * c'est sa règle de base, et elle est bonne. Mais un tour s'ouvre en **ancrant**
 * le message de l'utilisateur près du haut : la réponse grandit alors dans le
 * vide en dessous, le viewport n'est plus au bord, et rien ne défile tant que
 * la réponse n'a pas rempli l'écran. On rappelle donc explicitement le bas à
 * chaque fragment.
 *
 * L'échappatoire compte autant que le suivi : dès que le lecteur remonte
 * (molette, tactile, clavier), on lâche prise jusqu'au tour suivant. Sinon on
 * le ramènerait de force au bas du fil pendant qu'il relit — exactement ce
 * qu'une conversation en flux ne doit jamais faire.
 */
function StreamFollower({ active, signal }: { active: boolean; signal: number }) {
  const { scrollToEnd } = useMessageScroller()
  const releasedRef = useRef(false)

  useEffect(() => {
    if (!active) {
      // Un nouveau tour reprend le suivi : le lecteur n'a rien demandé encore.
      releasedRef.current = false
      return
    }
    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="message-scroller-viewport"]'
    )
    if (!viewport) return

    const release = () => {
      releasedRef.current = true
    }
    // Toutes les façons de reprendre la main, pas seulement la molette.
    viewport.addEventListener('wheel', release, { passive: true })
    viewport.addEventListener('touchmove', release, { passive: true })
    viewport.addEventListener('keydown', release)
    return () => {
      viewport.removeEventListener('wheel', release)
      viewport.removeEventListener('touchmove', release)
      viewport.removeEventListener('keydown', release)
    }
  }, [active])

  useEffect(() => {
    if (active && !releasedRef.current) scrollToEnd()
  }, [active, signal, scrollToEnd])

  return null
}

// ─── Fil ──────────────────────────────────────────────────────────────────────

interface BrocoliTranscriptProps {
  items: BrocoliItem[]
  runState: BrocoliRunState
  loading: boolean
  user: User | null
  /** Salons et rôles du serveur, pour rendre `#salon` / `@rôle` en pastilles. */
  mentions: MentionSource | null
  /** Rendu quand le fil est vide (accueil, suggestions). */
  emptyState: React.ReactNode
}

export function BrocoliTranscript({
  items,
  runState,
  loading,
  user,
  mentions,
  emptyState,
}: BrocoliTranscriptProps) {
  /**
   * Ce qui dit « quelque chose a bougé en bas du fil ». La longueur du texte
   * suffirait à suivre la frappe, mais raterait tout ce qui change la hauteur
   * sans écrire un mot : une étape d'outil qui apparaît ou se termine, et
   * surtout une action qu'on vient de décider — la reprise du tour est
   * justement le moment où l'on veut être ramené en bas.
   */
  const streamSignal = items.reduce((total, item) => {
    if (item.kind === 'assistant') return total + 1 + item.text.length
    if (item.kind === 'tool') return total + 1 + item.state.length
    if (item.kind === 'action') {
      return total + 1 + item.action.status.length + (item.submitted ? 1 : 0)
    }
    return total + 1
  }, 0)

  if (loading) {
    return (
      <div className={cn('flex flex-1 flex-col gap-6 py-2', READING_COLUMN)} aria-busy>
        <Skeleton className="h-16 w-3/5 self-end rounded-3xl" />
        <Skeleton className="h-28 w-4/5 rounded-3xl" />
        <Skeleton className="h-16 w-2/5 self-end rounded-3xl" />
      </div>
    )
  }

  if (items.length === 0) {
    return <div className="flex flex-1 items-center justify-center px-4">{emptyState}</div>
  }

  return (
    <MessageScrollerProvider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={56}
      // Seuil généreux : « près du bas » suffit à considérer que le lecteur
      // suit le flux. Trop serré, le suivi se décrochait au moindre fragment
      // qui dépassait d'une ligne.
      scrollEdgeThreshold={200}
    >
      <StreamFollower active={runState === 'streaming'} signal={streamSignal} />
      <MessageScroller className="flex-1">
        {/* Le viewport reste pleine largeur — la barre de défilement au bord
            de l'écran, comme partout ailleurs — et seul le *contenu* est borné
            à une colonne de lecture : au-delà, une ligne de texte devient trop
            longue pour que l'œil retrouve la suivante. */}
        <MessageScrollerViewport>
          <MessageScrollerContent
            className={cn('gap-6 py-2', READING_COLUMN)}
            // Le transcript est une région live : pendant un tour, on demande
            // aux lecteurs d'écran d'attendre le message complet plutôt que
            // d'annoncer chaque fragment.
            aria-busy={runState === 'streaming'}
          >
            {items.map((item) => {
              switch (item.kind) {
                case 'user':
                  return (
                    // Ancre de tour : c'est le message de l'utilisateur qui
                    // ouvre un échange, donc lui que le viewport amène en haut.
                    <MessageScrollerItem key={item.id} messageId={item.id} scrollAnchor>
                      <UserRow text={item.text} user={user} mentions={mentions} />
                    </MessageScrollerItem>
                  )

                case 'assistant':
                  return (
                    <MessageScrollerItem key={item.id} messageId={item.id}>
                      <AssistantRow text={item.text} streaming={item.streaming} mentions={mentions} />
                    </MessageScrollerItem>
                  )

                case 'tool':
                  return (
                    <MessageScrollerItem key={item.id} messageId={item.id}>
                      <div className={ASSISTANT_INDENT}>
                        <BrocoliToolStep item={item} />
                      </div>
                    </MessageScrollerItem>
                  )

                case 'action':
                  return (
                    // Une simple trace : la décision se prend dans le panneau
                    // épinglé au-dessus de la saisie, pas ici. Une carte
                    // entière par action rendrait un long fil illisible.
                    <MessageScrollerItem key={item.id} messageId={item.id}>
                      <div className={ASSISTANT_INDENT}>
                        <BrocoliActionRecord action={item.action} submitted={item.submitted} />
                      </div>
                    </MessageScrollerItem>
                  )

                case 'notice':
                  return (
                    <MessageScrollerItem key={item.id} messageId={item.id}>
                      <div className={ASSISTANT_INDENT}>
                        <NoticeRow code={item.code} message={item.message} />
                      </div>
                    </MessageScrollerItem>
                  )
              }
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export { BrocoliAvatar }
