/**
 * Brocoli — assistant IA de configuration d'un serveur.
 *
 * Route : `/servers/:guildId/brocoli`.
 *
 * L'écran assemble trois choses et rien d'autre : le fil (`BrocoliTranscript`),
 * la saisie (`BrocoliComposer`) et les encarts d'erreur. Toute la logique de
 * tour vit dans `useBrocoli`.
 *
 * Deux garde-fous ici :
 * - `enabled: false` de `GET /ai/status` → la page n'est pas rendue du tout (et
 *   l'entrée de navigation est déjà masquée) : un bouton qui répond `503` est
 *   pire que pas de bouton ;
 * - un `403` ferme la conversation et renvoie à une conversation neuve — c'est
 *   une **fin** de conversation (accès au serveur perdu), pas une erreur
 *   passagère à réessayer.
 */

import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRightIcon,
  MessageSquarePlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorPage } from '@/components/error-state'
import { BrocoliComposer } from '@/components/brocoli/brocoli-composer'
import { BrocoliHistory } from '@/components/brocoli/brocoli-history'
import { BrocoliActionPanel } from '@/components/brocoli/brocoli-action'
import { BrocoliTranscript, READING_COLUMN } from '@/components/brocoli/brocoli-transcript'
import { useMentionSource } from '@/lib/brocoli-mentions'
import { useAiStatus } from '@/hooks/useAiStatus'
import { useBrocoli, type BrocoliError } from '@/hooks/useBrocoli'
import { isActionDecidable } from '@/lib/brocoli'
import { useGuildContext } from '@/contexts/GuildContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

// ─── Encart d'erreur ──────────────────────────────────────────────────────────

function ErrorNotice({
  error,
  onDismiss,
  onReload,
}: {
  error: BrocoliError
  onDismiss: () => void
  onReload: () => void
}) {
  const { t } = useTranslation()

  // Le message du backend fait foi quand il en porte un : sur un `429` il
  // précise *quel* quota a sauté (utilisateur ou serveur), sur un `409` il
  // distingue « tour en cours » de « action déjà traitée ». Le réécrire
  // perdrait cette information.
  const detail = error.message.trim()
  const minutes = error.retryAfter !== null ? Math.ceil(error.retryAfter / 60) : null

  const body =
    error.kind === 'quota' && minutes !== null
      ? `${detail || t('brocoli.errors.quota')} ${t('brocoli.errors.retryIn', { minutes })}`
      : detail || t(`brocoli.errors.${error.kind}`)

  // Un `409` se répare en relisant l'état réel, jamais en réessayant en boucle.
  const canReload = error.kind === 'conflict' || error.kind === 'transport'

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <TriangleAlertIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 wrap-break-word">{body}</span>
      {canReload && (
        <Button size="xs" variant="outline" onClick={onReload}>
          <RefreshCwIcon data-icon="inline-start" />
          {t('brocoli.errors.reload')}
        </Button>
      )}
      <Button size="xs" variant="ghost" onClick={onDismiss}>
        {t('common.dismiss')}
      </Button>
    </div>
  )
}

// ─── Accueil ──────────────────────────────────────────────────────────────────

