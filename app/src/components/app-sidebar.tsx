import * as React from "react"
import {
  AudioWaveformIcon,
  BellIcon,
  BookOpenIcon,
  BotIcon,
  CommandIcon,
  GalleryVerticalEndIcon,
  LifeBuoyIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SquareTerminalIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { UserInfo } from "@/lib/auth"

const data = {
  teams: [
    {
      name: "Moddy",
      logo: GalleryVerticalEndIcon,
      plan: "Discord Bot",
    },
    {
      name: "My Server",
      logo: AudioWaveformIcon,
      plan: "Premium",
    },
    {
      name: "Community",
      logo: CommandIcon,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: SquareTerminalIcon,
      isActive: true,
      items: [
        { title: "Overview", url: "#" },
        { title: "Analytics", url: "#" },
        { title: "Activity", url: "#" },
      ],
    },
    {
      title: "Moderation",
      url: "#",
      icon: ShieldIcon,
      items: [
        { title: "Auto-mod", url: "#" },
        { title: "Warnings", url: "#" },
        { title: "Bans", url: "#" },
      ],
    },
    {
      title: "Bot Settings",
      url: "#",
      icon: BotIcon,
      items: [
        { title: "General", url: "#" },
        { title: "Commands", url: "#" },
        { title: "Permissions", url: "#" },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2Icon,
      items: [
        { title: "General", url: "#" },
        { title: "Team", url: "#" },
        { title: "Billing", url: "#" },
        { title: "Limits", url: "#" },
      ],
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userInfo: UserInfo | null
  onLogoutRequest?: () => void
  onOpenCommandMenu?: () => void
  onOpenNotifications?: () => void
}

export function AppSidebar({ userInfo, onLogoutRequest, onOpenCommandMenu, onOpenNotifications, ...props }: AppSidebarProps) {
  const { t } = useTranslation()

  const user = {
    name: userInfo?.username ?? "User",
    email: userInfo?.email ?? "",
    avatar: userInfo?.avatar_url ?? "",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('sidebar.documentation')}>
              <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
                <BookOpenIcon />
                <span>{t('sidebar.documentation')}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('sidebar.getHelp')}>
              <a href="https://moddy.app/support" target="_blank" rel="noopener noreferrer">
                <LifeBuoyIcon />
                <span>{t('sidebar.getHelp')}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t('sidebar.search')} onClick={onOpenCommandMenu}>
              <SearchIcon />
              <span>{t('sidebar.search')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t('sidebar.notifications')} onClick={onOpenNotifications}>
              <BellIcon />
              <span>{t('sidebar.notifications')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} onLogoutRequest={onLogoutRequest} onOpenNotifications={onOpenNotifications} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
