import { useState, useCallback, useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import { logout, refreshGuilds } from "@/lib/auth"
import type { User } from "@/lib/auth"
import { EXAMPLE_NOTIFICATIONS } from "@/data/notifications"
import { isNotificationExpired } from "@/types/notification"
import type { Notification } from "@/types/notification"
import { useGuildContext } from "@/contexts/GuildContext"

interface DashboardPageProps {
  user: User | null
}

export function DashboardPage({ user }: DashboardPageProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { selectGuild, guilds, guildDetail, selectedGuildId } = useGuildContext()
  usePageTitle(t('pageTitle.dashboard'))

  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(EXAMPLE_NOTIFICATIONS)
  const welcomeToastShown = useRef(false)

  // Toast de bienvenue à la connexion
  useEffect(() => {
    if (user && !welcomeToastShown.current) {
      welcomeToastShown.current = true
      toast.success(t('dashboard.toast.connected', { username: user.username }), {
        description: t('dashboard.toast.welcome'),
        duration: 4000,
      })
    }
  }, [user, t])

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

  const handleRefreshGuilds = useCallback(async () => {
    await refreshGuilds()
    window.location.reload()
  }, [])

  const activeNotifications = notifications.filter((n) => !isNotificationExpired(n))

  // Détermine le breadcrumb selon la route courante
  const getBreadcrumb = () => {
    const path = location.pathname

    // /servers/:guildId/modules/:moduleId
    const moduleMatch = path.match(/^\/servers\/\d+\/modules\/(.+)$/)
    if (moduleMatch && guildDetail) {
      const moduleId = moduleMatch[1]
      const moduleName = t(`modules.${moduleId}.name`, { defaultValue: moduleId })
      return {
        parent: guildDetail.name,
        parentHref: `/servers/${selectedGuildId}`,
        current: moduleName,
      }
    }

    // /servers/:guildId
    if (path.match(/^\/servers\/\d+/) && guildDetail) {
      return {
        parent: t('dashboard.breadcrumb.app'),
        parentHref: '/',
        current: guildDetail.name,
      }
    }

    // /staff
    if (path === '/staff') {
      return {
        parent: t('dashboard.breadcrumb.app'),
        parentHref: '/',
        current: t('staff.title'),
      }
    }

    // /
    return {
      parent: t('dashboard.breadcrumb.app'),
      parentHref: null,
      current: t('dashboard.breadcrumb.overview'),
    }
  }

  const breadcrumb = getBreadcrumb()

  // Prépare la liste des serveurs pour le command menu
  const servers = guilds.map((g) => ({ name: g.name, id: String(g.id) }))

  return (
    <SidebarProvider>
      <AppSidebar
        user={user}
        onLogoutRequest={handleLogoutRequest}
        onOpenCommandMenu={handleOpenCommandMenu}
        onOpenNotifications={handleOpenNotifications}
        onRefreshGuilds={handleRefreshGuilds}
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
                  {breadcrumb.parentHref ? (
                    <BreadcrumbLink href={breadcrumb.parentHref}>
                      {breadcrumb.parent}
                    </BreadcrumbLink>
                  ) : (
                    <span className="text-foreground font-medium">
                      {breadcrumb.parent}
                    </span>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{breadcrumb.current}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {/* Contenu de la route courante via Outlet */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>

      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        servers={servers}
        onSelectServer={selectGuild}
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
