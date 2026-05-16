import * as React from "react"
import {
  BookOpenIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  StarIcon,
  UsersIcon,
  MessageSquareIcon,
  ActivityIcon,
  ScrollTextIcon,
  AlertTriangleIcon,
  ServerIcon,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate, useLocation } from "react-router-dom"

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
import { getAvatarUrl, getDisplayName, type User } from "@/lib/auth"
import { useGuildContext } from "@/contexts/GuildContext"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User | null
  onLogoutRequest?: () => void
  onOpenCommandMenu?: () => void
  onOpenNotifications?: () => void
  onRefreshGuilds?: () => void
}

export function AppSidebar({
  user,
  onLogoutRequest,
  onOpenCommandMenu,
  onOpenNotifications,
  onRefreshGuilds,
  ...props
}: AppSidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedGuildId, refreshGuildData } = useGuildContext()

  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const isOnStaffPage = location.pathname === "/staff"

  const navUser = {
    name: user ? getDisplayName(user) : "User",
    email: user?.email ?? null,
    avatar: user ? getAvatarUrl(user.user_id, user.avatar, user.avatar_url) : "",
    isStaff: user?.is_staff ?? false,
  }

  const handleRefreshGuildData = async () => {
    setIsRefreshing(true)
    try {
      await refreshGuildData()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Navigation quand un serveur est sélectionné (modules disponibles uniquement)
  const guildNavItems = selectedGuildId && !isOnStaffPage
    ? [
        {
          title: t("sidebar.guild.overview"),
          url: `/servers/${selectedGuildId}`,
          icon: LayoutDashboardIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}`,
        },
        {
          title: t("sidebar.guild.modules"),
          url: "#",
          icon: Settings2Icon,
          isActive: location.pathname.includes("/modules/"),
          items: [
            {
              title: t("modules.starboard.name"),
              url: `/servers/${selectedGuildId}/modules/starboard`,
              icon: StarIcon,
            },
            {
              title: t("modules.welcome_channel.name"),
              url: `/servers/${selectedGuildId}/modules/welcome_channel`,
              icon: MessageSquareIcon,
            },
            {
              title: t("modules.auto_role.name"),
              url: `/servers/${selectedGuildId}/modules/auto_role`,
              icon: UsersIcon,
            },
            {
              title: t("modules.logging.name"),
              url: `/servers/${selectedGuildId}/modules/logging`,
              icon: ScrollTextIcon,
            },
          ],
        },
      ]
    : !isOnStaffPage
    ? [
        {
          title: t("dashboard.breadcrumb.overview"),
          url: "/",
          icon: LayoutDashboardIcon,
          isActive: location.pathname === "/",
        },
      ]
    : []

  // Navigation staff (tabs via URL param ?tab=...)
  const staffTab = new URLSearchParams(location.search).get("tab") ?? "stats"
  const staffNavItems = isOnStaffPage
    ? [
        {
          title: t("staff.tabs.stats"),
          url: "/staff?tab=stats",
          icon: ActivityIcon,
          isActive: staffTab === "stats",
        },
        {
          title: t("staff.tabs.guilds"),
          url: "/staff?tab=guilds",
          icon: ServerIcon,
          isActive: staffTab === "guilds",
        },
        {
          title: t("staff.tabs.users"),
          url: "/staff?tab=users",
          icon: UsersIcon,
          isActive: staffTab === "users",
        },
        {
          title: t("staff.tabs.cases"),
          url: "/staff?tab=cases",
          icon: AlertTriangleIcon,
          isActive: staffTab === "cases",
        },
      ]
    : []

  const navLabel = isOnStaffPage
    ? t("sidebar.staffLabel")
    : selectedGuildId
    ? t("sidebar.guild.label")
    : t("sidebar.general")

  const navItems = isOnStaffPage ? staffNavItems : guildNavItems

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher onRefreshGuilds={onRefreshGuilds} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} label={navLabel} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("sidebar.documentation")}>
              <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
                <BookOpenIcon />
                <span>{t("sidebar.documentation")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("sidebar.getHelp")}>
              <a href="https://moddy.app/support" target="_blank" rel="noopener noreferrer">
                <LifeBuoyIcon />
                <span>{t("sidebar.getHelp")}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {selectedGuildId && !isOnStaffPage && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("guildOverview.refresh")}
                onClick={handleRefreshGuildData}
                disabled={isRefreshing}
              >
                <RefreshCwIcon className={isRefreshing ? "animate-spin" : ""} />
                <span>{t("guildOverview.refresh")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("sidebar.search")} onClick={onOpenCommandMenu}>
              <SearchIcon />
              <span>{t("sidebar.search")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser
          user={navUser}
          fullUser={user}
          onLogoutRequest={onLogoutRequest}
          onOpenNotifications={onOpenNotifications}
          onNavigate={navigate}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
