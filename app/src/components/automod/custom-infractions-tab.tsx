import { useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  AlertCircleIcon,
  Delete02Icon,
  Edit02Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { CustomInfractionDialog } from "@/components/automod/custom-infraction-dialog"
import {
  blankInfraction,
  generateCustomInfractionId,
  infractionFromTemplate,
  pickLocalized,
  removeCustomInfraction,
  upsertCustomInfraction,
} from "@/lib/automod"
import type { AutomodAiConfig, AutomodCatalog, AutomodCustomInfraction } from "@/types/api"

/** Infraction en cours d'édition dans le dialogue. */
interface Editing {
  infraction: AutomodCustomInfraction
  isNew: boolean
}

interface AutomodCustomTabProps {
  guildId: string
  draft: AutomodAiConfig
  savedConfig: AutomodAiConfig | null
  catalog: AutomodCatalog | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onUpdate: (updater: (config: AutomodAiConfig) => AutomodAiConfig) => void
  /** Ids supprimés pendant la session : jamais réutilisés (un id repris hériterait d'un ancien barème). */
  usedIds: RefObject<Set<string>>
  /** Infraction refusée par le PUT, avec la phrase du backend. */
  faulty: { id: string | null; message: string } | null
  onClearFaulty: () => void
  /** Bascule sur l'onglet Barème. */
  onOpenScale: () => void
}

/** Onglet « Infractions personnalisées » : liste, ajout, édition, suppression. */
export function AutomodCustomTab({
  guildId,
  draft,
  savedConfig,
  catalog,
  loading,
  error,
  onRetry,
  onUpdate,
  usedIds,
  faulty,
  onClearFaulty,
  onOpenScale,
}: AutomodCustomTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<AutomodCustomInfraction | null>(null)

  if (error) {
    return (
      <Alert variant="destructive">
        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
        <AlertTitle>{t("modules.automod_ai.catalogErrorTitle")}</AlertTitle>
        <AlertDescription>{t("modules.automod_ai.catalogErrorDescription")}</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t("modules.automod_ai.retry")}
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  if (loading || !catalog) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }

  const list = draft.infractions_perso ?? []
  const limits = catalog.limits
  const full = list.length >= limits.infractions_perso
  const usedTemplates = new Set(list.map((i) => i.modele).filter((m): m is string => Boolean(m)))

  const newId = () =>
    generateCustomInfractionId(
      [...list.map((i) => i.id), ...(savedConfig?.infractions_perso ?? []).map((i) => i.id)],
      usedIds.current ?? []
    )

  const confirmDelete = () => {
    if (!deleting) return
    usedIds.current?.add(deleting.id)
    onUpdate((cfg) => removeCustomInfraction(cfg, deleting.id))
    if (faulty?.id === deleting.id) onClearFaulty()
    setDeleting(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.custom.addTitle")}</CardTitle>
          <CardDescription>
            {t("modules.automod_ai.custom.addDescription", {
              count: list.length,
              max: limits.infractions_perso,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {full && (
            <p className="text-sm text-muted-foreground">{t("modules.automod_ai.custom.full")}</p>
          )}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("modules.automod_ai.custom.fromTemplate")}
            </p>
            <div className="flex flex-wrap gap-2">
              {catalog.templates.map((template) => {
                const used = usedTemplates.has(template.id)
                return (
                  <Button
                    key={template.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={full || used}
                    title={used ? t("modules.automod_ai.custom.templateUsed") : undefined}
                    onClick={() =>
                      setEditing({
                        infraction: infractionFromTemplate(template, newId(), lang),
                        isNew: true,
                      })
                    }
                  >
                    {pickLocalized(template.nom, lang) || template.id}
                  </Button>
                )
              })}
            </div>
          </div>
          <div>
            <Button
              type="button"
              disabled={full}
              onClick={() => setEditing({ infraction: blankInfraction(newId()), isNew: true })}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              {t("modules.automod_ai.custom.fromScratch")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("modules.automod_ai.custom.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("modules.automod_ai.custom.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-2">
          {list.map((infraction, index) => {
            const isFaulty = faulty?.id === infraction.id
            return (
              <Item
                key={infraction.id}
                variant="outline"
                size="sm"
                className={isFaulty ? "border-destructive" : undefined}
              >
                <ItemContent>
                  <ItemTitle className="flex-wrap">
                    {infraction.nom || t("modules.automod_ai.custom.unnamed", { n: index + 1 })}
                    {infraction.modele && (
                      <Badge variant="secondary">{t("modules.automod_ai.custom.fromTemplateBadge")}</Badge>
                    )}
                    {isFaulty && (
                      <Badge variant="destructive">{t("modules.automod_ai.custom.refusedBadge")}</Badge>
                    )}
                  </ItemTitle>
                  <ItemDescription>{infraction.description}</ItemDescription>
                  {isFaulty && faulty && <p className="text-sm text-destructive">{faulty.message}</p>}
                </ItemContent>
                <ItemActions className="flex-wrap">
                  <Button type="button" variant="outline" size="sm" onClick={onOpenScale}>
                    <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
                    {t("modules.automod_ai.custom.openScale")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("modules.automod_ai.custom.edit", { name: infraction.nom })}
                    onClick={() => setEditing({ infraction, isNew: false })}
                  >
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("modules.automod_ai.custom.delete", { name: infraction.nom })}
                    onClick={() => setDeleting(infraction)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </ItemActions>
              </Item>
            )
          })}
        </ItemGroup>
      )}

      {editing && (
        <CustomInfractionDialog
          key={editing.infraction.id}
          guildId={guildId}
          initial={editing.infraction}
          isNew={editing.isNew}
          limits={limits}
          saved={savedConfig?.infractions_perso?.find((i) => i.id === editing.infraction.id)}
          onClose={() => setEditing(null)}
          onSubmit={(infraction) => {
            onUpdate((cfg) => upsertCustomInfraction(cfg, infraction))
            if (faulty?.id === infraction.id) onClearFaulty()
            setEditing(null)
          }}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.automod_ai.custom.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.automod_ai.custom.deleteDescription", { name: deleting?.nom ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.automod_ai.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.automod_ai.custom.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
