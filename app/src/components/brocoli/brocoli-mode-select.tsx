/**
 * Sélecteur de mode.
 *
 * Le point qui compte : **au moment où l'utilisateur choisit `auto`, il faut lui
 * dire que les actions sensibles resteront confirmées.** Sans cette phrase, il
 * croira avoir tout délégué et sera surpris par le premier écran de
 * confirmation — ou pire, s'y habituera et cliquera sans lire.
 *
 * Les modes proposés viennent de `GET /ai/status` (`modes`), jamais d'une liste
 * en dur : le backend peut en retirer un sans déploiement du front.
 */

import { useTranslation } from 'react-i18next'
import { EyeIcon, HandIcon, ZapIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AiMode } from '@/types/ai'

const MODE_ICON: Record<AiMode, typeof EyeIcon> = {
  read_only: EyeIcon,
  ask: HandIcon,
  auto: ZapIcon,
}

interface BrocoliModeSelectProps {
  value: AiMode
  /** `modes` de `GET /ai/status`. */
  available: AiMode[]
  disabled?: boolean
  onChange: (mode: AiMode) => void
}

export function BrocoliModeSelect({
  value,
  available,
  disabled,
  onChange,
}: BrocoliModeSelectProps) {
  const { t } = useTranslation()
  const Icon = MODE_ICON[value]

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onChange(next as AiMode)}
    >
      <SelectTrigger
        size="sm"
        className="w-auto min-w-0 gap-1.5 border-none bg-transparent px-2 shadow-none hover:bg-muted"
        aria-label={t('brocoli.mode.label')}
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        {/* Contenu explicite : sans lui, Radix recopie dans le déclencheur
            *tout* le contenu de l'option choisie — description et mise en garde
            comprises. On ne veut que son libellé. */}
        <SelectValue>{t(`brocoli.mode.${value}.label`)}</SelectValue>
      </SelectTrigger>

      <SelectContent align="start" className="max-w-80">
        <SelectGroup>
          {available.map((mode) => {
            const ModeIcon = MODE_ICON[mode]
            return (
              <SelectItem key={mode} value={mode} className="items-start">
                <span className="flex items-start gap-2">
                  <ModeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{t(`brocoli.mode.${mode}.label`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`brocoli.mode.${mode}.description`)}
                    </span>
                    {/* Dit au moment du choix, pas dans une doc ailleurs. */}
                    {mode === 'auto' && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t('brocoli.mode.auto.caveat')}
                      </span>
                    )}
                  </span>
                </span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
