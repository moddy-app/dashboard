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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Page() {
  return (
    <SidebarProvider>
      {/* Sidebar */}
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>

            <SidebarGroupContent>
              <div className="flex flex-col gap-2 p-2">
                <a href="#" className="text-sm hover:underline">
                  Dashboard
                </a>
                <a href="#" className="text-sm hover:underline">
                  Projects
                </a>
                <a href="#" className="text-sm hover:underline">
                  Settings
                </a>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Main content */}
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
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
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="hidden md:block" />

                <BreadcrumbItem>
                  <BreadcrumbPage>Accueil</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        {/* Content */}
        <main className="flex flex-1 flex-col gap-6 p-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Utilisateurs</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                1 245
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projets</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                32
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenus</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                4 820 €
              </CardContent>
            </Card>
          </div>

          {/* Main panel */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>✅ Nouveau projet créé</p>
              <p>✅ Utilisateur inscrit</p>
              <p>⚠️ Maintenance prévue</p>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
