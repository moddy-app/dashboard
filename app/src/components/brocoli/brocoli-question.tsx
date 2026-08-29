/**
 * Formulaire de question — le pendant de la confirmation d'action, et la
 * seconde façon dont un tour peut s'arrêter.
 *
 * **Confirmation ≠ question.** Une confirmation demande la permission d'agir :
 * Brocoli sait quoi faire, il attend un « Appliquer ». Une question signale
 * qu'il lui *manque une information* : il ne peut pas continuer, et il attend
 * un formulaire. Les deux écrans se ressemblent, ils ne veulent pas dire la
 * même chose.
 *
 * Ce que le code porte, et pourquoi :
 *
 * 1. **Sans ce formulaire, la conversation se bloque sans rien afficher.** Le
 *    tour est fini (`run_end: awaiting_answer`), aucun texte n'est arrivé, et
 *    l'utilisateur regarde un écran muet. C'est pour ça qu'il s'affiche
 *    **dans les trois modes, `auto` compris** — le mode ne change rien aux
 *    questions.
 * 2. **`recommended` est une valeur par défaut, pas un indice.** Elle est
 *    *présélectionnée* : Brocoli a lu le serveur avant de demander, dans la
 *    plupart des cas la bonne réponse est déjà là et il n'y a qu'à valider.
 *    Afficher un sélecteur vide alors que `recommended` est renseigné ferait
 *    perdre le bénéfice de toute la fonctionnalité. `null` = il n'a rien à
 *    proposer, et on ne fabrique **rien** à sa place.
 * 3. **Un widget natif par `answer_type`** — les vrais sélecteurs de salon et
 *    de rôle des formulaires de modules. Un champ texte de repli annulerait
 *    tout l'intérêt : la fonctionnalité existe précisément pour éviter de faire
 *    recopier un snowflake à la main.
 * 4. **Un bouton « Ignorer »** (`{cancelled: true}`). Sans lui, la seule façon
 *    de sortir d'une question mal posée est d'y répondre n'importe quoi — et
 *    Brocoli construirait sa configuration sur cette réponse.
 * 5. **`label` / `labels` sont renvoyés** avec les réponses : Brocoli les
 *    emploie dans sa phrase suivante au lieu de relire les salons du serveur.
 * 6. **`header` vide → pas de puce.** Le backend le laisse vide exprès : une
 *    puce en français sur une conversation en anglais est pire que pas de puce.
 *    Tout le texte servi ici est déjà dans la langue de la conversation ; seul
 *    le **chrome** (« Ignorer », « Envoyer », « Recommandé », le compte à
 *    rebours) est à nous, et il est localisé.
 * 7. **Bouton d'envoi verrouillé dès le premier clic** : le serveur est
 *    idempotent, mais un double clic ouvrirait deux flux SSE dont le second
 *    recevrait `409`.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClockIcon,
  LoaderIcon,
  MessageCircleQuestionIcon,
  SendIcon,
  SparklesIcon,
  TimerOffIcon,
  XIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCountdown } from '@/hooks/useCountdown'
import { formatCountdown } from '@/lib/brocoli'
import { cn } from '@/lib/utils'
import { CHANNEL_TYPES, roleColorToHex, type Channel, type Role } from '@/types/api'
import type { AiAnswer, AiAnswerBody, AiQuestion, AiQuestionRequest } from '@/types/ai'

/** Sentinelle du sélecteur : Radix Select refuse une valeur vide. */
const NONE = '__none__'

/**
 * Une réponse en cours de saisie. **Toujours une liste**, même sur une question
 * à réponse unique : le sérialiseur choisit ensuite entre `value` et `values`,
 * et deux formes d'état pour la même chose se seraient désynchronisées.
 */
type Draft = Record<string, string[]>

// ─── Amorce ───────────────────────────────────────────────────────────────────

/**
 * Valeurs présélectionnées. Pour `choice`, la recommandation est portée par
 * l'option (`recommended: true`, au plus une) ; ailleurs, par `recommended`.
 */
function initialDraft(questions: AiQuestion[]): Draft {
  const draft: Draft = {}
  for (const question of questions) {
    if (question.answer_type === 'choice') {
      const recommended = question.options.find((option) => option.recommended)
      draft[question.id] = recommended ? [recommended.value] : []
      continue
    }
    draft[question.id] = question.recommended ? [question.recommended] : []
  }
  return draft
}

// ─── Sérialisation ────────────────────────────────────────────────────────────

/**
 * Nom lisible d'une valeur, tel qu'il sera renvoyé dans `label` / `labels`.
 * `null` quand il n'y a rien de plus lisible que la valeur elle-même (texte
 * libre, identifiant introuvable) — on n'invente alors pas de nom.
 */