function StarterState({
  guildName,
  onPick,
  disabled,
}: {
  guildName: string
  onPick: (prompt: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const suggestions = t('brocoli.empty.suggestions', { returnObjects: true })
  const list = Array.isArray(suggestions) ? (suggestions as string[]) : []

  return (
    <Empty className="w-full max-w-2xl border-none bg-transparent p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
          <SparklesIcon />
        </EmptyMedia>
        <EmptyTitle>{t('brocoli.empty.title', { guild: guildName })}</EmptyTitle>
        <EmptyDescription>{t('brocoli.empty.description')}</EmptyDescription>
      </EmptyHeader>

      {list.length > 0 && (
        <EmptyContent className="w-full">
          {/* Amorces alignées à gauche en deux colonnes : une phrase se lit
              mieux ainsi qu'en pastille centrée, et la grille reste lisible
              quelle que soit la longueur des suggestions traduites. */}
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {list.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                disabled={disabled}
                onClick={() => onPick(suggestion)}
                className="h-auto justify-start whitespace-normal rounded-xl px-3 py-2.5 text-left text-sm font-normal"
              >
                <ArrowUpRightIcon
                  data-icon="inline-start"
                  className="text-muted-foreground"
                />
                {suggestion}
              </Button>
            ))}
          </div>
        </EmptyContent>
      )}
    </Empty>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BrocoliPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedGuildId, guildDetail, isGuildReady, guildError, user } = useGuildContext()
  const { status, loading: statusLoading, enabled, refresh: refreshStatus } = useAiStatus()

  usePageTitle(t('brocoli.title'))

  // Salons et rôles du serveur : autocomplétion dans la saisie, pastilles dans
  // le fil. Mémoïsé sur `GuildContext`, donc gratuit à chaque fragment de flux.
  const mentions = useMentionSource()

  const guildId = selectedGuildId ?? ''
  const defaultMode = status?.default_mode ?? 'ask'

  const brocoli = useBrocoli({
    guildId,
    defaultMode,
    // Un tour consomme du quota : on relit le compteur pour que l'en-tête ne
    // reste pas sur une valeur périmée.
    onTurnEnd: refreshStatus,
  })

  const { error, startNew, reload, dismissError } = brocoli

  // Un `403` est une **fin** de conversation : accès au serveur perdu, staff
  // révoqué. On repart sur une conversation neuve plutôt que de laisser un fil
  // qu'aucune requête ne pourra plus servir. Un `404` (conversation disparue)
  // se traite pareil.
  useEffect(() => {
    if (error?.kind === 'forbidden' || error?.kind === 'not_found') startNew()
  }, [error?.kind, startNew])

  /**
   * Texte à restituer à la saisie : **valeur dérivée**, pas un état. Ces trois
   * refus arrivent *avant* le flux — le tour n'a pas démarré, le message n'est
   * pas enregistré, et le perdre serait une faute. Sur les autres (le tour a
   * démarré), le message est bel et bien dans le transcript : le remettre dans
   * la saisie inviterait à l'envoyer deux fois.
   */
  const draftToRestore =
    error && (error.kind === 'invalid' || error.kind === 'quota' || error.kind === 'conflict')
      ? brocoli.lastMessage
      : null

  const handleSend = useCallback(
    (text: string) => {
      void brocoli.send(text)
    },
    [brocoli]
  )

  // ── Gardes ────────────────────────────────────────────────────────────────

  if (guildError) return <ErrorPage error={guildError} />

  if (!isGuildReady || statusLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    )
  }

  // Assistant coupé côté backend : l'entrée de navigation est déjà masquée, mais
  // une URL peut être collée directement.
  if (!enabled) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SparklesIcon />
          </EmptyMedia>
          <EmptyTitle>{t('brocoli.unavailable.title')}</EmptyTitle>
          <EmptyDescription>{t('brocoli.unavailable.description')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => navigate(`/servers/${guildId}`)}>
            {t('brocoli.unavailable.back')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const quotaExhausted = status?.quota.available === false
  const streaming = brocoli.runState === 'streaming'

  /**
   * L'action à confirmer, remontée du fil vers un panneau **épinglé** au-dessus
   * de la saisie. Une confirmation en attente bloque la conversation : laissée
   * dans le transcript, elle défilerait hors de l'écran dès que Brocoli
   * continue à écrire. La dernière l'emporte — un tour peut en enchaîner
   * plusieurs, seule celle encore réclamable a un sens.
   *
   * Le panneau **disparaît dès le clic** : la décision est prise, le garder
   * affiché avec une roue laisserait croire qu'il reste quelque chose à faire.
   * La suite se raconte dans le fil, où la trace passe en « application en
   * cours » puis au verdict — et la saisie reste verrouillée pendant ce temps.
   */
  const pending = [...brocoli.items]
    .reverse()
    .find(
      (item) =>
        item.kind === 'action' && isActionDecidable(item.action) && item.submitted === null
    )
  const pendingAction = pending?.kind === 'action' ? pending : null

  return (
    // `h-full min-h-0` : le conteneur du dashboard défile déjà ; sans cette
    // borne, le fil pousserait la page au lieu de défiler lui-même, et la
    // saisie disparaîtrait sous la ligne de flottaison.
    // Les marges négatives annulent le `p-6` du dashboard : une conversation se
    // tient bord à bord, son propre rembourrage étant porté par la colonne de
    // lecture.
    <div className="-m-6 flex h-[calc(100%+3rem)] min-h-0 flex-1 flex-col">
      {/* Historique en haut à gauche, hors bandeau : un simple bouton posé
          au-dessus du fil. Le titre et le nom du serveur vivent déjà dans le
          fil d'Ariane du dashboard, les répéter volait une bande de hauteur au
          seul contenu qui compte ici. */}
      <div className="flex shrink-0 items-center justify-end gap-1 px-4 pt-2">
        {/* Repartir de zéro est l'action la plus fréquente une fois dans un
            fil : elle mérite son bouton, pas deux clics dans un menu. Elle
            n'apparaît que là — sur une conversation neuve, elle ne ferait
            rien. */}
        {brocoli.conversation && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            disabled={streaming}
            onClick={startNew}
          >
            <MessageSquarePlusIcon data-icon="inline-start" />
            {t('brocoli.history.new')}
          </Button>
        )}
        <BrocoliHistory
          conversations={brocoli.conversations}
          currentId={brocoli.conversation?.id ?? null}
          loading={brocoli.loadingHistory}
          status={status}
          busy={streaming}
          onOpen={(id) => void brocoli.open(id)}
          onNew={startNew}
          onReload={() => void reload()}
          onArchive={() => void brocoli.archive()}
        />
      </div>

      {/* ── Fil ── */}
      <BrocoliTranscript
        items={brocoli.items}
        runState={brocoli.runState}
        loading={brocoli.loading}
        user={user}
        mentions={mentions}
        emptyState={
          <StarterState
            guildName={guildDetail?.name ?? ''}
            disabled={brocoli.runState !== 'idle' || quotaExhausted}
            onPick={handleSend}
          />
        }
      />

      {/* ── Pied : erreurs, renvoi, saisie ── */}
      {/* Écart franc avec le fil : sans lui, la saisie touche le dernier
          message de Brocoli et les deux blocs se lisent comme un seul. */}
      <div className="shrink-0 bg-background pt-8 pb-4">
        <div className={cn('flex flex-col gap-2', READING_COLUMN)}>
          {/* Épinglé juste au-dessus de la saisie : à l'endroit exact où
              l'utilisateur allait taper, et donc impossible à manquer. */}
          {pendingAction && (
            <BrocoliActionPanel
              action={pendingAction.action}
              mentions={mentions}
              submitted={pendingAction.submitted}
              busy={brocoli.deciding}
              onDecide={(decision) =>
                void brocoli.decide(pendingAction.action.action_id, decision)
              }
              onExpire={() => brocoli.markActionExpired(pendingAction.action.action_id)}
            />
          )}

          {error && (
            <ErrorNotice error={error} onDismiss={dismissError} onReload={() => void reload()} />
          )}

            <BrocoliComposer
            runState={brocoli.runState}
            mode={brocoli.mode}
            availableModes={status?.modes ?? ['read_only', 'ask', 'auto']}
            disabled={quotaExhausted}
            placeholder={quotaExhausted ? t('brocoli.errors.quota') : undefined}
            restoreDraft={draftToRestore}
            mentions={mentions}
            onSend={handleSend}
            onModeChange={(mode) => void brocoli.setMode(mode)}
          />
        </div>
      </div>
    </div>
  )
}
