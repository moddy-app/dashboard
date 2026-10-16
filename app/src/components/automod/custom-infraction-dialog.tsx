import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { automodErrorKey, isSameInfraction } from "@/lib/automod"
import { checkCustomInfraction } from "@/services/automod"
import type { AutomodCatalog, AutomodCustomInfraction } from "@/types/api"

/** Résultat du contrôle serveur, affiché sous le formulaire. */
type CheckFailure =
  | { kind: "rejected"; reason: string }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }

interface CustomInfractionDialogProps {
  guildId: string
  /** Point de départ : infraction existante, modèle ou vierge (l'`id` est déjà fixé). */
  initial: AutomodCustomInfraction
  isNew: boolean
  limits: AutomodCatalog["limits"]
  /** Version ENREGISTRÉE de la même infraction : si elle est identique, le contrôle est sauté. */
  saved: AutomodCustomInfraction | undefined
  onSubmit: (infraction: AutomodCustomInfraction) => void
  onClose: () => void
}

/**
 * Formulaire d'une infraction personnalisée. Monté seulement quand il est
 * ouvert, avec `key={id}` : l'état local repart donc de `initial`.
 */
export function CustomInfractionDialog({
  guildId,
  initial,
  isNew,
  limits,
  saved,
  onSubmit,
  onClose,
}: CustomInfractionDialogProps) {
  const { t } = useTranslation()
  const [nom, setNom] = useState(initial.nom)
  const [description, setDescription] = useState(initial.description)
  const [exemples, setExemples] = useState<string[]>(initial.exemples)
  const [motsCles, setMotsCles] = useState<string[]>(initial.mots_cles)
  const [keywordInput, setKeywordInput] = useState("")
  const [keywordError, setKeywordError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [failure, setFailure] = useState<CheckFailure | null>(null)

  const trimmedNom = nom.trim()
  const trimmedDescription = description.trim()
  const cleanExemples = exemples.map((e) => e.trim()).filter(Boolean)

  const nomInvalid = trimmedNom.length < 1 || trimmedNom.length > limits.nom
  const descriptionInvalid =
    trimmedDescription.length < 1 || trimmedDescription.length > limits.description
  const exemplesInvalid =
    cleanExemples.length > limits.exemples || cleanExemples.some((e) => e.length > limits.exemple)
  const motsClesInvalid = motsCles.length > limits.mots_cles
  const invalid = nomInvalid || descriptionInvalid || exemplesInvalid || motsClesInvalid

  const touch = () => setFailure(null)

  const addKeyword = (raw: string) => {
    const word = raw.trim()
    if (!word) return
    if (word.length > limits.mot_cle) {
      setKeywordError(t("modules.automod_ai.custom.keywordTooLong", { max: limits.mot_cle }))
      return
    }
    if (motsCles.some((k) => k.toLowerCase() === word.toLowerCase())) {
      setKeywordInput("")
      return
    }
    if (motsCles.length >= limits.mots_cles) {
      setKeywordError(t("modules.automod_ai.custom.keywordsFull", { max: limits.mots_cles }))
      return
    }
    setMotsCles([...motsCles, word])
    setKeywordInput("")
    setKeywordError(null)
    touch()
  }

  const submit = async () => {
    if (invalid || checking) return
    const candidate: AutomodCustomInfraction = {
      ...initial,
      nom: trimmedNom,
      description: trimmedDescription,
      exemples: cleanExemples,
      mots_cles: motsCles,
    }
    // Une entrée identique à celle déjà enregistrée a déjà passé le contrôle.
    if (!saved || !isSameInfraction(candidate, saved)) {
      setChecking(true)
      setFailure(null)
      try {
        const result = await checkCustomInfraction(guildId, candidate)
        if (!result.ok) {
          setFailure({
            kind: "rejected",
            reason: result.reason ?? t("modules.automod_ai.custom.rejectedFallback"),
          })
          return
        }
      } catch (e) {
        logger.warn("module:automod_ai", "Custom infraction check failed", e)
        // 503 (`check_unavailable`) et codes connus : message traduit, jamais le code nu.
        const key = e instanceof ApiError ? automodErrorKey(e, { check: true }) : null
        setFailure(
          key === "check_unavailable"
            ? { kind: "unavailable" }
            : key
              ? { kind: "error", message: t(`modules.automod_ai.errors.${key}`) }
              : { kind: "error", message: e instanceof Error ? e.message : String(e) }
        )
        return
      } finally {
        setChecking(false)
      }
    }
    onSubmit(candidate)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !checking && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t(isNew ? "modules.automod_ai.custom.createTitle" : "modules.automod_ai.custom.editTitle")}
          </DialogTitle>
          <DialogDescription>{t("modules.automod_ai.custom.formDescription")}</DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={nomInvalid && nom !== "" ? true : undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="infraction-nom">{t("modules.automod_ai.custom.nom")}</FieldLabel>
              <Counter value={trimmedNom.length} max={limits.nom} />
            </div>
            <Input
              id="infraction-nom"
              value={nom}
              aria-invalid={nomInvalid && nom !== ""}
              onChange={(e) => {
                setNom(e.target.value)
                touch()
              }}
            />
          </Field>

          <Field data-invalid={descriptionInvalid && description !== "" ? true : undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="infraction-description">
                {t("modules.automod_ai.custom.description")}
              </FieldLabel>
              <Counter value={trimmedDescription.length} max={limits.description} />
            </div>
            <Textarea
              id="infraction-description"
              value={description}
              className="min-h-24 resize-y"
              aria-invalid={descriptionInvalid && description !== ""}
              onChange={(e) => {
                setDescription(e.target.value)
                touch()
              }}
            />
            <FieldDescription>{t("modules.automod_ai.custom.descriptionHelp")}</FieldDescription>
          </Field>

          <FieldSet>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>{t("modules.automod_ai.custom.exemples")}</FieldLabel>
              <Counter value={cleanExemples.length} max={limits.exemples} />
            </div>
            <FieldDescription>
              {t("modules.automod_ai.custom.exemplesHelp", { max: limits.exemple })}
            </FieldDescription>
            <FieldGroup className="gap-2">
              {exemples.map((example, index) => {
                const tooLong = example.trim().length > limits.exemple
                return (
                  <Field key={index} orientation="horizontal" data-invalid={tooLong ? true : undefined}>
                    <Input
                      value={example}
                      aria-invalid={tooLong}
                      aria-label={t("modules.automod_ai.custom.exemple", { n: index + 1 })}
                      onChange={(e) => {
                        setExemples(exemples.map((x, i) => (i === index ? e.target.value : x)))
                        touch()
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("modules.automod_ai.custom.removeExemple", { n: index + 1 })}
                      onClick={() => {
                        setExemples(exemples.filter((_, i) => i !== index))
                        touch()
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  </Field>
                )
              })}
            </FieldGroup>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exemples.length >= limits.exemples}
                onClick={() => setExemples([...exemples, ""])}
              >
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                {t("modules.automod_ai.custom.addExemple")}
              </Button>
            </div>
          </FieldSet>

          <Field data-invalid={keywordError ? true : undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="infraction-keyword">
                {t("modules.automod_ai.custom.motsCles")}
              </FieldLabel>
              <Counter value={motsCles.length} max={limits.mots_cles} />
            </div>
            {motsCles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {motsCles.map((word) => (
                  <Badge key={word} variant="secondary" className="h-6 gap-1 pr-1">
                    {word}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="size-4"
                      aria-label={t("modules.automod_ai.custom.removeKeyword", { word })}
                      onClick={() => {
                        setMotsCles(motsCles.filter((k) => k !== word))
                        touch()
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              id="infraction-keyword"
              value={keywordInput}
              placeholder={t("modules.automod_ai.custom.keywordPlaceholder")}
              disabled={motsCles.length >= limits.mots_cles}
              aria-invalid={Boolean(keywordError)}
              onChange={(e) => {
                setKeywordInput(e.target.value)
                setKeywordError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault()
                  addKeyword(keywordInput)
                } else if (e.key === "Backspace" && keywordInput === "" && motsCles.length > 0) {
                  setMotsCles(motsCles.slice(0, -1))
                }
              }}
              onBlur={() => addKeyword(keywordInput)}
            />
            {keywordError ? (
              <FieldError>{keywordError}</FieldError>
            ) : (
              <FieldDescription>
                {t("modules.automod_ai.custom.motsClesHelp", { max: limits.mot_cle })}
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>

        {failure && (
          <Alert variant={failure.kind === "unavailable" ? "default" : "destructive"}>
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
            <AlertDescription>
              {failure.kind === "rejected" && failure.reason}
              {failure.kind === "unavailable" && t("modules.automod_ai.errors.check_unavailable")}
              {failure.kind === "error" && failure.message}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={checking}>
            {t("modules.automod_ai.cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={invalid || checking}>
            {checking && <Spinner data-icon="inline-start" />}
            {t(checking ? "modules.automod_ai.custom.checking" : "modules.automod_ai.custom.validate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        value > max ? "font-medium text-destructive" : "text-muted-foreground"
      )}
    >
      {value} / {max}
    </span>
  )
}
