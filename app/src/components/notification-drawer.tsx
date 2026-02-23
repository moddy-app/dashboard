"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  XIcon,
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const criticalityConfig: Record<
  NotificationCriticality,
  { icon: React.ElementType; className: string; badgeClassName: string; label: string }
> = {
  info: {
    icon: InfoIcon,
    className: "text-blue-500",
    badgeClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    label: "Info",
  },
  success: {
    icon: CircleCheckIcon,
    className: "text-green-500",
    badgeClassName: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    label: "Succès",
  },
  warning: {
    icon: AlertTriangleIcon,
    className: "text-amber-500",
    badgeClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    label: "Avertissement",
  },
  critical: {
    icon: CircleAlertIcon,
    className: "text-destructive",
    badgeClassName: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Critique",
  },
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return "Hier"
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
}

// ─── Notification item ───────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const { t } = useTranslation()
  const config = criticalityConfig[notification.criticality]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border p-4 transition-colors",
        notification.read
          ? "bg-muted/30 border-border/50"
          : "bg-background border-border shadow-sm"
      )}
    >
      {/* Indicateur non-lu */}
      {!notification.read && (
        <span className="absolute top-3 right-3 size-2 rounded-full bg-primary" />
      )}

      {/* En-tête : criticité + expéditeur + timestamp */}
      <div className="flex items-center gap-2 flex-wrap pr-4">
        <Icon className={cn("size-4 shrink-0", config.className)} />
        <Badge variant="outline" className={cn("text-[11px] px-1.5 py-0", config.badgeClassName)}>
          {t(`notifications.criticality.${notification.criticality}`)}
        </Badge>
        <span className="text-xs text-muted-foreground font-medium">{notification.sender.name}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {formatTimestamp(notification.timestamp)}
        </span>
      </div>

      {/* Titre */}
      <p className={cn("text-sm font-semibold leading-snug", notification.read && "text-muted-foreground")}>
        {notification.title}
      </p>

      {/* Contenu */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {notification.content}
      </p>

      {/* Actions */}
      {(notification.actions && notification.actions.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {notification.actions.map((action, index) => (
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
          ))}
          {!notification.read && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={() => onMarkRead(notification.id)}
            >
              {t('notifications.markAsRead')}
            </Button>
          )}
        </div>
      )}

      {/* Mark as read si pas d'actions */}
      {(!notification.actions || notification.actions.length === 0) && !notification.read && (
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onMarkRead(notification.id)}
          >
            {t('notifications.markAsRead')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Notification list (contenu partagé drawer/dialog) ──────────────────────

interface NotificationListProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  className?: string
}

function NotificationList({
  notifications,
  onMarkRead,
  onMarkAllRead,
  className,
}: NotificationListProps) {
  const { t } = useTranslation()
  const unreadCount = notifications.filter((n) => !n.read).length

  if (notifications.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
        <BellIcon className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {unreadCount > 0 && (
        <div className="flex items-center justify-between px-1 py-2">
          <span className="text-xs text-muted-foreground">
            {t('notifications.unreadCount', { count: unreadCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 text-xs text-muted-foreground gap-1.5"
            onClick={onMarkAllRead}
          >
            <CheckCheckIcon className="size-3.5" />
            {t('notifications.markAllAsRead')}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 pb-2">
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

  const title = (
    <span className="flex items-center gap-2">
      {t('notifications.title')}
      {unreadCount > 0 && (
        <Badge variant="outline" className="tabular-nums px-1.5 py-0 text-[11px]">
          {unreadCount}
        </Badge>
      )}
    </span>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle>{title}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground -mr-1"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="size-4" />
                <span className="sr-only">{t('notifications.close')}</span>
              </Button>
            </div>
          </DialogHeader>
          <Separator />
          <div className="overflow-y-auto flex-1 px-6">
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
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto flex-1 px-4">
          <NotificationList
            notifications={notifications}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
          />
        </div>
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">{t('notifications.close')}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
