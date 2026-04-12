export type NotificationCriticality = "info" | "success" | "warning" | "critical"

export interface NotificationAction {
  label: string
  href?: string
  variant?: "default" | "outline" | "destructive"
  onClick?: () => void
}

export interface NotificationSender {
  name: string
  avatar?: string
}

export interface Notification {
  id: string
  title: string
  content: string
  sender: NotificationSender
  criticality: NotificationCriticality
  timestamp: Date
  read: boolean
  /** Date après laquelle la notification n'est plus affichée. Si absent, pas d'expiration. */
  expiresAt?: Date
  actions?: NotificationAction[]
}

export function isNotificationExpired(notification: Notification): boolean {
  if (!notification.expiresAt) return false
  return notification.expiresAt < new Date()
}
