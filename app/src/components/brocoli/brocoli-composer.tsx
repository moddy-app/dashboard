/**
 * Saisie d'un message.
 *
 * Deux verrous, tous deux structurels :
 * - **pendant un tour** (`streaming`) : un seul tour en vol par conversation ;
 * - **pendant une confirmation en attente** (`awaiting_confirmation`) : le tour
 *   n'est pas terminé, proposer d'envoyer un nouveau message serait mentir.
 *
 * Le texte n'est jamais perdu : sur un envoi refusé *avant* le flux, l'appelant
 * le restitue via `restoreDraft`.
 *
 * La saisie complète `#salon` et `@rôle` sur les listes du serveur — voir
 * `@/lib/brocoli-mentions` pour ce qui est mentionnable et pourquoi.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpIcon, AtSignIcon, HashIcon, LoaderIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'
import { BrocoliModeSelect } from './brocoli-mode-select'
import {
  findMentionQuery,
  scanMentions,
  suggestMentions,
  type MentionSource,
  type MentionTarget,
} from '@/lib/brocoli-mentions'
import type { AiMode, BrocoliRunState } from '@/types/ai'

/** Le backend refuse au-delà (`422`) : on borne ici plutôt que d'aller le voir. */
const MAX_LENGTH = 8000

/**
 * Métriques partagées par la saisie et son calque de surlignage. Les deux
 * doivent produire **exactement** la même mise en page : la moindre différence
 * de police, de rembourrage ou d'interlignage décale le surlignage du texte.
 */
const EDITOR_METRICS =
  'px-3 py-2 text-base md:text-sm leading-normal whitespace-pre-wrap wrap-break-word'

/**
 * Surlignage des mentions **dans la saisie**.
 *
 * Un `<textarea>` ne sait pas afficher de contenu riche. On peint donc le texte
 * une seconde fois dans un calque placé dessous, et on rend le texte de la
 * zone de saisie transparent — seul son curseur reste visible.
 *
 * ⚠️ Le surlignage doit être **neutre pour la mise en page** : uniquement une
 * couleur et un fond, jamais de rembourrage, de bordure ni d'icône. Une
 * pastille comme celle du fil élargirait le mot et décalerait tout le texte qui
 * suit par rapport aux vraies lettres de la zone de saisie.
 */
