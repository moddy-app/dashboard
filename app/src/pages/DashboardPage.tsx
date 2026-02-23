import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
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
import { logout } from "@/lib/auth"
import type { UserInfo } from "@/lib/auth"

interface DashboardPageProps {
  userInfo: UserInfo | null
}

export function DashboardPage({ userInfo }: DashboardPageProps) {
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.dashboard'))
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    const success = await logout()
    if (success) {
      window.location.reload()
    }
  }, [])

  const handleOpenCommandMenu = useCallback(() => {
    setCommandMenuOpen(true)
  }, [])

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
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="bg-muted/50 aspect-video rounded-xl" />
            <div className="bg-muted/50 aspect-video rounded-xl" />
            <div className="bg-muted/50 aspect-video rounded-xl" />
          </div>
          <div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
        </div>
      </SidebarInset>
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />
    </SidebarProvider>
  )
}
