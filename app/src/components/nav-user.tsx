import { useState } from "react"
import {
  BellIcon,
  CreditCardIcon,
  ScaleIcon,
  LogOutIcon,
  SparklesIcon,
  ChevronsUpDownIcon,
  SettingsIcon,
  LoaderIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { NavigateFunction } from "react-router-dom"
import { toast } from "sonner"
import { openBillingPortal } from "@/services/guilds"

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
  const [billingLoading, setBillingLoading] = useState(false)

  const handleOpenBilling = async () => {
    setBillingLoading(true)
    try {
      const url = await openBillingPortal()
      window.location.href = url
    } catch {
      toast.error(t('settings.billing.portalError'))
    } finally {
      setBillingLoading(false)
    }
  }

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
                  <AvatarImage src={user.avatar} alt={user.name} referrerPolicy="no-referrer" />
                  <AvatarFallback className="rounded-lg">
                    {user.name?.slice(0, 2)?.toUpperCase() ?? '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">@{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email ?? fullUser?.user_id ?? t('navUser.discordAccount')}
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
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm text-foreground">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} referrerPolicy="no-referrer" />
                    <AvatarFallback className="rounded-lg">
                      {user.name?.slice(0, 2)?.toUpperCase() ?? '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-foreground">@{user.name}</span>
                    <span className="truncate text-xs text-foreground/70">
                      {user.email ?? fullUser?.user_id ?? t('navUser.discordAccount')}
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
                <DropdownMenuItem onClick={handleOpenBilling} disabled={billingLoading}>
                  {billingLoading ? (
                    <LoaderIcon className="animate-spin" />
                  ) : (
                    <CreditCardIcon />
                  )}
                  {t('navUser.billing')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenNotifications}>
                  <BellIcon />
                  {t('navUser.notifications')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigate?.('/cases')}>
                  <ScaleIcon />
                  {t('navUser.myPunishments')}
                </DropdownMenuItem>
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
