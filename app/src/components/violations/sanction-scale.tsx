import { useTranslation } from "react-i18next"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LEVEL_TONE, levelRank } from "@/lib/sanctions"
import type { SanctionLevel } from "@/types/violations"

const LADDER: SanctionLevel[] = ["none", "warn", "limited", "suspended"]

// Les pastilles sont centrées dans quatre colonnes égales : la piste va donc du
// centre de la première (12,5 %) au centre de la dernière, soit 75 % de large.
const TRACK_INSET = 100 / (LADDER.length * 2)
const TRACK_SPAN = 100 - TRACK_INSET * 2

/**
 * Échelle des quatre niveaux de sanction, du compte sain à la suspension.
 *
 * Elle répond à la seule question que se pose quelqu'un qui découvre un bandeau
 * rouge : « où j'en suis, et qu'est-ce qui vient après ? ». Les niveaux
 * franchis sont peints, les suivants restent éteints — on ne met jamais en
 * avant une aggravation qui n'a pas eu lieu.
 */
export function SanctionScale({
  level,
  className,
}: {
  level: SanctionLevel
  className?: string
}) {
  const { t } = useTranslation()
  const current = levelRank(level)
  const tone = LEVEL_TONE[level]

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        {/* Piste éteinte, puis portion parcourue par-dessus */}
        <div
          aria-hidden
          className="absolute top-1/2 h-px -translate-y-1/2 bg-border"
          style={{ left: `${TRACK_INSET}%`, width: `${TRACK_SPAN}%` }}
        />
        <div
          aria-hidden
          className={cn("absolute top-1/2 h-px -translate-y-1/2", tone.dot)}
          style={{
            left: `${TRACK_INSET}%`,
            width: `${(TRACK_SPAN * current) / (LADDER.length - 1)}%`,
          }}
        />

        <div className="relative flex h-7 items-center">
          {LADDER.map((step) => {
            const rank = levelRank(step)
            const isCurrent = rank === current
            const stepTone = LEVEL_TONE[step]
            const Icon = step === "none" ? CheckIcon : stepTone.icon

            return (
              <div key={step} className="flex flex-1 items-center justify-center">
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center justify-center rounded-full",
                    isCurrent
                      ? cn("size-7 ring-4 ring-background", stepTone.dot)
                      : cn("size-2.5 ring-2 ring-background", rank < current ? tone.dot : "bg-border")
                  )}
                >
                  {isCurrent && <Icon className="size-4 text-white" />}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex">
        {LADDER.map((step) => {
          const isCurrent = levelRank(step) === current
          return (
            <span
              key={step}
              className={cn(
                "flex-1 px-1 text-center text-[11px] leading-tight sm:text-xs",
                isCurrent
                  ? cn("font-semibold", LEVEL_TONE[step].text)
                  : "text-muted-foreground"
              )}
            >
              {t(`violations.ladder.${step}`)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
