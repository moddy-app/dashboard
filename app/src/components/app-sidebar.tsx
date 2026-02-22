import * as React from "react"
import {
  AudioWaveformIcon,
  BookOpenIcon,
  BotIcon,
  CommandIcon,
  FrameIcon,
  GalleryVerticalEndIcon,
  MapIcon,
  PieChartIcon,
  Settings2Icon,
  ShieldIcon,
  SquareTerminalIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
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
      title: "Documentation",
      url: "#",
      icon: BookOpenIcon,
      items: [
        { title: "Getting Started", url: "#" },
        { title: "API Reference", url: "#" },
        { title: "Changelog", url: "#" },
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
  projects: [
    { name: "Design Engineering", url: "#", icon: FrameIcon },
    { name: "Sales & Marketing", url: "#", icon: PieChartIcon },
    { name: "Travel", url: "#", icon: MapIcon },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userInfo: UserInfo | null
  onLogout?: () => void
  onOpenCommandMenu?: () => void
}

export function AppSidebar({ userInfo, onLogout, onOpenCommandMenu, ...props }: AppSidebarProps) {
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
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} onOpenCommandMenu={onOpenCommandMenu} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
