import * as React from "react"
import {
  BookOpenIcon,
  CrownIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  MailIcon,
  MessageSquareIcon,
  ActivityIcon,
  ScrollTextIcon,
  AlertTriangleIcon,
  ServerIcon,
  ClipboardListIcon,
  BellRingIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  PaletteIcon,
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
import { useSubscription } from "@/hooks/useSubscription"
import { useSanctions } from "@/contexts/SanctionContext"

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
  const subscription = useSubscription()
  const { user: sanction, isExempt } = useSanctions()
  // Une sanction globale ferme la souscription : on **retire** l'entrée plutôt
  // que de la laisser mener à un refus. Un abonnement déjà payé garde la
  // sienne, même rendu inopérant par la sanction (`is_active` retombe alors à
  // `false`) : le portail Stripe n'est jamais bloqué, et résilier doit rester
  // possible.
  const hasBilling = Boolean(subscription?.tier || subscription?.stripe_customer_id)
  const hidePremiumEntry = !isExempt && !hasBilling && sanction.restricted

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
          title: t("cases.guild.navTitle"),
          url: `/servers/${selectedGuildId}/cases`,
          icon: ShieldAlertIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/cases`,
        },
        {
          title: t("modules.starboard.name"),
          url: `/servers/${selectedGuildId}/modules/starboard`,
          icon: StarIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/starboard`,
        },
        {
          title: t("modules.welcome_channel.name"),
          url: `/servers/${selectedGuildId}/modules/welcome_channel`,
          icon: MessageSquareIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/welcome_channel`,
        },
        {
          title: t("modules.welcome_dm.name"),
          url: `/servers/${selectedGuildId}/modules/welcome_dm`,
          icon: MailIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/welcome_dm`,
        },
        {
          title: t("modules.auto_role.name"),
          url: `/servers/${selectedGuildId}/modules/auto_role`,
          icon: UsersIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/auto_role`,
        },
        {
          title: t("modules.logging.name"),
          url: `/servers/${selectedGuildId}/modules/logging`,
          icon: ScrollTextIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/logging`,
        },
        {
          title: t("modules.adaptive_slowmode.name"),
          url: `/servers/${selectedGuildId}/modules/adaptive_slowmode`,
          icon: GaugeIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/adaptive_slowmode`,
        },
        {
          title: t("modules.automod_ai.name"),
          url: `/servers/${selectedGuildId}/modules/automod_ai`,
          icon: SparklesIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/automod_ai`,
        },
        {
          title: t("modules.social_notifications.name"),
          url: `/servers/${selectedGuildId}/modules/social_notifications`,
          icon: BellRingIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/social_notifications`,
        },
        {
          title: t("modules.altguard.name"),
          url: `/servers/${selectedGuildId}/modules/altguard`,
          icon: ShieldCheckIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/altguard`,
        },
        {
          title: t("modules.bot_customization.name"),
          url: `/servers/${selectedGuildId}/modules/bot_customization`,
          icon: PaletteIcon,
          isActive: location.pathname === `/servers/${selectedGuildId}/modules/bot_customization`,
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
        {
          title: t("staff.tabs.forms"),
          url: "/staff?tab=forms",
          icon: ClipboardListIcon,
          isActive: staffTab === "forms",
        },
        {
          title: t("staff.tabs.automodBudget"),
          url: "/staff?tab=automod_budget",
          icon: SparklesIcon,
          isActive: staffTab === "automod_budget",
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
          {!hidePremiumEntry && (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={hasBilling ? t("sidebar.manageSubscription") : "Moddy Max"}
              onClick={() => navigate(hasBilling ? "/?openSettings=billing" : "/premium")}
              isActive={location.pathname === "/premium"}
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:text-violet-300 dark:hover:bg-violet-950/60 data-[active=true]:bg-violet-50 data-[active=true]:text-violet-700 dark:data-[active=true]:bg-violet-950/60 dark:data-[active=true]:text-violet-300"
            >
              <CrownIcon />
              <span>{hasBilling ? t("sidebar.manageSubscription") : "Moddy Max"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("sidebar.search")} onClick={onOpenCommandMenu}>
              <SearchIcon />
              <span>{t("sidebar.search")}</span>
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("sidebar.documentation")}>
              <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
                <BookOpenIcon />
                <span>{t("sidebar.documentation")}</span>
              </a>
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
