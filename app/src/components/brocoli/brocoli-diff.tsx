/**
 * Tableau de diff d'une action de configuration.
 *
 * ⚠️ **Ne jamais le masquer « pour simplifier »** : c'est exactement ce qui
 * distingue une confirmation d'un clic réflexe.
 *
 * Chaque entrée est un **chemin** de configuration, pas une structure imbriquée.
 * Une liste qui change est rendue **entière** par le backend (aligner des
 * panneaux par index produirait un diff faux dès qu'on en insère un au milieu) :
 * ces valeurs-là sont donc longues, d'où le repli par ligne.
 *
 * **Les valeurs sont rendues lisibles, jamais devinées.** Le backend envoie des
 * snowflakes nus (`"1421493239579676682"`) qu'aucun humain ne sait relire : on
 * les résout contre les salons et rôles du serveur, déjà chargés. Un identifiant
 * **inconnu reste affiché tel quel** — sur un écran de confirmation, un nom
 * inventé serait pire qu'un identifiant illisible.
 *
 * Le `path`, lui, reste brut et en chasse fixe : c'est le nom réel du réglage,
 * celui qu'on retrouve sur la page du module. Le traduire demanderait un
 * libellé par clé de chaque schéma — inventer ces libellés ferait dire au diff
 * autre chose que ce qui va être écrit.
 */

import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon, MinusIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { renderDiffValue } from '@/lib/brocoli'
import type { MentionSource } from '@/lib/brocoli-mentions'
import { MentionChip } from './mention-chip'
import type { AiDiffEntry } from '@/types/ai'

const OP_META = {
  added: { icon: PlusIcon, className: 'text-emerald-600 dark:text-emerald-400' },
  removed: { icon: MinusIcon, className: 'text-red-600 dark:text-red-400' },
  changed: { icon: PencilIcon, className: 'text-amber-600 dark:text-amber-400' },
} as const

/** Un snowflake Discord : 17 à 20 chiffres, jamais autre chose. */
const SNOWFLAKE_RE = /^\d{17,20}$/

/**
 * Rend une valeur « atomique » lisible : un salon ou un rôle connu devient une
 * pastille, un booléen une phrase, le reste sa propre écriture. Rend `null`
 * quand la valeur n'est pas atomique — l'appelant retombe alors sur le JSON.
 */
function readableScalar(
  value: unknown,
  mentions: MentionSource | null,
  t: (key: string) => string
): ReactNode | null {
  if (typeof value === 'boolean') return t(value ? 'brocoli.diff.enabled' : 'brocoli.diff.disabled')

  if (typeof value === 'string' && SNOWFLAKE_RE.test(value)) {
    const target = mentions?.resolveById(value)
    // Identifiant inconnu → on le laisse nu. Ne jamais deviner sur un écran de
    // confirmation.
    return target ? <MentionChip target={target} /> : null
  }

  return null
}

function DiffValue({
  value,
  tone,
  mentions,
}: {
  value: unknown
  tone: 'before' | 'after'
  mentions: MentionSource | null
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  // ── Valeur atomique lisible ──
  const scalar = readableScalar(value, mentions, t)
  if (scalar !== null) {
    return (
      <span className={cn('text-xs', tone === 'before' && 'opacity-60')}>{scalar}</span>
    )
  }

  // ── Liste d'identifiants ──
  // Un tableau de snowflakes est le cas le plus fréquent (salons ignorés, rôles
  // autorisés) et le plus illisible en JSON : on le rend en pastilles.
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
    const entries = value as string[]
    const resolved = entries.map((id) => ({ id, target: mentions?.resolveById(id) ?? null }))
    if (resolved.some((entry) => entry.target)) {
      return (
        <span className={cn('flex flex-wrap gap-1 text-xs', tone === 'before' && 'opacity-60')}>
          {resolved.map((entry) =>
            entry.target ? (
              <MentionChip key={entry.id} target={entry.target} />
            ) : (
              <code key={entry.id} className="font-mono">
                {entry.id}
              </code>
            )
          )}
        </span>
      )
    }
  }

  // ── Repli : la valeur telle qu'elle sera écrite ──
  const rendered = renderDiffValue(value)
  const body = (
    <span
      className={cn(
        'font-mono text-xs wrap-anywhere',
        rendered.empty && 'text-muted-foreground',
        tone === 'before' && !rendered.empty && 'text-muted-foreground line-through decoration-1'
      )}
    >
      {rendered.expandable && !expanded ? `${rendered.text.slice(0, 80)}…` : rendered.text}
    </span>
  )

  if (!rendered.expandable) return body

  return (
    <span className="flex flex-col items-start gap-1">
      {expanded ? (
        <pre className="max-h-64 w-full overflow-auto rounded-md bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap">
          {rendered.text}
        </pre>
      ) : (
        body
      )}
      <Button
        variant="link"
        size="xs"
        className="h-auto p-0 text-xs"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? t('brocoli.diff.collapse') : t('brocoli.diff.expand')}
      </Button>
    </span>
  )
}

export function BrocoliDiff({
  diff,
  mentions = null,
}: {
  diff: AiDiffEntry[]
  /** Salons et rôles du serveur, pour rendre les snowflakes en noms. */
  mentions?: MentionSource | null
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  if (diff.length === 0) return null

  return (
    <div className="rounded-lg border bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
        />
        {t('brocoli.diff.title', { count: diff.length })}
      </button>

      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="w-1/3 px-3 py-2 font-medium">
                  {t('brocoli.diff.path')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('brocoli.diff.before')}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t('brocoli.diff.after')}
                </th>
              </tr>
            </thead>
            <tbody>
              {diff.map((entry, index) => {
                const meta = OP_META[entry.op]
                const OpIcon = meta.icon
                return (
                  <tr key={`${entry.path}-${index}`} className="border-b align-top last:border-b-0">
                    <th scope="row" className="px-3 py-2 font-normal">
                      <span className="flex items-start gap-1.5">
                        <OpIcon
                          className={cn('mt-0.5 size-3 shrink-0', meta.className)}
                          aria-label={t(`brocoli.diff.op.${entry.op}`)}
                        />
                        {/* Le nom réel du réglage, celui de la page du module. */}
                        <span className="font-mono wrap-anywhere">{entry.path}</span>
                      </span>
                    </th>
                    <td className="px-3 py-2">
                      <DiffValue value={entry.before} tone="before" mentions={mentions} />
                    </td>
                    <td className="px-3 py-2">
                      <DiffValue value={entry.after} tone="after" mentions={mentions} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