function labelFor(
  question: AiQuestion,
  value: string,
  channels: Channel[],
  roles: Role[]
): string | null {
  if (question.answer_type === 'channel') {
    const channel = channels.find((c) => c.id === value)
    return channel ? `#${channel.name}` : (question.recommended_label ?? null)
  }
  if (question.answer_type === 'role') {
    const role = roles.find((r) => r.id === value)
    return role ? `@${role.name}` : (question.recommended_label ?? null)
  }
  if (question.answer_type === 'choice') {
    return question.options.find((option) => option.value === value)?.label ?? null
  }
  return null
}

function buildAnswers(
  questions: AiQuestion[],
  draft: Draft,
  channels: Channel[],
  roles: Role[]
): AiAnswer[] {
  return questions.map((question): AiAnswer => {
    const values = (draft[question.id] ?? []).filter((v) => v.trim() !== '')
    // Rien de saisi : la question est **laissée de côté**, pas répondue par une
    // chaîne vide que Brocoli prendrait pour un choix.
    if (values.length === 0) return { question_id: question.id, skipped: true }

    const labels = values
      .map((value) => labelFor(question, value, channels, roles))
      .filter((label): label is string => label !== null)

    if (question.multi_select) {
      return {
        question_id: question.id,
        values,
        ...(labels.length === values.length ? { labels } : {}),
      }
    }
    return {
      question_id: question.id,
      value: values[0],
      ...(labels.length > 0 ? { label: labels[0] } : {}),
    }
  })
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

/** Salons proposables : tout sauf les catégories, qui ne reçoivent rien. */
function selectableChannels(channels: Channel[]): Channel[] {
  return channels
    .filter((channel) => channel.type !== CHANNEL_TYPES.CATEGORY)
    .slice()
    .sort((a, b) => a.position - b.position)
}

/** Rôles proposables : ni `@everyone`, ni les rôles gérés par une intégration. */
function selectableRoles(roles: Role[]): Role[] {
  return roles
    .filter((role) => role.name !== '@everyone' && !role.managed)
    .slice()
    .sort((a, b) => b.position - a.position)
}

interface Entity {
  id: string
  name: string
  /** Pastille de couleur d'un rôle ; absente pour un salon. */
  color?: string
}

function channelEntities(channels: Channel[]): Entity[] {
  return selectableChannels(channels).map((channel) => ({ id: channel.id, name: channel.name }))
}

function roleEntities(roles: Role[]): Entity[] {
  return selectableRoles(roles).map((role) => ({
    id: role.id,
    name: role.name,
    color: roleColorToHex(role.color),
  }))
}

function EntityLabel({ entity, prefix }: { entity: Entity; prefix: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {entity.color && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: entity.color }}
          aria-hidden
        />
      )}
      <span className="truncate">
        {prefix}
        {entity.name}
      </span>
    </span>
  )
}

