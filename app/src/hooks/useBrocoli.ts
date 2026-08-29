/**
 * Machine à états d'une conversation Brocoli.
 *
 * Porte les trois invariants qui font la correction de l'intégration :
 *
 * 1. **Un tour arrêté sur `awaiting_confirmation` n'est pas terminé.** La
 *    saisie reste bloquée tant que la décision n'est pas prise ; la suite
 *    arrive dans le flux de `POST …/decision`, avec le même gestionnaire
 *    d'événements.
 * 2. **Un envoi en échec n'est jamais rejoué automatiquement** — le message a
 *    peut-être été enregistré et le tour lancé. Une coupure en plein flux se
 *    répare par `GET /ai/conversations/{id}`, jamais par un renvoi.
 * 3. **Rien n'est annoncé comme fait tant que ce n'est pas fait.** Une action en
 *    attente reste « en attente » : c'est la confusion la plus coûteuse
 *    possible sur un remboursement.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AiStreamError } from '@/lib/ai-stream'
import {
  actionFromTranscript,
  conflictKind,
  isActionDecidable,
  itemsFromTranscript,
  normalizePermissionRequest,
  normalizeRunStatus,
  normalizeStreamErrorCode,
} from '@/lib/brocoli'
import { logger } from '@/lib/logger'
import {
  archiveConversation,
  createConversation,
  decideAction,
  getConversation,
  listConversations,
  patchConversation,
  sendMessage,
} from '@/services/ai'
import type {
  AiConversation,
  AiDecision,
  AiMode,
  BrocoliItem,
  BrocoliRunState,
  RawSseEvent,
} from '@/types/ai'

/**
 * Erreur affichable. `fatal` ferme la conversation (403 : droits perdus, 404 :
 * conversation disparue) ; les autres sont des encarts au-dessus de la saisie.
 */
export interface BrocoliError {
  kind: 'forbidden' | 'not_found' | 'conflict' | 'quota' | 'unavailable' | 'invalid' | 'transport'
  message: string
  /** Secondes avant réessai (`429` uniquement). */
  retryAfter: number | null
  /** Distingue les deux causes d'un `409`. */
  conflict?: 'run_in_progress' | 'action_settled'
}

function classify(error: AiStreamError): BrocoliError {
  const base = { message: error.message, retryAfter: error.retryAfter }
  switch (error.status) {
    case 403:
      return { ...base, kind: 'forbidden' }
    case 404:
      return { ...base, kind: 'not_found' }
    case 409:
      return { ...base, kind: 'conflict', conflict: conflictKind(error.message) }
    case 422:
      return { ...base, kind: 'invalid' }
    case 429:
      return { ...base, kind: 'quota' }
    case 503:
      return { ...base, kind: 'unavailable' }
    default:
      return { ...base, kind: 'transport' }
  }
}

let itemSeq = 0
const nextId = () => `local-${++itemSeq}`

export interface UseBrocoliOptions {
  guildId: string
  /** `default_mode` de `GET /ai/status`, jamais une constante en dur. */
  defaultMode: AiMode
  /** Appelé après un tour terminé — sert à relire le quota. */
  onTurnEnd?: () => void
}

export interface BrocoliState {
  conversation: AiConversation | null
  conversations: AiConversation[]
  items: BrocoliItem[]
  runState: BrocoliRunState
  /** Chargement d'une conversation (ouverture, reprise, rafraîchissement). */
  loading: boolean
  /** Chargement de la liste de l'historique. */
  loadingHistory: boolean
  error: BrocoliError | null
  /** Mode courant : celui de la conversation, ou le défaut avant sa création. */
  mode: AiMode
  /** Dernier message envoyé — permet un « Réessayer » explicite après un `error`. */
  lastMessage: string | null
  /** Vrai tant qu'une décision est en vol (les deux boutons sont verrouillés). */
  deciding: boolean

