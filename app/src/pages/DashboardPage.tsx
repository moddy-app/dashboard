import { useState, useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ServerIcon, PlusIcon, ArrowUpRightIcon } from "lucide-react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { CommandMenu } from "@/components/command-menu"
import { NotificationDrawer } from "@/components/notification-drawer"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { logout } from "@/lib/auth"
import type { User } from "@/lib/auth"
import { EXAMPLE_NOTIFICATIONS } from "@/data/notifications"
import { isNotificationExpired } from "@/types/notification"
import type { Notification } from "@/types/notification"

interface DashboardPageProps {
  user: User | null
}

export function DashboardPage({ user }: DashboardPageProps) {
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.dashboard'))

  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(EXAMPLE_NOTIFICATIONS)
  const welcomeToastShown = useRef(false)

  // Auto-ouvrir le command menu au premier chargement
  useEffect(() => {
    const timer = setTimeout(() => {
      setCommandMenuOpen(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Toast de bienvenue à la connexion
  useEffect(() => {
    if (user && !welcomeToastShown.current) {
      welcomeToastShown.current = true
      toast.success(t('dashboard.toast.connected', { username: user.username }), {
        description: t('dashboard.toast.welcome'),
        duration: 4000,
      })
    }
  }, [userInfo, t])

  const handleLogout = useCallback(async () => {
    setLogoutDialogOpen(false)
    const success = await logout()
    if (success) {
      window.location.reload()
    }
  }, [])

  const handleLogoutRequest = useCallback(() => {
    setLogoutDialogOpen(true)
  }, [])

  const handleOpenCommandMenu = useCallback(() => {
    setCommandMenuOpen(true)
  }, [])

  const handleOpenNotifications = useCallback(() => {
    setNotificationDrawerOpen(true)
  }, [])

  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const activeNotifications = notifications.filter((n) => !isNotificationExpired(n))

  // Aucun serveur sélectionné — empty state
  const noServerSelected = true // TODO: remplacer par la vraie logique de sélection de serveur

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        onLogoutRequest={handleLogoutRequest}
        onOpenCommandMenu={handleOpenCommandMenu}
        onOpenNotifications={handleOpenNotifications}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    {t('dashboard.breadcrumb.app')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('dashboard.breadcrumb.overview')}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {noServerSelected ? (
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
              <Empty className="border border-dashed max-w-md">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ServerIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t('dashboard.noServer.title')}</EmptyTitle>
                  <EmptyDescription>
                    {t('dashboard.noServer.description')}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button
                    onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=1373916203814490194", "_blank", "noopener,noreferrer")}
                  >
                    <PlusIcon className="size-4" />
                    {t('dashboard.noServer.addModdy')}
                  </Button>
                  <Button variant="outline" onClick={handleOpenCommandMenu}>
                    {t('dashboard.noServer.browseServers')}
                  </Button>
                </EmptyContent>
                <Button
                  variant="link"
                  asChild
                  className="text-muted-foreground"
                  size="sm"
                >
                  <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
                    {t('dashboard.noServer.learnMore')} <ArrowUpRightIcon className="size-3" />
                  </a>
                </Button>
              </Empty>
            </div>
          ) : (
            <>
              <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                <div className="bg-muted/50 aspect-video rounded-xl" />
                <div className="bg-muted/50 aspect-video rounded-xl" />
                <div className="bg-muted/50 aspect-video rounded-xl" />
              </div>
              <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
            </>
          )}
        </div>
      </SidebarInset>

      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onLogoutRequest={handleLogoutRequest}
        onOpenNotifications={handleOpenNotifications}
      />

      <NotificationDrawer
        open={notificationDrawerOpen}
        onOpenChange={setNotificationDrawerOpen}
        notifications={activeNotifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('navUser.logoutDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('navUser.logoutDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              {t('navUser.logoutDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              {t('navUser.logoutDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
