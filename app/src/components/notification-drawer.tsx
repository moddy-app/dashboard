import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CheckIcon,
  Loader2Icon,
  MailXIcon,
  RefreshCwIcon,
} from "lucide-react"

import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { getGuildIconUrl } from "@/lib/auth"
import type { User } from "@/lib/auth"
import {
  degradeDiscordSyntax,
  guildLink,
  notificationOrigin,
} from "@/lib/notifications"
import type { InboxNotification, NotificationsState } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DiscordMarkup } from "@/components/discord-markup"
import { VerifiedBadge } from "@/components/verified-badge"
import { ErrorState } from "@/components/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Boîte de réception du compte connecté. Une carte = une ligne `notifications`
// dont le contenu a déjà été résolu (§5–6 du guide d'intégration) : ici on ne
// fait que mettre en forme, jamais substituer.

/** Mise en forme du markdown rendu par `DiscordMarkup` — mêmes variantes que
 *  l'aperçu des messages de bienvenue, pour un rendu cohérent d'un écran à
 *  l'autre. */
const MARKUP_CLASSNAME = cn(
  "text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words",
  "[&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground",
  "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground",
  "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_small]:text-[11px] [&_small]:text-muted-foreground/70",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono",
  "[&_a]:text-primary [&_a]:underline"
)

// ─── Horodatage ──────────────────────────────────────────────────────────────

function formatTimestamp(date: Date, locale: string): string {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
    if (diffMins < 1) return rtf.format(0, "second")
    if (diffMins < 60) return rtf.format(-diffMins, "minute")
    if (diffHours < 24) return rtf.format(-diffHours, "hour")
    if (diffDays < 7) return rtf.format(-diffDays, "day")
  } catch {
    // fallback si le locale n'est pas supporté
  }
  return date.toLocaleDateString(locale, { day: "numeric", month: "short" })
}

// ─── Origine ─────────────────────────────────────────────────────────────────

/**
 * La ligne d'attribution, reproduite depuis Discord (§6.4) : le serveur avec sa
 * coche quand il y en a un, sinon le service Moddy, et **rien du tout** quand
 * Moddy parle en tant qu'institution.
 */
function NotificationOriginLine({
  notification,
  lng,
}: {
  notification: InboxNotification
  lng: string
}) {
  const { t } = useTranslation()
  const origin = notificationOrigin(notification)

  if (origin.type === "none") {
    return (
      <span className="truncate text-xs font-medium text-muted-foreground">
        {t("notifications.origin.moddy", { lng })}
      </span>
    )
  }

  if (origin.type === "service") {
    // Le registre des services est **ouvert** : un id inconnu se dégrade en
    // « Moddy », jamais en clé nue ni en erreur.
    const label =
      notification.source.service_label ||
      t(`notifications.services.${origin.serviceId}`, {
        lng,
        defaultValue: t("notifications.origin.moddy", { lng }),
      })
    return <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
  }

  const iconUrl = origin.icon?.startsWith("http")
    ? origin.icon
    : getGuildIconUrl(origin.guildId, origin.icon)
  const name = origin.name ?? origin.guildId

  return (
    <a
      href={guildLink(origin.guildId)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <Avatar className="size-4 shrink-0 rounded-sm">
        {iconUrl && <AvatarImage src={iconUrl} alt="" />}
        <AvatarFallback className="rounded-sm text-[9px]">
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
      {origin.verified && <VerifiedBadge kind="official" className="[&_svg]:size-3" />}
    </a>
  )
}

// ─── État de livraison Discord ───────────────────────────────────────────────

/**
 * `platforms` est une intention, `notification_deliveries` un fait : un membre
 * dont les DM sont fermés voit ici pourquoi il n'a rien reçu sur Discord.
 * C'est précisément ce qui justifie une boîte de réception sur le dashboard.
 */
function DiscordDeliveryNote({
  notification,
  lng,
}: {
  notification: InboxNotification
  lng: string
}) {
  const { t } = useTranslation()
  const discord = notification.delivery.discord
  if (!discord || discord.status === "sent" || discord.status === "pending") return null

  const Icon = discord.status === "failed" ? AlertTriangleIcon : MailXIcon
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
      <Icon className="mt-0.5 size-3 shrink-0" />
      <span>{t(`notifications.delivery.${discord.status}`, { lng })}</span>
    </p>
  )
}

// ─── Carte ───────────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: InboxNotification
  user: User | null
  onMarkRead: (id: string) => void
}

