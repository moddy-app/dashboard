import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  InfoIcon,
  LifeBuoyIcon,
  Loader2Icon,
  RefreshCwIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useMediaQuery } from "@/hooks/use-media-query"
import { getGuildIconUrl, refreshGuilds } from "@/lib/auth"
import type { Guild } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { buildInstallUrl } from "@/services/install"
import type { InstallWelcomeState } from "@/hooks/useInstallWelcome"

/**
 * Écran « Moddy est prêt sur <serveur> », affiché au retour d'une installation.
 *
 * Trois décisions le portent.
 *
 * **1. Il ne fait pas attendre.** L'installation a réussi — la personne revient
 * de l'écran d'autorisation de Discord. Le `confirmed` de `/install/latest` ne
 * dit que si la passerelle a déjà livré l'événement au bot : un détail interne,
 * de l'ordre de la seconde, qui n'a rien à faire à l'écran. Une pastille « en
 * attente » et une roue de chargement faisaient douter d'un succès.
 *
 * **2. Il propose une suite, pas une porte de sortie.** Arriver sur un dashboard
 * vide après avoir ajouté un bot, c'est ne pas savoir par où commencer : l'écran
 * nomme donc trois modules et y mène directement.
 *
 * **3. Il s'adapte au support** : `Dialog` sur grand écran, `Drawer` sur mobile —
 * la même convention que la boîte de réception. Une fenêtre modale centrée sur
 * un téléphone débordait et poussait ses boutons hors de l'écran.
 *
 * Le nom et l'icône du serveur **ne sont pas dans la réponse d'installation** :
 * la base ne stocke que des ids. Ils viennent de `/auth/me` → `guilds[]`, où le
 * backend a inséré exprès le serveur fraîchement ajouté (sa liste est mise en
 * cache 5 minutes, sans quoi « Configurer » tomberait sur un 403).
 * La correspondance se fait par id, en chaîne — jamais par `Number()`.
 */

interface InstallWelcomeDialogProps {
  state: InstallWelcomeState
  onDismiss: () => void
  /** Serveurs de la session — le nom et l'icône n'existent que là. */
  guilds: Guild[]
}

/** Le point de départ que l'écran propose : trois modules, trois routes. */
const QUICK_STARTS = [
  { id: "tickets", to: "modules/tickets", icon: LifeBuoyIcon },
  { id: "logs", to: "modules/logs", icon: ScrollTextIcon },
  { id: "altguard", to: "modules/altguard", icon: ShieldCheckIcon },
] as const

export function InstallWelcomeDialog({ state, onDismiss, guilds }: InstallWelcomeDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isDesktop = useMediaQuery("(min-width: 640px)")

  const open = state.kind !== "idle"

  const handleOpenChange = (next: boolean) => {
    if (!next) onDismiss()
  }

  // « Annuler » sur l'écran Discord : message neutre, pas une erreur technique.
  if (state.kind === "cancelled") {
    const actions = (
      <>
        <Button variant="outline" onClick={onDismiss}>
          {t("install.cancelled.dismiss")}
        </Button>
        <Button
          onClick={() => {
            window.location.href = buildInstallUrl()
          }}
        >
          {t("install.cancelled.retry")}
        </Button>
      </>
    )

    return (
      <Shell
        isDesktop={isDesktop}
        open={open}
        onOpenChange={handleOpenChange}
        title={t("install.cancelled.title")}
        description={t("install.cancelled.description")}
        footer={actions}
      />
    )
  }

  if (state.kind !== "installed") return null

  const { guildId, install } = state
  const guild = guilds.find((g) => String(g.id) === guildId)
  const iconUrl = guild ? getGuildIconUrl(guild.id, guild.icon) : null
  const guildName = guild?.name ?? null
  // `manageable` vient de l'API ; sans elle, la présence dans la liste de la
  // session est la même information vue depuis le dashboard.
  const manageable = install ? install.manageable : guild !== undefined

  const go = (path: string) => {
    onDismiss()
    navigate(path)
  }

  const handleRefreshGuilds = async () => {
    setIsRefreshing(true)
    try {
      await refreshGuilds()
      // La liste vit dans `/auth/me`, chargée une fois au montage : un rechargement
      // est le seul moyen de la réaligner sans dupliquer l'état d'authentification.
      window.location.reload()
    } catch (e) {
      logger.warn("install", "Unable to refresh guild list", e)
      setIsRefreshing(false)
    }
  }

  const body = (
    <div className="flex flex-col gap-5">
      {/* Le serveur, en évidence : c'est ce qu'on vient de faire. */}
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar className="size-16 rounded-2xl ring-4 ring-primary/10">
          <AvatarImage src={iconUrl ?? undefined} alt="" />
          <AvatarFallback className="rounded-2xl text-lg">
            {(guildName ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="text-base font-semibold">
          {guildName ?? t("install.welcome.unknownGuild")}
        </p>
      </div>

      {/* Rare : Discord n'a pas encore répercuté l'ajout côté session. */}
      {!manageable && (
        <Alert>
          <InfoIcon />
          <AlertTitle>{t("install.welcome.notManageable.title")}</AlertTitle>
          <AlertDescription>{t("install.welcome.notManageable.description")}</AlertDescription>
        </Alert>
      )}

      {/* Un dashboard vide ne dit pas par où commencer : on nomme trois modules
          et on y mène. Grisés tant que le serveur n'est pas administrable —
          les ouvrir tomberait sur un 403. */}
      {manageable && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("install.welcome.quickStartTitle")}
          </p>
          {QUICK_STARTS.map(({ id, to, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(`/servers/${guildId}/${to}`)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {t(`install.welcome.quickStart.${id}.title`)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t(`install.welcome.quickStart.${id}.description`)}
                </span>
              </span>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const footer = (
    <>
      <Button variant="ghost" onClick={onDismiss}>
        {t("install.welcome.later")}
      </Button>
      {manageable ? (
        <Button onClick={() => go(`/servers/${guildId}`)}>
          {t("install.welcome.configure")}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      ) : (
        <Button onClick={handleRefreshGuilds} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {t("install.welcome.refreshGuilds")}
        </Button>
      )}
    </>
  )

  return (
    <Shell
      isDesktop={isDesktop}
      open={open}
      onOpenChange={handleOpenChange}
      title={
        guildName
          ? t("install.welcome.titleNamed", { guild: guildName })
          : t("install.welcome.title")
      }
      description={t("install.welcome.description")}
      footer={footer}
    >
      {body}
    </Shell>
  )
}

/**
 * `Dialog` sur grand écran, `Drawer` sur mobile — même convention que la boîte
 * de réception. Les deux exigent un titre : il porte l'accessibilité de la
 * surface, il n'est jamais masqué ici.
 */
function Shell({
  isDesktop,
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  isDesktop: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  footer: React.ReactNode
  children?: React.ReactNode
}) {
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Le contenu défile si le clavier ou un petit écran le comprime ; les
          boutons restent dans le pied, toujours atteignables. */}
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4">{children}</div>
        <DrawerFooter className="flex-row justify-end gap-2">{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
