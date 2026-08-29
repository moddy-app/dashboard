/**
 * Confirmation d'une action — **la pièce la plus importante de l'intégration** :
 * c'est le seul endroit où un humain voit ce que Brocoli s'apprête à faire.
 *
 * Deux surfaces, une seule source de vérité :
 *
 * - `BrocoliActionPanel` — **épinglé au-dessus de la saisie**, jamais dans le
 *   fil. Une confirmation en attente bloque la conversation : la reléguer dans
 *   le transcript la ferait défiler hors de l'écran dès que Brocoli continue à
 *   écrire, et c'est précisément ce qu'il ne faut pas. Elle reste sous les yeux,
 *   à l'endroit où l'utilisateur allait taper.
 * - `BrocoliActionRecord` — la **trace** dans le fil, une fois la décision
 *   prise. Compacte : la délibération a eu lieu dans le panneau, l'historique
 *   n'a besoin que du verdict.
 *
 * Les règles portées par le code :
 *
 * 1. Le `summary` fait le titre — il est écrit pour être lu par un humain.
 * 2. `risk` se lit sans aplat ni filet de couleur : une pastille au trait
 *    suffit, et `critical` y ajoute une bordure. Ce dernier exige en plus un
 *    **geste délibéré** — ces actions restent confirmées même en mode `auto`,
 *    l'utilisateur ne s'y attend donc pas.
 * 3. `preview.valid === false` grise « Appliquer » : laisser cliquer produirait
 *    un échec incompréhensible. On invite à répondre à Brocoli.
 * 4. `expires_at` en compte à rebours ; à zéro, plus de boutons.
 * 5. Les deux boutons se verrouillent **dès le premier clic**. Le backend est
 *    idempotent, mais un bouton qui reste cliquable donne l'impression que rien
 *    ne s'est passé.
 *
 * Et une interdiction : **ne rien inventer** quand `diff` est absent. Certaines
 * natures d'action (facturation, sanctions) ne se prévisualisent pas — mieux
 * vaut « pas de détail disponible » qu'un aperçu faux sur une action
 * irréversible.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  ShieldQuestionIcon,
  TimerOffIcon,
  XIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { useCountdown } from '@/hooks/useCountdown'
import { cn } from '@/lib/utils'
import {
  RISK_META,
  formatCountdown,
  isPreviewBlocking,
  requiresDeliberateGesture,
  riskTone,
} from '@/lib/brocoli'
import type { MentionSource } from '@/lib/brocoli-mentions'
import { BrocoliDiff } from './brocoli-diff'
import type { AiDecision, AiPermissionRequest } from '@/types/ai'

// ─── Confirmation en deux temps (risk: critical) ──────────────────────────────

function DeliberateConfirm({
  open,
  onOpenChange,
  summary,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: string
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  const expected = t('brocoli.action.criticalWord')
  const matches = typed.trim().toLocaleLowerCase() === expected.toLocaleLowerCase()

  // Le champ repart vide à chaque ouverture : une saisie laissée d'une action
  // précédente vaudrait confirmation en un clic, ce que ce dialogue existe
  // précisément pour empêcher.
  //
  // Ajustement **pendant le rendu** plutôt que dans un effet : React rejoue le
  // composant avant de peindre, donc le champ n'est jamais affiché rempli, là
  // où un effet le montrerait une frame avec l'ancienne valeur.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setTyped('')
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('brocoli.action.criticalTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('brocoli.action.criticalDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-4">
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">{summary}</p>
          <Field>
            <FieldLabel htmlFor="brocoli-critical-confirm">
              {t('brocoli.action.criticalPrompt', { word: expected })}
            </FieldLabel>
            <Input
              id="brocoli-critical-confirm"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches) {
                  e.preventDefault()
                  onConfirm()
                }
              }}
            />
            <FieldDescription>{t('brocoli.action.criticalHint')}</FieldDescription>
          </Field>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={!matches} onClick={onConfirm}>
            {t('brocoli.action.apply')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Panneau épinglé ──────────────────────────────────────────────────────────

interface BrocoliActionPanelProps {
  action: AiPermissionRequest
  /** Salons et rôles du serveur — rend lisibles les snowflakes du diff. */
  mentions?: MentionSource | null
  /** Décision déjà envoyée depuis cet onglet. Verrouille les deux boutons. */
  submitted: AiDecision | null
  /** Une décision est en vol. */
  busy: boolean
  onDecide: (decision: AiDecision) => void
  onExpire: () => void
}

