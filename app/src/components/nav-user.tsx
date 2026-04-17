import { useState } from "react"
import {
  BellIcon,
  CreditCardIcon,
  GavelIcon,
  LogOutIcon,
  SparklesIcon,
  ChevronsUpDownIcon,
  SettingsIcon,
  ShieldIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { NavigateFunction } from "react-router-dom"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { SettingsDialog } from "@/components/settings-dialog"
import type { User } from "@/lib/auth"

interface NavUserProps {
  user: {
    name: string
    email: string | null
    avatar: string
    isStaff?: boolean
  }
  fullUser?: User | null
  onLogoutRequest?: () => void
  onOpenNotifications?: () => void
  onNavigate?: NavigateFunction
}

export function NavUser({ user, fullUser, onLogoutRequest, onOpenNotifications, onNavigate }: NavUserProps) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name?.slice(0, 2)?.toUpperCase() ?? '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">@{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email ?? t('navUser.discordAccount')}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">
                      {user.name?.slice(0, 2)?.toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">@{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email ?? t('navUser.discordAccount')}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <a href="https://www.moddy.app/navigation/subscriptions/" target="_blank" rel="noopener noreferrer">
                    <SparklesIcon />
                    {t('navUser.upgradeToMax')}
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon />
                  {t('navUser.settings')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <CreditCardIcon />
                  {t('navUser.billing')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenNotifications}>
                  <BellIcon />
                  {t('navUser.notifications')}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <GavelIcon />
                  {t('navUser.myPunishments')}
                </DropdownMenuItem>
                {user.isStaff && (
                  <DropdownMenuItem onClick={() => onNavigate?.('/staff')}>
                    <ShieldIcon />
                    {t('navUser.staffPanel')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onLogoutRequest}>
                <LogOutIcon />
                {t('navUser.logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={fullUser ?? null}
      />
    </>
  )
}