function NotificationCard({ notification, user, onMarkRead }: NotificationItemProps) {
  const { t, i18n } = useTranslation()
  const { content } = notification

  // §17.7 : le chrome se localise depuis la locale **du message**, pas depuis
  // celle du lecteur — rendre l'habillage en anglais autour d'un corps français
  // est exactement l'erreur que cette colonne existe pour éviter.
  const lng = notification.locale || i18n.language

  // Figé au montage : `Date.now()` lu pendant le rendu rendrait le composant
  // impur (les dates relatives se recalculent à la réouverture du tiroir).
  const [now] = React.useState(() => Date.now())

  const degrade = React.useCallback(
    (text: string) =>
      degradeDiscordSyntax(text, {
        locale: lng,
        now,
        labels: {
          user: t("notifications.mention.user", { lng }),
          role: t("notifications.mention.role", { lng }),
          channel: t("notifications.mention.channel", { lng }),
        },
        selfId: user?.user_id,
        selfName: user?.global_name ?? user?.username,
      }),
    [lng, now, t, user]
  )

  return (
    <article
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200",
        notification.read
          ? "border-border/30 bg-transparent opacity-55"
          : "border-l-2 border-border bg-card shadow-sm"
      )}
      // L'accent est un entier côté base, converti en hex par le service. Pas
      // de couleur = accent par défaut de la surface, jamais une couleur
      // inventée.
      style={
        !notification.read && content.accent_color
          ? { borderLeftColor: content.accent_color }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <NotificationOriginLine notification={notification} lng={lng} />
        <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground/70">
          {formatTimestamp(new Date(notification.created_at), i18n.language)}
        </span>
        {!notification.read && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onMarkRead(notification.id)}
                aria-label={t("notifications.markAsRead")}
                className="ml-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/35 transition-colors hover:bg-muted hover:text-muted-foreground"
              >
                <CheckIcon className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("notifications.markAsRead")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {content.title && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium leading-snug",
            notification.read && "text-muted-foreground"
          )}
        >
          {content.icon_url && (
            <img
              src={content.icon_url}
              alt=""
              className="size-4 shrink-0"
              draggable={false}
              referrerPolicy="no-referrer"
            />
          )}
          <span className="min-w-0">{content.title}</span>
        </p>
      )}

      {/* Le corps est du markdown écrit par un admin de serveur : il passe par
          le rendu contrôlé de DiscordMarkup, jamais par dangerouslySetInnerHTML. */}
      {content.body && (
        <div className={MARKUP_CLASSNAME}>
          <DiscordMarkup text={degrade(content.body)} />
        </div>
      )}

      {content.sections.map((section, index) => (
        <div key={index} className="flex flex-col gap-1">
          {section.title && (
            <p className="text-xs font-semibold text-foreground/90">{section.title}</p>
          )}
          {section.body && (
            <div className={MARKUP_CLASSNAME}>
              <DiscordMarkup text={degrade(section.body)} />
            </div>
          )}
        </div>
      ))}

      {content.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {content.links.map((link, index) => (
            <Button key={index} variant="outline" size="sm" asChild>
              {/* URL fournie par un tiers : `noopener noreferrer` obligatoire,
                  et le service a déjà écarté tout ce qui n'est pas https. */}
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label || link.url}
              </a>
            </Button>
          ))}
        </div>
      )}

      {content.footer && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">{content.footer}</p>
      )}

      <DiscordDeliveryNote notification={notification} lng={lng} />
    </article>
  )
}

// ─── Liste ───────────────────────────────────────────────────────────────────

function NotificationList({
  state,
  user,
}: {
  state: NotificationsState
  user: User | null
}) {
  const { t } = useTranslation()
  const { notifications, loading, loadingMore, error, hasMore, unreadCount } = state

  if (loading) {
    return (
      <div className="flex flex-col gap-2.5 py-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-6">
        <ErrorState error={error} onRetry={state.refresh} />
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <BellIcon className="size-8 text-muted-foreground/25" />
        <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end gap-3 pb-3 pt-1">
        {unreadCount > 0 && (
          <button
            onClick={state.markAllRead}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <CheckCheckIcon className="size-3.5" />
            {t("notifications.markAllAsRead")}
          </button>
        )}
        <button
          onClick={state.refresh}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <RefreshCwIcon className="size-3.5" />
          {t("notifications.refresh")}
        </button>
      </div>

      <div className="flex flex-col gap-2.5 pb-2">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            user={user}
            onMarkRead={state.markRead}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pb-2 pt-1">
          <Button variant="ghost" size="sm" onClick={state.loadMore} disabled={loadingMore}>
            {loadingMore && <Loader2Icon className="animate-spin" />}
            {t("notifications.loadMore")}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export interface NotificationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: NotificationsState
  user: User | null
}

export function NotificationDrawer({
  open,
  onOpenChange,
  state,
  user,
}: NotificationDrawerProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const titleNode = (
    <span className="flex items-center gap-2">
      {t("notifications.title")}
      {state.unreadCount > 0 && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
        >
          {state.unreadCount}
        </Badge>
      )}
    </span>
  )

  const list = <NotificationList state={state} user={user} />

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pb-4 pr-14 pt-6">
            <DialogTitle>{titleNode}</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="no-scrollbar max-h-[60vh] overflow-y-auto px-6 py-2">{list}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">
        <DrawerHeader>
          <DrawerTitle>{titleNode}</DrawerTitle>
        </DrawerHeader>
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-2">{list}</div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">{t("notifications.close")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
