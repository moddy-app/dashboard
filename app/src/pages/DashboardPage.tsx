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
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { logout } from "@/lib/auth"
import type { UserInfo } from "@/lib/auth"

interface DashboardPageProps {
  userInfo: UserInfo | null
}

export function DashboardPage({ userInfo }: DashboardPageProps) {
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.dashboard'))
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
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
    if (userInfo && !welcomeToastShown.current) {
      welcomeToastShown.current = true
      toast.success(`Connecté en tant que ${userInfo.username}`, {
        description: "Bienvenue sur le dashboard Moddy",
        duration: 4000,
      })
    }
  }, [userInfo])

  const handleLogout = useCallback(async () => {
    const success = await logout()
    if (success) {
      window.location.reload()
    }
  }, [])

  const handleOpenCommandMenu = useCallback(() => {
    setCommandMenuOpen(true)
  }, [])

  // Aucun serveur sélectionné — empty state
  const noServerSelected = true // TODO: remplacer par la vraie logique de sélection de serveur

  return (
    <SidebarProvider>
      <AppSidebar
        userInfo={userInfo}
        onLogout={handleLogout}
        onOpenCommandMenu={handleOpenCommandMenu}
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
                  <EmptyTitle>Aucun serveur sélectionné</EmptyTitle>
                  <EmptyDescription>
                    Sélectionnez un serveur dans la barre latérale ou ajoutez Moddy à l&apos;un de vos serveurs Discord pour commencer.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="flex-row justify-center gap-2">
                  <Button
                    onClick={() => window.open("https://discord.com/oauth2/authorize?client_id=1373916203814490194", "_blank", "noopener,noreferrer")}
                  >
                    <PlusIcon className="size-4" />
                    Ajouter Moddy
                  </Button>
                  <Button variant="outline" onClick={handleOpenCommandMenu}>
                    Parcourir les serveurs
                  </Button>
                </EmptyContent>
                <Button
                  variant="link"
                  asChild
                  className="text-muted-foreground"
                  size="sm"
                >
                  <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
                    En savoir plus <ArrowUpRightIcon className="size-3" />
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
        onLogout={handleLogout}
      />
    </SidebarProvider>
  )
}
