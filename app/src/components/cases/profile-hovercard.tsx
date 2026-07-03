import {
  BadgeCheckIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { initialsOf } from "@/lib/cases-format"
import { cn } from "@/lib/utils"
import { useGuildProfile, useUserProfile } from "@/hooks/useProfiles"

function Flag({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof ShieldIcon
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        className
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  )
}

export function UserHovercard({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const entry = useUserProfile(userId)
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent>
        {entry.status === "success" ? (
          <div>
            <div
              className="h-16 w-full bg-muted"
              style={
                entry.data.banner_url
                  ? {
                      backgroundImage: `url(${entry.data.banner_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : entry.data.accent_color != null
                    ? { backgroundColor: `#${entry.data.accent_color.toString(16).padStart(6, "0")}` }
                    : undefined
              }
            />
            <div className="px-4 pb-4">
              <Avatar className="-mt-6 size-14 border-4 border-popover">
                <AvatarImage src={entry.data.avatar_url ?? undefined} alt="" />
                <AvatarFallback>
                  {initialsOf(entry.data.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="mt-2">
                <p className="text-sm font-semibold leading-tight">
                  {entry.data.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.data.username}
                  {entry.data.bot && " · Bot"}
                </p>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                {entry.data.is_staff && (
                  <Flag
                    icon={ShieldIcon}
                    label="Staff Moddy"
                    className="border-primary/30 bg-primary/10 text-primary"
                  />
                )}
                {entry.data.is_premium && (
                  <Flag
                    icon={SparklesIcon}
                    label="Premium"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  />
                )}
                {entry.data.is_beta && (
                  <Flag
                    icon={BadgeCheckIcon}
                    label="Bêta"
                    className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  />
                )}
              </div>
              <p className="mt-2.5 font-mono text-[11px] text-muted-foreground">
                {entry.data.user_id}
              </p>
            </div>
          </div>
        ) : entry.status === "error" ? (
          <div className="p-4">
            <p className="text-sm font-medium">Profil indisponible</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {userId}
            </p>
          </div>
        ) : (
          <div className="p-4">
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="mt-3 h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

export function GuildHovercard({
  guildId,
  children,
}: {
  guildId: string
  children: React.ReactNode
}) {
  const entry = useGuildProfile(guildId)
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent>
        {entry.status === "success" ? (
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12 rounded-xl">
                <AvatarImage src={guildIconUrl(entry.data.guild_id, entry.data.icon) ?? undefined} alt="" />
                <AvatarFallback className="rounded-xl">
                  {initialsOf(entry.data.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {entry.data.name}
                </p>
                {entry.data.member_count != null && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="size-3" />
                    {entry.data.member_count.toLocaleString("fr-FR")} membres
                  </p>
                )}
              </div>
            </div>
            {entry.data.description && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {entry.data.description}
              </p>
            )}
            <p className="mt-2.5 font-mono text-[11px] text-muted-foreground">
              {entry.data.guild_id}
            </p>
          </div>
        ) : entry.status === "error" ? (
          <div className="p-4">
            <p className="text-sm font-medium">Serveur indisponible</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {guildId}
            </p>
          </div>
        ) : (
          <div className="p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

export function guildIconUrl(
  guildId: string,
  icon: string | null
): string | null {
  if (!icon) return null
  const ext = icon.startsWith("a_") ? "gif" : "png"
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=128`
}