  send: (text: string) => Promise<void>
  decide: (actionId: string, decision: AiDecision) => Promise<void>
  setMode: (mode: AiMode) => Promise<void>
  open: (conversationId: string) => Promise<void>
  startNew: () => void
  reload: () => Promise<void>
  archive: () => Promise<void>
  refreshHistory: () => Promise<void>
  dismissError: () => void
  /** Appelé par la carte d'action quand son compte à rebours atteint zéro. */
  markActionExpired: (actionId: string) => void
}

export function useBrocoli({ guildId, defaultMode, onTurnEnd }: UseBrocoliOptions): BrocoliState {
  const [conversation, setConversation] = useState<AiConversation | null>(null)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [items, setItems] = useState<BrocoliItem[]>([])
  const [runState, setRunState] = useState<BrocoliRunState>('idle')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<BrocoliError | null>(null)
  const [pendingMode, setPendingMode] = useState<AiMode>(defaultMode)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const [deciding, setDeciding] = useState(false)

  // ── Tampon de rendu ────────────────────────────────────────────────────────
  // Les `text_delta` arrivent par dizaines par seconde. Les accumuler dans une
  // ref et publier une fois par frame évite un rendu complet du transcript par
  // fragment, sans rien changer au résultat affiché.
  const itemsRef = useRef<BrocoliItem[]>([])
  const frameRef = useRef<number | null>(null)

  const flush = useCallback(() => {
    frameRef.current = null
    setItems([...itemsRef.current])
  }, [])

  const commit = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(flush)
  }, [flush])

  const replaceItems = useCallback(
    (next: BrocoliItem[]) => {
      itemsRef.current = next
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      setItems([...next])
    },
    []
  )

  const abortRef = useRef<AbortController | null>(null)
  // Garde de concurrence : un seul tour en vol côté client. Le verrou réel est
  // côté serveur (un second onglet reçoit un `409`), mais laisser partir deux
  // requêtes depuis le même onglet ne produirait qu'une erreur inutile.
  const busyRef = useRef(false)

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const mode = conversation?.mode ?? pendingMode

  // ── Événements du flux ─────────────────────────────────────────────────────

  const handleEvent = useCallback(
    (raw: RawSseEvent) => {
      const data = (raw.data ?? {}) as Record<string, unknown>
      const list = itemsRef.current
      const last = list[list.length - 1]

      /** Ferme la bulle en cours : le prochain fragment de texte en ouvrira une
       *  nouvelle, *après* l'étape d'outil — l'ordre chronologique est ce qui
       *  rend un tour lisible. */
      const sealTrailingBubble = () => {
        if (last && last.kind === 'assistant' && last.streaming) {
          list[list.length - 1] = { ...last, streaming: false }
        }
      }

      switch (raw.event) {
        case 'message_start': {
          // Bulle vide : la vue affiche « Brocoli réfléchit » tant qu'aucun
          // fragment n'est arrivé, plutôt qu'un cadre vide.
          list.push({ kind: 'assistant', id: nextId(), text: '', streaming: true })
          commit()
          return
        }

        case 'text_delta': {
          const delta = typeof data.delta === 'string' ? data.delta : ''
          if (!delta) return
          if (last && last.kind === 'assistant' && last.streaming) {
            list[list.length - 1] = { ...last, text: last.text + delta }
          } else {
            list.push({ kind: 'assistant', id: nextId(), text: delta, streaming: true })
          }
          commit()
          return
        }

        case 'tool_call': {
          const callId = typeof data.call_id === 'string' ? data.call_id : nextId()
          sealTrailingBubble()
          list.push({
            kind: 'tool',
            id: nextId(),
            call_id: callId,
            name: typeof data.name === 'string' ? data.name : '',
            // Chaîne JSON telle quelle : c'est ce que Brocoli *demande*, pas ce
            // qui a été fait — jamais utilisée pour afficher un résultat.
            arguments: typeof data.arguments === 'string' ? data.arguments : '',
            state: 'running',
          })
          commit()
          return
        }

        case 'tool_result': {
          const callId = typeof data.call_id === 'string' ? data.call_id : null
          const index = list.findIndex((i) => i.kind === 'tool' && i.call_id === callId)
          if (index >= 0) {
            const tool = list[index]
            if (tool.kind === 'tool') {
              list[index] = { ...tool, state: data.ok === false ? 'failed' : 'ok' }
            }
          }
          commit()
          return
        }

        case 'permission_request': {
          const action = normalizePermissionRequest(data)
          if (!action) return
          sealTrailingBubble()
          list.push({ kind: 'action', id: nextId(), action, submitted: null })
          commit()
          return
        }

        case 'error': {
          // Un `error` est toujours suivi d'un `run_end` : on note l'incident
          // dans le transcript et on laisse `run_end` décider de l'état final.
          list.push({
            kind: 'notice',
            id: nextId(),
            code: normalizeStreamErrorCode(data.code),
            message: typeof data.message === 'string' ? data.message : '',
          })
          commit()
          return
        }

        case 'run_end': {
          const status = normalizeRunStatus(data.status)
          // Fin de tour : plus rien ne coule, et une bulle restée vide (le
          // modèle n'a produit que des appels d'outils) n'a rien à afficher.
          itemsRef.current = list
            .map((item) =>
              item.kind === 'assistant' && item.streaming ? { ...item, streaming: false } : item
            )
            .filter((item) => !(item.kind === 'assistant' && item.text.trim() === ''))

          if (status === 'max_iterations') {
            itemsRef.current.push({
              kind: 'notice',
              id: nextId(),
              code: 'max_iterations',
              message: '',
            })
          }

          setRunState(status === 'awaiting_confirmation' ? 'awaiting_confirmation' : 'idle')
          replaceItems(itemsRef.current)
          return
        }

        default:
          // Un événement inconnu (le backend peut en ajouter) est ignoré, pas
          // rendu : il ne doit ni casser ni polluer le transcript.
          logger.warn('brocoli', `Événement SSE inconnu ignoré : ${raw.event}`)
      }
    },
    [commit, replaceItems]
  )

  // ── Chargement ─────────────────────────────────────────────────────────────

  const applyDetail = useCallback(
    (detail: Awaited<ReturnType<typeof getConversation>>) => {
      setConversation(detail.conversation)
      const next = itemsFromTranscript(detail.messages)
      replaceItems(next)

      // Une action encore `pending` dans le transcript garde la saisie
      // bloquée : le tour n'est pas terminé, même après un rechargement de page.
      const pending = next.some(
        (item) => item.kind === 'action' && isActionDecidable(item.action)
      )
      setRunState(pending ? 'awaiting_confirmation' : 'idle')
    },
    [replaceItems]
  )

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setLoading(true)
      try {
        applyDetail(await getConversation(conversationId))
        setError(null)
      } catch (e) {
        const status = (e as { status?: number }).status
        if (status === 403) setError({ kind: 'forbidden', message: '', retryAfter: null })
        else if (status === 404) setError({ kind: 'not_found', message: '', retryAfter: null })
        else setError({ kind: 'transport', message: '', retryAfter: null })
        if (status === 403 || status === 404) {
          setConversation(null)
          replaceItems([])
          setRunState('idle')
        }
      } finally {
        setLoading(false)
      }
    },
    [applyDetail, replaceItems]
  )

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const all = await listConversations()
      // Une conversation de configuration appartient à un serveur : la liste de
      // cette page ne montre que celles du serveur ouvert.
      setConversations(all.filter((c) => c.kind === 'guild_config' && c.guild_id === guildId))
    } catch (e) {
      logger.warn('brocoli', 'Historique des conversations indisponible', e)
    } finally {
      setLoadingHistory(false)
    }
  }, [guildId])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  // ── Envoi d'un tour ────────────────────────────────────────────────────────

  /**
   * Consomme un flux et traduit son échec. Rend `true` si le flux est allé au
   * bout, `false` sinon — l'appelant décide alors s'il peut restaurer la
   * saisie (uniquement quand le tour n'a **pas** démarré).
   */
  const runStream = useCallback(
    async (
      start: (onEvent: (e: RawSseEvent) => void, signal: AbortSignal) => Promise<void>
    ): Promise<{ ok: boolean; started: boolean; error: BrocoliError | null }> => {
      const controller = new AbortController()
      abortRef.current = controller
      let started = false

      const onEvent = (e: RawSseEvent) => {
        started = true
        handleEvent(e)
      }

      try {
        await start(onEvent, controller.signal)
        return { ok: true, started, error: null }
      } catch (e) {
        if (controller.signal.aborted) return { ok: false, started, error: null }
        if (!(e instanceof AiStreamError)) {
          logger.error('brocoli', 'Échec inattendu du flux', e)
          return { ok: false, started, error: { kind: 'transport', message: '', retryAfter: null } }
        }
        // 401 : `streamPost` a déjà lancé la redirection, rien à afficher.
        if (e.status === 401) return { ok: false, started, error: null }
        return { ok: false, started, error: classify(e) }
      } finally {
        abortRef.current = null
      }
    },
    [handleEvent]
  )

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || busyRef.current) return
      if (runState !== 'idle') return

      busyRef.current = true
      setError(null)
      setLastMessage(message)
      setRunState('streaming')

      // Bulle optimiste : retirée seulement si le backend refuse *avant* le
      // flux — une fois le tour lancé, le message est bel et bien enregistré.
      const optimisticId = nextId()
      itemsRef.current.push({
        kind: 'user',
        id: optimisticId,
        text: message,
        created_at: new Date().toISOString(),
      })
      replaceItems(itemsRef.current)

      let conv = conversation
      try {
        if (!conv) {
          conv = await createConversation({ guildId, mode: pendingMode })
          setConversation(conv)
        }
      } catch (e) {
        const status = (e as { status?: number }).status
        replaceItems(itemsRef.current.filter((i) => i.id !== optimisticId))
        setRunState('idle')
        busyRef.current = false
        setError(
          status === 403
            ? { kind: 'forbidden', message: '', retryAfter: null }
            : status === 503
              ? { kind: 'unavailable', message: '', retryAfter: null }
              : { kind: 'transport', message: '', retryAfter: null }
        )
        return
      }

      const conversationId = conv.id
      const result = await runStream((onEvent, signal) =>
        sendMessage(conversationId, { message }, onEvent, signal)
      )

      busyRef.current = false

      if (!result.ok) {
        if (!result.started) {
          // Le tour n'a jamais démarré : la bulle optimiste ment, on la retire
          // et le texte repart dans la saisie (`lastMessage`).
          replaceItems(itemsRef.current.filter((i) => i.id !== optimisticId))
        }
        setRunState('idle')
        if (result.error) setError(result.error)
        // Coupure en plein flux : le travail est persisté côté backend. On
        // relit le transcript — on ne renvoie **jamais** le message.
        if (result.started && result.error?.kind === 'transport') {
          await loadConversation(conversationId)
        }
        return
      }

      void refreshHistory()
      onTurnEnd?.()
    },
    [
      conversation,
      guildId,
      loadConversation,
      onTurnEnd,
      pendingMode,
      refreshHistory,
      replaceItems,
      runState,
      runStream,
    ]
  )

  // ── Décision sur une action ────────────────────────────────────────────────

  const decide = useCallback(
    async (actionId: string, decision: AiDecision) => {
      if (!conversation || busyRef.current) return
      const target = itemsRef.current.find(
        (i) => i.kind === 'action' && i.action.action_id === actionId
      )
      // Déjà décidée depuis cet onglet : le backend est idempotent, mais un
      // second envoi ne ferait qu'ajouter un `409` sans rien changer.
      if (!target || target.kind !== 'action' || target.submitted) return

      busyRef.current = true
      setDeciding(true)
      setError(null)
      // Verrouillage **dès le premier clic** : un bouton qui reste cliquable
      // donne l'impression que rien ne s'est passé.
      itemsRef.current = itemsRef.current.map((i) =>
        i.kind === 'action' && i.action.action_id === actionId ? { ...i, submitted: decision } : i
      )
      replaceItems(itemsRef.current)
      setRunState('streaming')

      const conversationId = conversation.id
      const result = await runStream((onEvent, signal) =>
        decideAction(conversationId, actionId, decision, onEvent, signal)
      )

      busyRef.current = false
      setDeciding(false)

      if (!result.ok) {
        setRunState('idle')
        if (result.error) setError(result.error)
        // `409` (action déjà traitée / expirée) comme coupure de flux : la
        // vérité est en base, on la relit plutôt que de deviner.
        if (result.error?.kind === 'conflict' || result.error?.kind === 'transport') {
          await loadConversation(conversationId)
        }
        return
      }

      // Le flux de reprise ne réémet pas l'action : sans cette mise à jour,
      // la carte resterait indéfiniment sur « envoi en cours ». `approved` (et
      // non `executed`) : l'action a été *autorisée*, ce qu'elle produit
      // ensuite est raconté par la suite du tour, pas par cette carte.
      itemsRef.current = itemsRef.current.map((i) =>
        i.kind === 'action' && i.action.action_id === actionId
          ? {
              ...i,
              action: {
                ...i.action,
                status: decision === 'approve' ? ('approved' as const) : ('denied' as const),
              },
            }
          : i
      )
      replaceItems(itemsRef.current)

      void refreshHistory()
      onTurnEnd?.()
    },
    [conversation, loadConversation, onTurnEnd, refreshHistory, replaceItems, runStream]
  )

  const markActionExpired = useCallback(
    (actionId: string) => {
      itemsRef.current = itemsRef.current.map((i) =>
        i.kind === 'action' && i.action.action_id === actionId && i.action.status === 'pending'
          ? { ...i, action: { ...i.action, status: 'expired' as const } }
          : i
      )
      replaceItems(itemsRef.current)
      // L'action n'est plus réclamable : la saisie doit repartir, sinon la
      // conversation reste bloquée sur une confirmation impossible à donner.
      setRunState((current) => (current === 'awaiting_confirmation' ? 'idle' : current))
    },
    [replaceItems]
  )

  // ── Mode ───────────────────────────────────────────────────────────────────

  const setMode = useCallback(
    async (next: AiMode) => {
      setPendingMode(next)
      if (!conversation) return
      const previous = conversation.mode
      // Optimiste, avec restauration : un sélecteur ne doit jamais afficher un
      // choix non enregistré.
      setConversation({ ...conversation, mode: next })
      try {
        setConversation(await patchConversation(conversation.id, { mode: next }))
      } catch (e) {
        logger.warn('brocoli', 'Changement de mode refusé', e)
        setConversation((current) => (current ? { ...current, mode: previous } : current))
        setPendingMode(previous)
        setError({ kind: 'transport', message: '', retryAfter: null })
      }
    },
    [conversation]
  )

  // ── Navigation ─────────────────────────────────────────────────────────────

  const open = useCallback(
    async (conversationId: string) => {
      abortRef.current?.abort()
      busyRef.current = false
      setError(null)
      setLastMessage(null)
      await loadConversation(conversationId)
    },
    [loadConversation]
  )

  const startNew = useCallback(() => {
    abortRef.current?.abort()
    busyRef.current = false
    setConversation(null)
    replaceItems([])
    setRunState('idle')
    setError(null)
    setLastMessage(null)
  }, [replaceItems])

  const reload = useCallback(async () => {
    if (!conversation) return
    await loadConversation(conversation.id)
  }, [conversation, loadConversation])

  const archive = useCallback(async () => {
    if (!conversation) return
    await archiveConversation(conversation.id)
    startNew()
    await refreshHistory()
  }, [conversation, refreshHistory, startNew])

  const dismissError = useCallback(() => setError(null), [])

  return {
    conversation,
    conversations,
    items,
    runState,
    loading,
    loadingHistory,
    error,
    mode,
    lastMessage,
    deciding,
    send,
    decide,
    setMode,
    open,
    startNew,
    reload,
    archive,
    refreshHistory,
    dismissError,
    markActionExpired,
  }
}

/** Réexporté pour la vue : reconstruire une action hors du hook (tests, debug). */
export { actionFromTranscript }
