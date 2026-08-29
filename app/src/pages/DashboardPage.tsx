import { useState, useCallback, useEffect, useRef, Fragment } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { CommandMenu } from "@/components/command-menu"
import { NotificationDrawer } from "@/components/notification-drawer"
import { SettingsDialog } from "@/components/settings-dialog"
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
import { openBillingPortal } from "@/services/guilds"
import type { User } from "@/lib/auth"
import { useNotifications } from "@/hooks/useNotifications"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctions } from "@/contexts/SanctionContext"
import { DebugModeBadge } from "@/components/debug-error-overlay"
import { InfoBanner } from "@/components/info-banner"
import { useBanner } from "@/hooks/useBanner"
import { DashboardSanctionBanner } from "@/components/violations/sanction-banner"

interface DashboardPageProps {
  user: User | null
}

export function DashboardPage({ user }: DashboardPageProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { selectGuild, guilds, guildDetail, selectedGuildId } = useGuildContext()
  const { groups: sanctionGroups } = useSanctions()
  usePageTitle(t('pageTitle.dashboard'))

  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDefaultTab, setSettingsDefaultTab] = useState('account')
  const [dismissedBannerId, setDismissedBannerId] = useState<number | null>(null)
  const welcomeToastShown = useRef(false)
  const banner = useBanner('show_dashboard')
  // La boîte de réception est chargée ici plutôt que dans le tiroir : la pastille
  // du menu utilisateur a besoin du compte de non-lues sans qu'on l'ouvre.
  const notifications = useNotifications()
  const activeBanner = banner && banner.id !== dismissedBannerId ? banner : null

  // Ouvre les paramètres sur l'onglet ciblé si ?openSettings=<tab> est dans l'URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('openSettings')
    if (tab) {
      setSettingsDefaultTab(tab)
      setSettingsOpen(true)
      navigate(location.pathname, { replace: true })
    }
  }, [location.search, location.pathname, navigate])

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

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const handleRefreshGuilds = useCallback(async () => {
    await refreshGuilds()
    window.location.reload()
  }, [])

  const handleNavigateToStaff = useCallback(() => {
    navigate('/staff')
  }, [navigate])

  const handleOpenBilling = useCallback(async () => {
    try {
      const url = await openBillingPortal()
      window.location.href = url
    } catch {
      toast.error(t('settings.billing.portalError'))
    }
  }, [t])

  // Détermine le breadcrumb (liste de segments) selon la route courante.
  // Chaque segment : { label, href? }. Le dernier segment est la page courante.
  type Crumb = { label: string; href?: string | null }
  const getBreadcrumb = (): Crumb[] => {
    const path = location.pathname
    // Case ouverte (?case=REF) → segment final partagé par les 3 vues.
    const caseRef = new URLSearchParams(location.search).get('case')

    // /cases — mes sanctions (vue personnelle)
    if (path === '/cases') {
      const items: Crumb[] = [
        { label: t('dashboard.breadcrumb.app'), href: '/' },
        { label: t('cases.my.title'), href: caseRef ? '/cases' : null },
      ]
      if (caseRef) items.push({ label: caseRef })
      return items
    }

    // /violations — infractions & sanctions globales
    if (path === '/violations') {
      const groupId = new URLSearchParams(location.search).get('group')
      const items: Crumb[] = [
        { label: t('dashboard.breadcrumb.app'), href: '/' },
        { label: t('violations.title'), href: groupId ? '/violations' : null },
      ]
      if (groupId) {
        // La référence (KEZK6T), pas un libellé générique — comme /cases
        // affiche directement sa référence puisqu'elle vit déjà dans l'URL.
        // Ici l'URL porte le group_id (UUID) : on relit la référence depuis
        // la liste déjà chargée par SanctionProvider, sans appel réseau de plus.
        const references = sanctionGroups.find((g) => g.group_id === groupId)?.references
        items.push({ label: references?.join(', ') || t('violations.detail.breadcrumb') })
      }
      return items
    }

    // /servers/:guildId/cases — modération du serveur
    if (path.match(/^\/servers\/\d+\/cases$/) && guildDetail) {
      const items: Crumb[] = [
        { label: guildDetail.name, href: `/servers/${selectedGuildId}` },
        { label: t('cases.guild.navTitle'), href: caseRef ? `/servers/${selectedGuildId}/cases` : null },
      ]
      if (caseRef) items.push({ label: caseRef })
      return items
    }

    // /servers/:guildId/brocoli — assistant IA
    if (path.match(/^\/servers\/\d+\/brocoli$/) && guildDetail) {
      return [
        { label: guildDetail.name, href: `/servers/${selectedGuildId}` },
        { label: t('brocoli.title') },
      ]
    }

    // /servers/:guildId/settings — réglages du serveur
    if (path.match(/^\/servers\/\d+\/settings$/) && guildDetail) {
      return [
        { label: guildDetail.name, href: `/servers/${selectedGuildId}` },
        { label: t('guildSettings.title') },
      ]
    }

    // /servers/:guildId/modules/:moduleId
    const moduleMatch = path.match(/^\/servers\/\d+\/modules\/(.+)$/)
    if (moduleMatch && guildDetail) {
      const moduleId = moduleMatch[1]
      const moduleName = t(`modules.${moduleId}.name`, { defaultValue: moduleId })
      return [
        { label: guildDetail.name, href: `/servers/${selectedGuildId}` },
        { label: moduleName },
      ]
    }

    // /servers/:guildId
    if (path.match(/^\/servers\/\d+/) && guildDetail) {
      return [
        { label: t('dashboard.breadcrumb.app'), href: '/' },
        { label: guildDetail.name },
      ]
    }

    // /staff — Panel Staff > onglet actif (> case)
    if (path === '/staff') {
      const staffTab = new URLSearchParams(location.search).get('tab') ?? 'stats'
      const items: Crumb[] = [
        { label: t('staff.title'), href: '/staff' },
        {
          label: t(`staff.tabs.${staffTab}`),
          href: staffTab === 'cases' && caseRef ? '/staff?tab=cases' : null,
        },
      ]
      if (staffTab === 'cases' && caseRef) items.push({ label: caseRef })
      return items
    }

    // /premium
    if (path === '/premium') {
      return [
        { label: t('dashboard.breadcrumb.app'), href: '/' },
        { label: 'Moddy Max' },
      ]
    }

    // /
    return [
      { label: t('dashboard.breadcrumb.app') },
      { label: t('dashboard.breadcrumb.overview') },
    ]
  }

  const breadcrumbItems = getBreadcrumb()

  // Prépare la liste des serveurs pour le command menu (avec icône)
  const servers = guilds.map((g) => ({ name: g.name, id: String(g.id), icon: g.icon ?? null }))

  return (
    <div className="flex h-screen flex-col">
      {activeBanner && (
        <InfoBanner
          banner={activeBanner}
          onDismiss={() => setDismissedBannerId(activeBanner.id)}
        />
      )}
      <SidebarProvider className="flex-1 min-h-0">
      <AppSidebar
        user={user}
        onLogoutRequest={handleLogoutRequest}
        onOpenCommandMenu={handleOpenCommandMenu}
        onOpenNotifications={handleOpenNotifications}
        unreadNotifications={notifications.unreadCount}
        onRefreshGuilds={handleRefreshGuilds}
      />
      <SidebarInset className="overflow-hidden">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <div aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbItems.map((crumb, i) => {
                  const isLast = i === breadcrumbItems.length - 1
                  return (
                    <Fragment key={`${crumb.label}-${i}`}>
                      <BreadcrumbItem className={isLast ? undefined : 'hidden md:block'}>
                        {isLast ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : crumb.href ? (
                          <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                        ) : (
                          <span className="text-foreground font-medium">{crumb.label}</span>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {/* Contenu de la route courante via Outlet */}
        <div className="flex flex-1 flex-col gap-6 p-6 overflow-y-auto">
          {/* Sanctions globales — le bandeau décide seul s'il a quelque chose
              à dire selon la route (serveur suspendu, module non activable…). */}
          <DashboardSanctionBanner />
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
        onOpenSettings={handleOpenSettings}
        onOpenBilling={handleOpenBilling}
        onNavigateToStaff={handleNavigateToStaff}
        isStaff={user?.is_staff ?? false}
      />

      <NotificationDrawer
        open={notificationDrawerOpen}
        onOpenChange={setNotificationDrawerOpen}
        state={notifications}
        user={user}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={user}
        defaultTab={settingsDefaultTab}
      />

      {/* Badge debug — visible uniquement si ?debug=true dans l'URL */}
      <DebugModeBadge />

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
    </div>
  )
}
