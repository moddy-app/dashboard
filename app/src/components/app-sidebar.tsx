import * as React from "react"
import {
  BookOpenIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  MessageSquareIcon,
  ActivityIcon,
  GlobeIcon,
  BellIcon,
  ScrollTextIcon,
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
  const { selectedGuildId, guildDetail } = useGuildContext()

  const navUser = {
    name: user ? getDisplayName(user) : "User",
    email: user?.email ?? null,
    avatar: user ? getAvatarUrl(user.user_id, user.avatar, user.avatar_url) : "",
    isStaff: user?.is_staff ?? false,
  }

  // Navigation modules du serveur sélectionné
  const guildNavItems = selectedGuildId
    ? [
        {
          title: t('sidebar.guild.overview'),
          url: `/servers/${selectedGuildId}`,
          icon: LayoutDashboardIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}`,
        },
        {
          title: t('sidebar.guild.modules'),
          url: `#`,
          icon: Settings2Icon,
          isActive: location.pathname.includes('/modules/'),
          items: [
            {
              title: t('modules.starboard.name'),
              url: `/servers/${selectedGuildId}/modules/starboard`,
              icon: StarIcon,
            },
            {
              title: t('modules.welcome_channel.name'),
              url: `/servers/${selectedGuildId}/modules/welcome_channel`,
              icon: MessageSquareIcon,
            },
            {
              title: t('modules.auto_role.name'),
              url: `/servers/${selectedGuildId}/modules/auto_role`,
              icon: UsersIcon,
            },
            {
              title: t('modules.logging.name'),
              url: `/servers/${selectedGuildId}/modules/logging`,
              icon: ScrollTextIcon,
            },
            {
              title: t('modules.auto_restore_roles.name'),
              url: `#`,
              icon: ShieldIcon,
              disabled: true,
            },
            {
              title: t('modules.interserver.name'),
              url: `#`,
              icon: GlobeIcon,
              disabled: true,
            },
            {
              title: t('modules.youtube_notifications.name'),
              url: `#`,
              icon: BellIcon,
              disabled: true,
            },
          ],
        },
        {
          title: t('sidebar.guild.stats'),
          url: `#`,
          icon: ActivityIcon,
          disabled: true,
        },
        {
          title: t('sidebar.guild.premium'),
          url: `#`,
          icon: SparklesIcon,
          disabled: !guildDetail?.attributes?.PREMIUM,
        },
      ]
    : [
        {
          title: t('dashboard.breadcrumb.overview'),
          url: '/',
          icon: LayoutDashboardIcon,
          isActive: location.pathname === '/',
        },
      ]

  // Section staff si l'utilisateur est staff
  const staffNavItems =
    user?.is_staff
      ? [
          {
            title: t('staff.title'),
            url: '/staff',
            icon: ShieldIcon,
            isActive: location.pathname === '/staff',
          },
        ]
      : []

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher onRefreshGuilds={onRefreshGuilds} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={guildNavItems} label={selectedGuildId ? t('sidebar.guild.label') : t('sidebar.general')} />
        {staffNavItems.length > 0 && (
          <NavMain items={staffNavItems} label={t('sidebar.staffLabel')} />
        )}
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
