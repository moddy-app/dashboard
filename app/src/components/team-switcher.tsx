import { ChevronsUpDownIcon, PlusIcon, RefreshCwIcon, ServerIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useGuildContext } from "@/contexts/GuildContext"
import { getGuildIconUrl } from "@/lib/auth"

interface TeamSwitcherProps {
  onRefreshGuilds?: () => void
}

export function TeamSwitcher({ onRefreshGuilds }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const { guilds, selectedGuildId, selectGuild, guildDetail } = useGuildContext()

  // Serveur actif — utilise guildDetail si chargé, sinon trouve dans la liste basique
  const activeGuildBase = guilds.find((g) => String(g.id) === selectedGuildId) ?? null
  const activeName = guildDetail?.name ?? activeGuildBase?.name ?? null
  const activeIcon = guildDetail?.icon ?? activeGuildBase?.icon ?? null
  const activeId = guildDetail?.guild_id ?? activeGuildBase?.id ?? null

  const activeIconUrl = activeId != null ? getGuildIconUrl(activeId, activeIcon) : null

  const activeInitial = activeName?.slice(0, 2).toUpperCase() ?? "??"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {activeName ? (
                <>
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={activeIconUrl ?? undefined} alt={activeName} />
                    <AvatarFallback className="rounded-lg text-xs">
                      {activeInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{activeName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t('teamSwitcher.server')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <ServerIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Moddy</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {t('teamSwitcher.selectServer')}
                    </span>
                  </div>
                </>
              )}
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('teamSwitcher.myServers')}
            </DropdownMenuLabel>

            {guilds.length > 0 ? (
              guilds.map((guild) => {
                const iconUrl = getGuildIconUrl(guild.id, guild.icon)
                const initials = guild.name.slice(0, 2).toUpperCase()
                const isActive = String(guild.id) === selectedGuildId

                return (
                  <DropdownMenuItem
                    key={guild.id}
                    onClick={() => selectGuild(String(guild.id))}
                    className="gap-2 p-2"
                    data-active={isActive}
                  >
                    <Avatar className="size-6 rounded-sm">
                      <AvatarImage src={iconUrl ?? undefined} alt={guild.name} />
                      <AvatarFallback className="rounded-sm text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{guild.name}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                )
              })
            ) : (
              <DropdownMenuItem disabled className="gap-2 p-2">
                <ServerIcon className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">
                  {t('teamSwitcher.noServers')}
                </span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() =>
                window.open(
                  "https://discord.com/oauth2/authorize?client_id=1373916203814490194",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                {t('teamSwitcher.addServer')}
              </span>
            </DropdownMenuItem>

            {onRefreshGuilds && (
              <DropdownMenuItem className="gap-2 p-2" onClick={onRefreshGuilds}>
                <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                  <RefreshCwIcon className="size-4" />
                </div>
                <span className="font-medium text-muted-foreground">
                  {t('teamSwitcher.refreshServers')}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
