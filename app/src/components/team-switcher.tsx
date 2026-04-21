import { useState } from "react"
import { ChevronsUpDownIcon, LoaderIcon, PlusIcon, RefreshCwIcon, ServerIcon, ShieldIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"

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
import { logger } from "@/lib/logger"

interface TeamSwitcherProps {
  onRefreshGuilds?: () => void
}

export function TeamSwitcher({ onRefreshGuilds }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { guilds, selectedGuildId, selectGuild, guildDetail, user } = useGuildContext()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefreshClick = async () => {
    if (!onRefreshGuilds || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefreshGuilds()
    } finally {
      setIsRefreshing(false)
    }
  }

  const isOnStaffPage = location.pathname === "/staff"

  // Serveur actif — utilise guildDetail si chargé, sinon trouve dans la liste basique
  const activeGuildBase = guilds.find((g) => String(g.id) === selectedGuildId) ?? null
  const activeName = guildDetail?.name ?? activeGuildBase?.name ?? null
  const activeIcon = guildDetail?.icon ?? activeGuildBase?.icon ?? null
  const activeId = guildDetail?.guild_id ?? activeGuildBase?.id ?? null

  const activeIconUrl = activeId != null ? getGuildIconUrl(activeId, activeIcon) : null
  const activeInitial = activeName?.slice(0, 2).toUpperCase() ?? "??"

  const renderTriggerContent = () => {
    // Staff panel selected
    if (isOnStaffPage) {
      return (
        <>
          <div className="bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
            <ShieldIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{t("staff.title")}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t("teamSwitcher.staffPanel")}
            </span>
          </div>
        </>
      )
    }

    // Serveur sélectionné
    if (activeName) {
      return (
        <>
          <Avatar className="size-8 rounded-lg shrink-0">
            <AvatarImage
              src={activeIconUrl ?? undefined}
              alt={activeName}
              referrerPolicy="no-referrer"
              onError={() => logger.warn("avatar", `Failed to load guild icon ${activeId}`, activeIconUrl)}
              onLoad={() => logger.debug("avatar", `Loaded guild icon ${activeId}`)}
            />
            <AvatarFallback className="rounded-lg text-xs">
              {activeInitial}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{activeName}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t("teamSwitcher.server")}
            </span>
          </div>
        </>
      )
    }

    // Aucun serveur sélectionné
    return (
      <>
        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shrink-0">
          <ServerIcon className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{t("teamSwitcher.noServerSelected")}</span>
          <span className="truncate text-xs text-muted-foreground">
            {t("teamSwitcher.selectServer")}
          </span>
        </div>
      </>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {renderTriggerContent()}
              <ChevronsUpDownIcon className="ml-auto size-4 shrink-0" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            {/* Section Mes serveurs */}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t("teamSwitcher.myServers")}
            </DropdownMenuLabel>

            {guilds.length > 0 ? (
              guilds.map((guild) => {
                const iconUrl = getGuildIconUrl(guild.id, guild.icon)
                const initials = guild.name?.slice(0, 2)?.toUpperCase() ?? "??"
                const isActive = String(guild.id) === selectedGuildId && !isOnStaffPage

                return (
                  <DropdownMenuItem
                    key={guild.id}
                    onClick={() => selectGuild(String(guild.id))}
                    className="gap-2 p-2"
                    data-active={isActive}
                  >
                    <Avatar className="size-6 rounded-sm shrink-0">
                      <AvatarImage
                        src={iconUrl ?? undefined}
                        alt={guild.name}
                        referrerPolicy="no-referrer"
                        onError={() => logger.warn("avatar", `Failed to load guild icon ${guild.id}`, iconUrl)}
                      />
                      <AvatarFallback className="rounded-sm text-[10px]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{guild.name}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                )
              })
            ) : (
              <DropdownMenuItem disabled className="gap-2 p-2">
                <ServerIcon className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">
                  {t("teamSwitcher.noServers")}
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
              <div className="bg-background flex size-6 items-center justify-center rounded-md border shrink-0">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">
                {t("teamSwitcher.addServer")}
              </span>
            </DropdownMenuItem>

            {onRefreshGuilds && (
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={(e) => {
                  e.preventDefault()
                  handleRefreshClick()
                }}
                disabled={isRefreshing}
              >
                <div className="bg-background flex size-6 items-center justify-center rounded-md border shrink-0">
                  {isRefreshing ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                </div>
                <span className="font-medium text-muted-foreground">
                  {t("teamSwitcher.refreshServers")}
                </span>
              </DropdownMenuItem>
            )}

            {/* Section Staff — uniquement pour les membres staff */}
            {user?.is_staff && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t("sidebar.staffLabel")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={() => navigate("/staff")}
                  data-active={isOnStaffPage}
                >
                  <div className="bg-red-100 dark:bg-red-950 flex size-6 items-center justify-center rounded-md shrink-0">
                    <ShieldIcon className="size-3.5 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="truncate">{t("staff.title")}</span>
                  {isOnStaffPage && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