/** Sélecteur simple d'un salon ou d'un rôle. */
function EntitySelect({
  value,
  entities,
  prefix,
  disabled,
  placeholder,
  clearLabel,
  fallbackLabel,
  onChange,
}: {
  value: string | null
  entities: Entity[]
  prefix: string
  disabled: boolean
  placeholder: string
  clearLabel: string
  /** `recommended_label` — sert quand l'identifiant recommandé est introuvable. */
  fallbackLabel: string | null
  onChange: (value: string | null) => void
}) {
  const known = value !== null && entities.some((e) => e.id === value)

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{clearLabel}</SelectItem>
        {entities.map((entity) => (
          <SelectItem key={entity.id} value={entity.id}>
            <EntityLabel entity={entity} prefix={prefix} />
          </SelectItem>
        ))}
        {/* Recommandation introuvable dans les listes (salon créé à l'instant,
            rôle hors périmètre) : gardée sélectionnable sous son nom lisible
            plutôt que de retomber silencieusement sur le placeholder — c'est
            la seule utilité de `recommended_label`. */}
        {value && !known && (
          <SelectItem value={value}>
            {fallbackLabel ?? `${prefix}${value}`}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

/** Sélection multiple : pastilles retirables + ajout par le même sélecteur. */
function EntityChips({
  value,
  entities,
  prefix,
  disabled,
  addLabel,
  onChange,
}: {
  value: string[]
  entities: Entity[]
  prefix: string
  disabled: boolean
  addLabel: string
  onChange: (value: string[]) => void
}) {
  const available = entities.filter((entity) => !value.includes(entity.id))

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const entity = entities.find((e) => e.id === id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm"
                style={entity?.color ? { borderColor: entity.color, color: entity.color } : undefined}
              >
                {prefix}
                {entity?.name ?? id}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((v) => v !== id))}
                  className="rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      {available.length > 0 && (
        <Select
          // `value=""` remet le sélecteur au placeholder après chaque ajout :
          // il sert d'ajout, pas de champ portant une valeur.
          value=""
          disabled={disabled}
          onValueChange={(id) => onChange([...value, id])}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {available.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                <EntityLabel entity={entity} prefix={prefix} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/**
 * Options d'un `choice`. Une seule mise en page pour les deux cas — cases à
 * cocher en `multi_select`, boutons radio sinon : ce qui change est la
 * sémantique, pas la lecture.
 */
function ChoiceList({
  question,
  value,
  disabled,
  onChange,
}: {
  question: AiQuestion
  value: string[]
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const { t } = useTranslation()
  const multi = question.multi_select

  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange([optionValue])
      return
    }
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue]
    )
  }

  return (
    <div
      role={multi ? 'group' : 'radiogroup'}
      aria-label={question.question}
      className="flex flex-col gap-1.5"
    >
      {question.options.map((option) => {
        const selected = value.includes(option.value)
        return (
          <button
            key={option.id}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={selected}
            disabled={disabled}
            onClick={() => toggle(option.value)}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
              selected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
              disabled && 'pointer-events-none opacity-60'
            )}
          >
            {multi ? (
              <Checkbox checked={selected} tabIndex={-1} className="mt-0.5 pointer-events-none" />
            ) : (
              // Pas de composant radio dans le socle : un rond dessiné, avec
              // la sémantique portée par `role`/`aria-checked` sur le bouton.
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  selected ? 'border-primary' : 'border-input'
                )}
              >
                {selected && <span className="size-2 rounded-full bg-primary" />}
              </span>
            )}

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                {option.label}
                {option.recommended && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <SparklesIcon data-icon="inline-start" />
                    {t('brocoli.question.recommended')}
                  </Badge>
                )}
              </span>
              {option.description && (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Une question ─────────────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  channels,
  roles,
  disabled,
  onChange,
}: {
  question: AiQuestion
  value: string[]
  channels: Channel[]
  roles: Role[]
  disabled: boolean
  onChange: (value: string[]) => void
}) {
  const { t } = useTranslation()

  const entities =
    question.answer_type === 'channel'
      ? channelEntities(channels)
      : question.answer_type === 'role'
        ? roleEntities(roles)
        : []
  const prefix = question.answer_type === 'channel' ? '#' : '@'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {/* `header` vide → aucune puce. Le backend le laisse vide exprès plutôt
            que de servir une étiquette dans la mauvaise langue. */}
        {question.header.trim() !== '' && (
          <Badge variant="outline" className="w-fit font-normal">
            {question.header}
          </Badge>
        )}
        <p className="text-sm font-medium wrap-break-word">{question.question}</p>
      </div>

      {question.answer_type === 'text' ? (
        <Textarea
          value={value[0] ?? ''}
          rows={2}
          disabled={disabled}
          placeholder={question.recommended_label ?? t('brocoli.question.textPlaceholder')}
          onChange={(e) => onChange(e.target.value === '' ? [] : [e.target.value])}
        />
      ) : question.answer_type === 'choice' ? (
        <ChoiceList question={question} value={value} disabled={disabled} onChange={onChange} />
      ) : question.multi_select ? (
        <EntityChips
          value={value}
          entities={entities}
          prefix={prefix}
          disabled={disabled}
          addLabel={t(`brocoli.question.add.${question.answer_type}`)}
          onChange={onChange}
        />
      ) : (
        <EntitySelect
          value={value[0] ?? null}
          entities={entities}
          prefix={prefix}
          disabled={disabled}
          placeholder={t(`brocoli.question.pick.${question.answer_type}`)}
          clearLabel={t('brocoli.question.none')}
          fallbackLabel={question.recommended_label}
          onChange={(next) => onChange(next === null ? [] : [next])}
        />
      )}

      {/* La raison de la recommandation, telle qu'écrite par Brocoli — dans la
          langue de la conversation, jamais reformulée ici. */}
      {question.recommendation_reason && (
        <p className="text-xs text-muted-foreground wrap-break-word">
          {question.recommendation_reason}
        </p>
      )}
    </div>
  )
}

// ─── Panneau épinglé ──────────────────────────────────────────────────────────

interface BrocoliQuestionPanelProps {
  request: AiQuestionRequest
  channels: Channel[]
  roles: Role[]
  /** Formulaire déjà envoyé depuis cet onglet. Verrouille tout. */
  submitted: boolean
  /** Un envoi est en vol. */
  busy: boolean
  onSubmit: (body: AiAnswerBody) => void
  onExpire: () => void
}

export function BrocoliQuestionPanel({
  request,
  channels,
  roles,
  submitted,
  busy,
  onSubmit,
  onExpire,
}: BrocoliQuestionPanelProps) {
  const { t } = useTranslation()

  // Amorcé une seule fois, sur les recommandations de Brocoli. Une question
  // n'est jamais remplacée dans un panneau — une nouvelle est un nouveau
  // `question_id`, donc un nouveau montage (`key`).
  const [draft, setDraft] = useState<Draft>(() => initialDraft(request.questions))

  const left = useCountdown(request.expires_at, onExpire)
  const expired = request.status === 'expired' || (left !== null && left <= 0)
  const locked = submitted || busy || expired

  const set = (questionId: string, value: string[]) =>
    setDraft((current) => ({ ...current, [questionId]: value }))

  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-lg shadow-black/5 dark:shadow-black/40"
      role="group"
      aria-label={t('brocoli.question.panelLabel')}
    >
      <div className="flex flex-col gap-4 p-4">
        {/* ── Bandeau ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircleQuestionIcon className="size-4 text-muted-foreground" />
            {t('brocoli.question.title')}
          </span>
          {!expired && left !== null && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs tabular-nums text-muted-foreground',
                left <= 30 && 'font-medium text-destructive'
              )}
              title={t('brocoli.question.expiresTitle')}
            >
              <ClockIcon className="size-3.5" />
              {formatCountdown(left)}
            </span>
          )}
        </div>

        {/* ── Les questions (1 à 4) ── */}
        <div className="flex flex-col gap-4">
          {request.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={draft[question.id] ?? []}
              channels={channels}
              roles={roles}
              disabled={locked}
              onChange={(value) => set(question.id, value)}
            />
          ))}
        </div>

        {/* ── Envoi ── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 text-xs text-muted-foreground">
            {expired ? t('brocoli.question.expired') : t('brocoli.question.footerHint')}
          </span>

          {!expired && (
            <span className="flex items-center gap-2">
              {/* Sans « Ignorer », la seule sortie d'une question mal posée
                  serait d'y répondre n'importe quoi — et Brocoli bâtirait sa
                  configuration là-dessus. */}
              <Button
                size="sm"
                variant="ghost"
                disabled={locked}
                onClick={() => onSubmit({ cancelled: true })}
              >
                {t('brocoli.question.skip')}
              </Button>
              <Button
                size="sm"
                disabled={locked}
                onClick={() =>
                  onSubmit({ answers: buildAnswers(request.questions, draft, channels, roles) })
                }
              >
                {submitted ? (
                  <LoaderIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                {t('brocoli.question.submit')}
              </Button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Trace dans le fil ────────────────────────────────────────────────────────

const RECORD_ICON = {
  pending: MessageCircleQuestionIcon,
  answered: MessageCircleQuestionIcon,
  cancelled: XIcon,
  expired: TimerOffIcon,
} as const

/**
 * Ce qu'il reste d'une question dans l'historique : le fait qu'elle a été
 * posée, et ce qu'elle est devenue. Le formulaire lui-même vit au-dessus de la
 * saisie — laissé dans le fil, il défilerait hors de l'écran dès que Brocoli
 * reprend la parole.
 */
export function BrocoliQuestionRecord({
  request,
  submitted,
}: {
  request: AiQuestionRequest
  /** Envoi en vol depuis cet onglet. */
  submitted?: boolean
}) {
  const { t } = useTranslation()

  // Un envoi en vol l'emporte sur le statut : en base la question est encore
  // `pending`, mais afficher « en attente de votre réponse » alors qu'elle
  // vient d'être envoyée serait faux.
  const sending = request.status === 'pending' && submitted
  const Icon = sending ? LoaderIcon : (RECORD_ICON[request.status] ?? MessageCircleQuestionIcon)

  // Le premier intitulé résume la demande — c'est celui que l'utilisateur a lu.
  const summary = request.questions[0]?.question ?? ''
  const more = request.questions.length - 1

  return (
    <Marker {...(sending ? { role: 'status' as const } : {})} className="gap-2">
      <MarkerIcon>
        <Icon className={cn(sending && 'animate-spin', 'text-muted-foreground')} />
      </MarkerIcon>
      <MarkerContent className="flex flex-1 flex-wrap items-baseline gap-x-1.5">
        <span className="font-medium">
          {sending
            ? t('brocoli.question.sending')
            : t(`brocoli.question.status.${request.status}`)}
        </span>
        <span className="min-w-0 wrap-break-word text-muted-foreground">
          — {summary}
          {more > 0 && ` ${t('brocoli.question.andMore', { count: more })}`}
        </span>
      </MarkerContent>
    </Marker>
  )
}