export function BrocoliActionPanel({
  action,
  mentions = null,
  submitted,
  busy,
  onDecide,
  onExpire,
}: BrocoliActionPanelProps) {
  const { t } = useTranslation()
  const [criticalOpen, setCriticalOpen] = useState(false)

  const left = useCountdown(action.expires_at, onExpire)
  const expired = action.status === 'expired' || (left !== null && left <= 0)
  const blocking = isPreviewBlocking(action.preview)
  const critical = requiresDeliberateGesture(action.risk)
  const locked = submitted !== null || busy

  const RiskIcon = RISK_META[action.risk].icon
  const summary = action.preview.summary.trim()

  const request = (decision: AiDecision) => {
    if (decision === 'approve' && critical) {
      setCriticalOpen(true)
      return
    }
    onDecide(decision)
  }

  return (
    <div
      // Surface neutre — `bg-card`, pas de teinte ni de filet de couleur : une
      // confirmation doit se lire comme un document à valider, pas comme une
      // bannière. Le niveau de risque est porté par la pastille (couleur, icône
      // et libellé), et par la bordure seulement quand il est `critical`.
      // L'ombre pose le panneau *au-dessus* du fil, ce qu'il est littéralement.
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-lg shadow-black/5 dark:shadow-black/40',
        critical && 'border-destructive/30'
      )}
      role="group"
      aria-label={t('brocoli.action.panelLabel')}
    >
      <div className="flex flex-col gap-3 p-4">
        {/* ── Bandeau : risque, nature, échéance ── */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {/* Variante stock du design system : aucune couleur recopiée, la
              hiérarchie trait → plein discret → destructif porte à elle seule
              les trois niveaux. */}
          <Badge variant={RISK_META[action.risk].badge}>
            <RiskIcon data-icon="inline-start" />
            {t(`brocoli.risk.${action.risk}.label`)}
          </Badge>

          <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {/* La nature technique de l'action : utile à un admin qui veut
                savoir *quoi* est touché, discrète pour les autres. */}
            <Badge variant="ghost" className="px-0 font-mono text-muted-foreground">
              {action.kind}
            </Badge>
            {!expired && left !== null && (
              <span
                className={cn(
                  'flex items-center gap-1 tabular-nums',
                  left <= 30 && 'font-medium text-destructive'
                )}
                title={t('brocoli.action.expiresTitle')}
              >
                <ClockIcon className="size-3.5" />
                {formatCountdown(left)}
              </span>
            )}
          </span>
        </div>

        {/* ── Le résumé, écrit par Brocoli pour être lu ── */}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold wrap-break-word">
            {summary || t('brocoli.action.noSummary')}
          </p>
          <p className="text-xs text-muted-foreground">{t(`brocoli.risk.${action.risk}.hint`)}</p>
        </div>

        {/* ── Aperçu ── */}
        {action.preview.diff && action.preview.diff.length > 0 ? (
          <BrocoliDiff diff={action.preview.diff} mentions={mentions} />
        ) : (
          // Aucun diff : on le **dit**, on n'en fabrique pas un à partir de `kind`.
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldQuestionIcon className="size-3.5 shrink-0" />
            {t('brocoli.action.noPreview')}
          </p>
        )}

        {/* ── Configuration invalide ── */}
        {blocking && (
          <div className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-medium text-destructive">
              {t('brocoli.action.invalidTitle')}
            </p>
            {action.preview.errors && action.preview.errors.length > 0 && (
              <ul className="flex list-disc flex-col gap-0.5 ps-4 text-xs text-destructive/90">
                {action.preview.errors.map((message, i) => (
                  <li key={i} className="wrap-break-word">
                    {message}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{t('brocoli.action.invalidHint')}</p>
          </div>
        )}

        {/* ── Décision ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="min-w-0 text-xs text-muted-foreground">
            {expired
              ? t('brocoli.action.expired')
              : blocking
                ? t('brocoli.action.applyBlocked')
                : t('brocoli.action.footerHint')}
          </span>

          {!expired && (
            <span className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={locked} onClick={() => request('deny')}>
                {submitted === 'deny' ? (
                  <LoaderIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <XIcon data-icon="inline-start" />
                )}
                {t('brocoli.action.deny')}
              </Button>
              <Button
                size="sm"
                disabled={locked || blocking}
                onClick={() => request('approve')}
                // Une action critique passe par un bouton secondaire : le geste
                // d'approbation ne doit pas être le plus facile de l'écran.
                variant={critical ? 'outline' : 'default'}
              >
                {submitted === 'approve' ? (
                  <LoaderIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {t('brocoli.action.apply')}
              </Button>
            </span>
          )}
        </div>
      </div>

      <DeliberateConfirm
        open={criticalOpen}
        onOpenChange={setCriticalOpen}
        summary={summary}
        onConfirm={() => {
          setCriticalOpen(false)
          onDecide('approve')
        }}
      />
    </div>
  )
}

// ─── Trace dans le fil ────────────────────────────────────────────────────────

const RECORD_ICON = {
  approved: CheckIcon,
  executed: CheckIcon,
  denied: XIcon,
  expired: TimerOffIcon,
  failed: XIcon,
  pending: ClockIcon,
} as const

/**
 * Ce qu'il reste d'une action dans l'historique. Volontairement pauvre : le
 * détail a été montré au moment de décider, le relire n'apporte plus rien —
 * et une carte entière par action rendrait un long fil illisible.
 *
 * Une action encore `pending` apparaît quand même : sans elle, l'endroit du fil
 * où la conversation s'est arrêtée serait invisible.
 */
export function BrocoliActionRecord({
  action,
  submitted,
}: {
  action: AiPermissionRequest
  /** Décision envoyée, réponse pas encore arrivée. */
  submitted?: AiDecision | null
}) {
  const { t } = useTranslation()
  const tone = riskTone(action.risk)
  const summary = action.preview.summary.trim() || t('brocoli.action.noSummary')
  const settled = action.status !== 'pending'

  // Une décision en vol l'emporte sur le statut : en base l'action est encore
  // `pending`, mais afficher « en attente de votre décision » alors qu'elle
  // vient d'être prise serait faux.
  const pendingSend = !settled && submitted

  const Icon = pendingSend ? LoaderIcon : (RECORD_ICON[action.status] ?? CheckIcon)

  return (
    <Marker {...(pendingSend ? { role: 'status' as const } : {})} className="gap-2">
      <MarkerIcon>
        <Icon
          className={cn(
            pendingSend
              ? 'animate-spin text-muted-foreground'
              : action.status === 'approved' || action.status === 'executed'
                ? 'text-emerald-600 dark:text-emerald-400'
                : action.status === 'pending'
                  ? tone.text
                  : 'text-muted-foreground'
          )}
        />
      </MarkerIcon>
      <MarkerContent className="flex flex-1 flex-wrap items-baseline gap-x-1.5">
        <span className={cn('font-medium', !settled && 'text-foreground')}>
          {pendingSend
            ? t(`brocoli.action.sending.${submitted}`)
            : t(`brocoli.action.status.${action.status}`)}
        </span>
        <span className="min-w-0 wrap-break-word text-muted-foreground">— {summary}</span>
      </MarkerContent>
    </Marker>
  )
}