function MentionHighlightLayer({
  value,
  mentions,
  ref,
}: {
  value: string
  mentions: MentionSource | null
  ref: React.Ref<HTMLDivElement>
}) {
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 overflow-hidden text-foreground',
        EDITOR_METRICS
      )}
    >
      {scanMentions(value, mentions).map((segment, index) =>
        segment.target ? (
          <span key={index} className="rounded-[3px] bg-primary/15 text-primary">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
      {/* Une ligne vide finale n'a pas de hauteur : sans ce caractère, le calque
          est plus court que la zone de saisie quand le texte finit par un saut
          de ligne, et le surlignage remonte d'une ligne. */}
      {value.endsWith('\n') && '\u200b'}
    </div>
  )
}

interface BrocoliComposerProps {
  runState: BrocoliRunState
  mode: AiMode
  availableModes: AiMode[]
  /** Assistant coupé, quota épuisé, conversation fermée… */
  disabled?: boolean
  placeholder?: string
  /** Texte à réinjecter après un envoi refusé (changement de valeur = réinjection). */
  restoreDraft?: string | null
  /** Salons et rôles du serveur, pour l'autocomplétion. */
  mentions?: MentionSource | null
  onSend: (text: string) => void
  onModeChange: (mode: AiMode) => void
}

export function BrocoliComposer({
  runState,
  mode,
  availableModes,
  disabled = false,
  placeholder,
  restoreDraft,
  mentions = null,
  onSend,
  onModeChange,
}: BrocoliComposerProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [restored, setRestored] = useState<string | null>(null)
  const [caret, setCaret] = useState(0)
  const [highlight, setHighlight] = useState(0)
  /** Fermée à la main (Échap) tant que le jeton courant n'a pas changé. */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const locked = runState !== 'idle' || disabled
  const canSend = value.trim().length > 0 && !locked

  // Réinjection du brouillon perdu, ajustée **pendant le rendu**. Comparée à la
  // dernière valeur *réinjectée* et non à l'état courant : sans ça, un
  // utilisateur qui efface volontairement le texte le verrait revenir au rendu
  // suivant.
  if (restoreDraft && restoreDraft !== restored) {
    setRestored(restoreDraft)
    setValue(restoreDraft)
  }

  // ── Autocomplétion ─────────────────────────────────────────────────────────

  const query = locked || !mentions ? null : findMentionQuery(value, caret)
  const queryKey = query ? `${query.kind}:${query.start}:${query.term}` : null
  const suggestions = query && mentions ? suggestMentions(mentions, query) : []
  const open = suggestions.length > 0 && queryKey !== null && dismissed !== queryKey

  // L'index surligné se borne au rendu : la liste rétrécit à chaque frappe, et
  // un index laissé hors bornes ne désignerait plus rien.
  const active = suggestions.length > 0 ? Math.min(highlight, suggestions.length - 1) : 0

  const accept = (target: MentionTarget) => {
    if (!query) return
    const prefix = query.kind === 'channel' ? '#' : '@'
    // On insère le **nom**, pas `<#id>` : c'est ce que Brocoli sait lire.
    const inserted = `${prefix}${target.name} `
    const next = value.slice(0, query.start) + inserted + value.slice(query.end)
    const position = query.start + inserted.length

    setValue(next)
    setDismissed(null)
    setHighlight(0)
    // Le curseur doit repartir *après* l'insertion : sans ce repositionnement,
    // il resterait là où le jeton commençait et la frappe suivante casserait le
    // nom qu'on vient d'insérer.
    requestAnimationFrame(() => {
      const node = textareaRef.current
      if (!node) return
      node.focus()
      node.setSelectionRange(position, position)
      setCaret(position)
    })
  }

  const syncCaret = () => {
    const node = textareaRef.current
    if (node) setCaret(node.selectionStart ?? 0)
  }

  // ── Confort ────────────────────────────────────────────────────────────────

  // Hauteur automatique. En layout effect : mesurer après peinture ferait
  // clignoter la boîte d'une ligne à chaque frappe.
  useLayoutEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    const height = Math.min(node.scrollHeight, 200)
    node.style.height = `${height}px`
    // Le calque suit la même hauteur : au-delà de la borne, les deux défilent
    // et leurs `scrollTop` sont synchronisés à la main (voir `onScroll`).
    if (mirrorRef.current) mirrorRef.current.style.height = `${height}px`
  }, [value])

  // Le focus revient dès que la main est rendue — après un tour ou une
  // décision, on continue à écrire sans recliquer.
  useEffect(() => {
    if (!locked) textareaRef.current?.focus()
  }, [locked])

  const submit = () => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
    setDismissed(null)
  }

  const hint =
    runState === 'awaiting_confirmation'
      ? t('brocoli.composer.awaitingDecision')
      : runState === 'streaming'
        ? t('brocoli.composer.running')
        : (placeholder ?? t('brocoli.composer.placeholder'))

  return (
    <div className="relative flex flex-col gap-1.5">
      {/* ── Suggestions ── */}
      {open && (
        <div
          // Au-dessus de la saisie : la liste ne doit jamais recouvrir ce qu'on
          // est en train d'écrire, et le bas de l'écran est occupé.
          className="absolute bottom-full z-20 mb-1.5 w-full max-w-sm overflow-hidden rounded-xl border bg-popover p-1 shadow-lg"
          role="listbox"
          aria-label={t('brocoli.composer.mentionsLabel')}
        >
          {suggestions.map((target, index) => (
            <button
              key={`${target.kind}-${target.id}`}
              type="button"
              role="option"
              aria-selected={index === active}
              // `onMouseDown` et non `onClick` : le clic ferait d'abord perdre
              // le focus au champ, et la position du curseur avec.
              onMouseDown={(e) => {
                e.preventDefault()
                accept(target)
              }}
              onMouseEnter={() => setHighlight(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm',
                index === active ? 'bg-accent text-accent-foreground' : 'text-foreground'
              )}
            >
              {target.kind === 'channel' ? (
                <HashIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <AtSignIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{target.name}</span>
            </button>
          ))}
        </div>
      )}

      <InputGroup>
        <MentionHighlightLayer value={value} mentions={mentions} ref={mirrorRef} />
        <InputGroupTextarea
          ref={textareaRef}
          value={value}
          rows={1}
          maxLength={MAX_LENGTH}
          disabled={locked}
          placeholder={hint}
          aria-label={t('brocoli.composer.label')}
          aria-expanded={open}
          aria-autocomplete="list"
          className={cn(
            'relative max-h-[200px] min-h-[2.75rem] bg-transparent caret-foreground',
            // Le texte est peint par le calque : ici il ne sert qu'à porter la
            // sélection et le curseur. `text-transparent` garde la sélection
            // visible (le navigateur la peint par-dessus).
            'text-transparent placeholder:text-muted-foreground',
            EDITOR_METRICS
          )}
          onScroll={(e) => {
            if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop
          }}
          onChange={(e) => {
            setValue(e.target.value)
            setCaret(e.target.selectionStart ?? 0)
            setHighlight(0)
          }}
          onClick={syncCaret}
          onSelect={syncCaret}
          onBlur={() => setDismissed(queryKey)}
          onKeyDown={(e) => {
            // Quand la liste est ouverte, les flèches et Entrée lui appartiennent.
            if (open) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlight((h) => (h + 1) % suggestions.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
                return
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                accept(suggestions[active])
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setDismissed(queryKey)
                return
              }
            }

            // Entrée envoie, Maj+Entrée passe à la ligne — la convention d'un
            // fil de conversation. La composition IME ne doit pas déclencher un
            // envoi au milieu d'un caractère.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
              return
            }

            // Les flèches déplacent le curseur : la position lue dans
            // `onKeyDown` est celle d'*avant*, d'où le report à la frame
            // suivante pour que le jeton détecté suive vraiment le curseur.
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
              requestAnimationFrame(syncCaret)
            }
          }}
        />

        <InputGroupAddon align="block-end" className="justify-between gap-2">
          <BrocoliModeSelect
            value={mode}
            available={availableModes}
            // Le mode reste modifiable pendant une confirmation en attente
            // (c'est un réglage de la conversation), pas pendant un tour.
            disabled={runState === 'streaming' || disabled}
            onChange={onModeChange}
          />

          <span className="flex items-center gap-2">
            {value.length > MAX_LENGTH - 500 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {MAX_LENGTH - value.length}
              </span>
            )}
            <InputGroupButton
              size="icon-sm"
              variant="default"
              disabled={!canSend}
              aria-label={t('brocoli.composer.send')}
              onClick={submit}
            >
              {runState === 'streaming' ? (
                <LoaderIcon className="animate-spin" />
              ) : (
                <ArrowUpIcon />
              )}
            </InputGroupButton>
          </span>
        </InputGroupAddon>
      </InputGroup>

      <p className="px-3 text-xs text-muted-foreground">{t('brocoli.composer.disclaimer')}</p>
    </div>
  )
}
