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
  actions?: NotificationAction[]
}
