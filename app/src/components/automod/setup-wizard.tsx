import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CheckIcon } from "lucide-react"
import { ChannelPicker } from "@/components/module-pickers"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { useGuildContext } from "@/contexts/GuildContext"
import { useMediaQuery } from "@/hooks/use-media-query"
import { applyAutomodPreset, pickLocalized } from "@/lib/automod"
import { cn } from "@/lib/utils"
import { CHANNEL_TYPES } from "@/types/api"
import type { AutomodAiConfig, AutomodCatalog, AutomodCatalogPreset } from "@/types/api"

type Activation = "simulation" | "live" | "off"

const ACTIVATION: Record<Activation, { enabled: boolean; dryRun: boolean }> = {
  simulation: { enabled: true, dryRun: true },
  live: { enabled: true, dryRun: false },
  off: { enabled: false, dryRun: true },
}
const ACTIVATION_IDS: Activation[] = ["simulation", "live", "off"]
const STEPS = 3

interface SetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Brouillon courant : le niveau s'applique dessus, rien n'est sauvegardé ici. */
  config: AutomodAiConfig
  catalog: AutomodCatalog | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onApply: (next: AutomodAiConfig) => void
}

/** Cartes sélectionnables à la façon d'un groupe radio (Item stock + rôle radio). */
function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  children,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <Item
      variant="outline"
      asChild
      className={cn("cursor-pointer items-start", selected && "border-primary bg-accent/40")}
    >
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect}>
        <ItemContent className="text-left">
          <ItemTitle>
            {title}
            {selected && <CheckIcon className="size-4 text-primary" aria-hidden="true" />}
          </ItemTitle>
          {description && <ItemDescription className="line-clamp-none">{description}</ItemDescription>}
          {children}
        </ItemContent>
      </button>
    </Item>
  )
}

/**
 * Monté uniquement à l'ouverture : l'état (étape, niveau, salon, activation)
 * repart donc de zéro à chaque fois, sans effet de réinitialisation.
 */
export function SetupWizard(props: SetupWizardProps) {
  if (!props.open) return null
  return <SetupWizardContent {...props} />
}

function SetupWizardContent({
  open,
  onOpenChange,
  config,
  catalog,
  loading,
  error,
  onRetry,
  onApply,
}: SetupWizardProps) {
  const { t, i18n } = useTranslation()
  const { channels } = useGuildContext()
  const isDesktop = useMediaQuery("(min-width: 640px)")

  const [step, setStep] = useState(1)
  const [presetId, setPresetId] = useState<string | null>(null)
  const [channelId, setChannelId] = useState<string | null>(config.notify_channel_id)
  const [activation, setActivation] = useState<Activation>("simulation")

  const textChannels = useMemo(
    () =>
      channels.filter(
        (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
      ),
    [channels]
  )

  const presets = useMemo(() => catalog?.presets ?? [], [catalog])
  const preset: AutomodCatalogPreset | undefined = presets.find((p) => p.id === presetId)
  const ready = !loading && !error && presets.length > 0
  const canNext = step === 1 ? !!preset : step === 2 ? channelId !== null : true

  const lang = i18n.language
  const featureNames = (p: AutomodCatalogPreset) =>
    p.features
      .map((id) => {
        const f = catalog?.features.find((x) => x.id === id)
        return f ? pickLocalized(f.name, lang) : id
      })
      .join(", ")

  const apply = () => {
    if (!preset) return
    onApply(
      applyAutomodPreset(config, preset, presets, {
        notifyChannelId: channelId,
        ...ACTIVATION[activation],
      })
    )
    onOpenChange(false)
    toast.success(t("modules.automod_ai.wizard.applied"))
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    )
  } else if (error) {
    body = (
      <Alert variant="destructive">
        <AlertTitle>{t("modules.automod_ai.catalogErrorTitle")}</AlertTitle>
        <AlertDescription>
          <p>{t("modules.automod_ai.catalogErrorDescription")}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            {t("modules.automod_ai.wizard.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else if (presets.length === 0) {
    body = (
      <Alert>
        <AlertDescription>{t("modules.automod_ai.wizard.noPresets")}</AlertDescription>
      </Alert>
    )
  } else if (step === 1) {
    body = (
      <div role="radiogroup" aria-label={t("modules.automod_ai.wizard.levelLabel")} className="flex flex-col gap-3">
        {presets.map((p) => (
          <ChoiceCard
            key={p.id}
            selected={p.id === presetId}
            onSelect={() => setPresetId(p.id)}
            title={pickLocalized(p.name, lang)}
            description={pickLocalized(p.description, lang)}
          >
            <p className="text-xs text-muted-foreground">
              {t("modules.automod_ai.wizard.detectors", { list: featureNames(p) || "—" })}
              {" · "}
              {t("modules.automod_ai.wizard.severity", { value: p.severity })}
            </p>
          </ChoiceCard>
        ))}
      </div>
    )
  } else if (step === 2) {
    body = (
      <Field>
        <FieldLabel htmlFor="automod-wizard-channel">
          {t("modules.automod_ai.wizard.channelLabel")}
        </FieldLabel>
        <ChannelPicker
          id="automod-wizard-channel"
          value={channelId}
          channels={textChannels}
          onChange={setChannelId}
          placeholder={t("modules.automod_ai.wizard.channelPlaceholder")}
        />
        <FieldDescription>{t("modules.automod_ai.wizard.channelHelp")}</FieldDescription>
      </Field>
    )
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t("modules.automod_ai.wizard.activationLabel")} className="flex flex-col gap-3">
          {ACTIVATION_IDS.map((id) => (
            <ChoiceCard
              key={id}
              selected={activation === id}
              onSelect={() => setActivation(id)}
              title={t(`modules.automod_ai.wizard.activation_${id}`)}
              description={t(`modules.automod_ai.wizard.activation_${id}_desc`)}
            />
          ))}
        </div>
        <Alert>
          <AlertTitle>{t("modules.automod_ai.wizard.changesTitle")}</AlertTitle>
          <AlertDescription>
            <p>{t("modules.automod_ai.wizard.keeps")}</p>
            <p>{t("modules.automod_ai.wizard.changes")}</p>
            <p>{t("modules.automod_ai.wizard.notSaved")}</p>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const title = t("modules.automod_ai.wizard.title")
  const description = ready
    ? t("modules.automod_ai.wizard.step", { current: step, total: STEPS })
    : t("modules.automod_ai.wizard.intro")

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => (step === 1 ? onOpenChange(false) : setStep(step - 1))}
      >
        {step === 1 ? t("common.cancel") : t("modules.automod_ai.wizard.previous")}
      </Button>
      {ready &&
        (step < STEPS ? (
          <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
            {t("modules.automod_ai.wizard.next")}
          </Button>
        ) : (
          <Button type="button" disabled={!preset || channelId === null} onClick={apply}>
            {t("modules.automod_ai.wizard.apply")}
          </Button>
        ))}
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2">{body}</div>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
