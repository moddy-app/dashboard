import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2Icon,
  InfoIcon,
  LoaderIcon,
  PartyPopperIcon,
  RefreshCwIcon,
  SettingsIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { getGuildIconUrl, refreshGuilds } from "@/lib/auth"
import type { Guild } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { buildInstallUrl } from "@/services/install"
import type { InstallWelcomeState } from "@/hooks/useInstallWelcome"

interface InstallWelcomeDialogProps {
  state: InstallWelcomeState
  isChecking: boolean
  onDismiss: () => void
  /** Serveurs de la session — le nom et l'icône n'existent que là. */
  guilds: Guild[]
}

/**
 * Écran « Merci d'avoir ajouté Moddy à <serveur> », affiché au retour d'une
 * installation.
 *
 * Le nom et l'icône du serveur **ne sont pas dans la réponse d'installation** :
 * la base ne stocke que des ids. Ils viennent de `/auth/me` → `guilds[]`, où le
 * backend a inséré exprès le serveur fraîchement ajouté (sa liste est mise en
 * cache 5 minutes, sans quoi « Configurer » tomberait sur un 403).
 * La correspondance se fait par id, en chaîne — jamais par `Number()`.
 */
export function InstallWelcomeDialog({
  state,
  isChecking,
  onDismiss,
  guilds,
}: InstallWelcomeDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const open = state.kind !== "idle"

  const handleOpenChange = (next: boolean) => {
    if (!next) onDismiss()
  }

  if (state.kind === "cancelled") {
    // « Annuler » sur l'écran Discord : message neutre, pas une erreur technique.
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("install.cancelled.title")}</DialogTitle>
            <DialogDescription>{t("install.cancelled.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onDismiss}>
              {t("install.cancelled.dismiss")}
            </Button>
            <Button onClick={() => { window.location.href = buildInstallUrl() }}>
              {t("install.cancelled.retry")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const confirmed = install?.confirmed ?? false

  const handleConfigure = () => {
    onDismiss()
    navigate(`/servers/${guildId}`)
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopperIcon className="size-5 text-primary" />
            {guildName
              ? t("install.welcome.titleNamed", { guild: guildName })
              : t("install.welcome.title")}
          </DialogTitle>
          <DialogDescription>{t("install.welcome.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Avatar className="size-10 rounded-lg">
              <AvatarImage src={iconUrl ?? undefined} alt="" />
              <AvatarFallback className="rounded-lg text-xs">
                {(guildName ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-sm font-semibold">
                {guildName ?? t("install.welcome.unknownGuild")}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{guildId}</p>
            </div>
            <div className="ml-auto shrink-0">
              {confirmed ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  {t("install.welcome.confirmed")}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  {isChecking && <LoaderIcon className="size-3.5 animate-spin" />}
                  {t("install.welcome.pending")}
                </Badge>
              )}
            </div>
          </div>

          {/* `confirmed: false` est le délai de la passerelle Discord, pas un échec. */}
          {!confirmed && (
            <p className="text-xs text-muted-foreground">{t("install.welcome.pendingHint")}</p>
          )}

          {/* Rare : Discord n'a pas encore répercuté l'ajout côté session. */}
          {!manageable && (
            <Alert>
              <InfoIcon />
              <AlertTitle>{t("install.welcome.notManageable.title")}</AlertTitle>
              <AlertDescription>
                {t("install.welcome.notManageable.description")}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDismiss}>
            {t("install.welcome.later")}
          </Button>
          {manageable ? (
            <Button onClick={handleConfigure}>
              <SettingsIcon className="size-4" />
              {t("install.welcome.configure")}
            </Button>
          ) : (
            <Button onClick={handleRefreshGuilds} disabled={isRefreshing}>
              {isRefreshing ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              {t("install.welcome.refreshGuilds")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
