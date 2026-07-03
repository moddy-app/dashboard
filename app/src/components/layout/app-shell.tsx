import * as React from "react"
import { Outlet, useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { initialsOf } from "@/lib/cases-format"
import { logout } from "@/lib/auth"
import { useTheme } from "@/hooks/useTheme"
import { useViewer } from "@/hooks/useViewer"
import { SidebarNav } from "./sidebar-nav"

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 px-4">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        M
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Moddy</span>
    </div>
  )
}

function ReferenceJump() {
  const navigate = useNavigate()
  const [value, setValue] = React.useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ref = value.trim().toUpperCase()
    if (ref.length < 4) return
    setValue("")
    navigate(`/cases/${encodeURIComponent(ref)}`)
  }

  return (
    <form onSubmit={submit} className="relative hidden w-56 sm:block">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Aller à une référence…"
        className="h-8 pr-8 font-mono text-xs uppercase placeholder:normal-case placeholder:font-sans"
        aria-label="Aller à une référence de case"
      />
      {value.trim().length >= 4 && (
        <button
          type="submit"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Ouvrir"
        >
          <ArrowRightIcon className="size-3.5" />
        </button>
      )}
    </form>
  )
}

function UserMenu() {
  const viewer = useViewer()
  const { theme, toggle } = useTheme()

  const name = viewer.profile?.display_name ?? "Compte"

  const onLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <Avatar className="size-8">
            <AvatarImage src={viewer.profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-[11px]">
              {initialsOf(name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          {viewer.isStaff && (
            <span className="text-xs font-normal text-muted-foreground">
              Staff Moddy
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggle}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Thème clair" : "Thème sombre"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} variant="destructive">
          <LogOutIcon />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Brand />
        <SidebarNav />
      </aside>

      {/* Colonne principale */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="md:hidden">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Brand />
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ReferenceJump />
            <UserMenu />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
