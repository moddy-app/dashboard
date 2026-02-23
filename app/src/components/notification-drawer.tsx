import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
} from "lucide-react"

import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import type { Notification, NotificationCriticality } from "@/types/notification"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

// ─── Criticality config ──────────────────────────────────────────────────────

const criticalityConfig: Record<
  NotificationCriticality,
  { Icon: React.ElementType; badgeClassName: string; accentClassName: string }
> = {
  info: {
    Icon: InfoIcon,
    badgeClassName:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    accentClassName: "border-l-blue-400 dark:border-l-blue-500",
  },
  success: {
    Icon: CircleCheckIcon,
    badgeClassName:
      "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
    accentClassName: "border-l-green-400 dark:border-l-green-500",
  },
  warning: {
    Icon: AlertTriangleIcon,
    badgeClassName:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    accentClassName: "border-l-amber-400 dark:border-l-amber-500",
  },
  critical: {
    Icon: CircleAlertIcon,
    badgeClassName:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    accentClassName: "border-l-red-400 dark:border-l-red-500",
  },
}

// ─── Timestamp ───────────────────────────────────────────────────────────────

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

// ─── Notification item ───────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const { t, i18n } = useTranslation()
  const config = criticalityConfig[notification.criticality]
  const { Icon } = config

  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200",
        notification.read
          ? "border-border/30 bg-transparent opacity-55"
          : cn(
              "border-l-2 border-border bg-card shadow-sm",
              config.accentClassName
            )
      )}
    >
      {/* Méta : badge + expéditeur + timestamp + check */}
      <div className="flex items-center gap-2 min-w-0">
        <Badge
          variant="outline"
          className={cn("shrink-0 font-medium", config.badgeClassName)}
        >
          <Icon data-icon="inline-start" />
          {t(`notifications.criticality.${notification.criticality}`)}
        </Badge>
        <span className="text-xs text-muted-foreground truncate">
          {notification.sender.name}
        </span>
        <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground/70 tabular-nums">
          {formatTimestamp(notification.timestamp, i18n.language)}
        </span>
        {!notification.read && (
          <button
            onClick={() => onMarkRead(notification.id)}
            title={t("notifications.markAsRead")}
            className="ml-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/35 transition-colors hover:bg-muted hover:text-muted-foreground"
          >
            <CheckIcon className="size-3" />
          </button>
        )}
      </div>

      {/* Titre + contenu */}
      <div className="flex flex-col gap-1.5">
        <p
          className={cn(
            "text-sm font-medium leading-snug",
            notification.read && "text-muted-foreground"
          )}
        >
          {notification.title}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {notification.content}
        </p>
      </div>

      {/* Actions */}
      {notification.actions && notification.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {notification.actions.map((action, index) =>
            action.href ? (
              <Button
                key={index}
                variant={action.variant ?? "outline"}
                size="sm"
                asChild
              >
                <a href={action.href} target="_blank" rel="noopener noreferrer">
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button
                key={index}
                variant={action.variant ?? "outline"}
                size="sm"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Notification list ───────────────────────────────────────────────────────

interface NotificationListProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

function NotificationList({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationListProps) {
  const { t } = useTranslation()
  const unreadCount = notifications.filter((n) => !n.read).length

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
      {unreadCount > 0 && (
        <div className="flex justify-end pb-3 pt-1">
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
          >
            <CheckCheckIcon className="size-3.5" />
            {t("notifications.markAllAsRead")}
          </button>
        </div>
      )}
      <div className={cn("flex flex-col gap-2.5 pb-2", unreadCount === 0 && "pt-2")}>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export interface NotificationDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export function NotificationDrawer({
  open,
  onOpenChange,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationDrawerProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const unreadCount = notifications.filter((n) => !n.read).length

  const titleNode = (
    <span className="flex items-center gap-2">
      {t("notifications.title")}
      {unreadCount > 0 && (
        <Badge
          variant="secondary"
          className="h-5 px-1.5 text-[11px] font-medium tabular-nums"
        >
          {unreadCount}
        </Badge>
      )}
    </span>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg gap-0 p-0">
          <DialogHeader className="px-6 pb-4 pt-6 pr-14">
            <DialogTitle>{titleNode}</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="no-scrollbar max-h-[60vh] overflow-y-auto px-6 py-2">
            <NotificationList
              notifications={notifications}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
            />
          </div>
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
        <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-2">
          <NotificationList
            notifications={notifications}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
          />
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">{t("notifications.close")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
