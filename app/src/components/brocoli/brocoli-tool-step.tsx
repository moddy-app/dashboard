/**
 * Une étape d'outil dans le transcript — « Brocoli consulte les salons… ».
 *
 * `tool_call.name` est un identifiant technique : on affiche un **libellé**,
 * jamais le nom brut. Et `arguments` n'est **pas** affiché par défaut : c'est du
 * JSON souvent long, sans intérêt, et surtout c'est ce que Brocoli *demande*,
 * pas ce qui a été fait — le confondre avec un résultat serait un contresens.
 * Il reste accessible dans un repli « détails ».
 */

import { createElement, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ChevronRightIcon, LoaderIcon, TriangleAlertIcon } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { cn } from '@/lib/utils'
import { toolIcon, toolLabelKey } from '@/lib/brocoli'
import type { BrocoliItem } from '@/types/ai'

type ToolItem = Extract<BrocoliItem, { kind: 'tool' }>

/** JSON compact rendu lisible ; un `arguments` illisible s'affiche tel quel. */
function prettyArguments(raw: string): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function BrocoliToolStep({ item }: { item: ToolItem }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const label = t(toolLabelKey(item.name), { defaultValue: t('brocoli.tools.default') })
  const details = prettyArguments(item.arguments)
  const running = item.state === 'running'

  return (
    <div className="flex flex-col gap-1">
      <Marker
        // `role="status"` : une étape en cours doit être annoncée aux lecteurs
        // d'écran au moment où elle apparaît.
        {...(running ? { role: 'status' as const } : {})}
        className="gap-2"
      >
        <MarkerIcon>
          {running ? (
            <LoaderIcon className="animate-spin" />
          ) : item.state === 'failed' ? (
            <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />
          ) : (
            // `createElement` plutôt qu'une variable capitalisée : l'icône est
            // choisie dynamiquement selon l'outil, ce qu'un composant déclaré
            // dans le corps du rendu ferait passer pour un composant recréé à
            // chaque frame.
            createElement(toolIcon(item.name))
          )}
        </MarkerIcon>

        <MarkerContent className="flex flex-1 items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate', running && 'shimmer')}>
            {label}
            {item.state === 'failed' && ` — ${t('brocoli.tools.failed')}`}
          </span>

          {item.state === 'ok' && (
            <CheckIcon className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
          )}

          {details && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex shrink-0 items-center gap-0.5 rounded-md px-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              <ChevronRightIcon
                className={cn('size-3 transition-transform', open && 'rotate-90')}
              />
              {t('brocoli.tools.details')}
            </button>
          )}
        </MarkerContent>
      </Marker>

      {open && details && (
        <pre className="ml-6 max-h-48 overflow-auto rounded-lg border bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap">
          {details}
        </pre>
      )}
    </div>
  )
}
