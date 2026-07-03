import { BotIcon, CogIcon, GlobeIcon, ShieldIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "@/lib/cases-format"
import { cn } from "@/lib/utils"
import { useGuildProfile, useUserProfile } from "@/hooks/useProfiles"
import type { AuthorType, IssuerType, SubjectType } from "@/services/cases-types"
import {
  GuildHovercard,
  UserHovercard,
  guildIconUrl,
} from "./profile-hovercard"

const AVATAR_SIZE = {
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
} as const

type Size = keyof typeof AVATAR_SIZE

export function UserInline({
  userId,
  size = "sm",
  className,
  showName = true,
}: {
  userId: string
  size?: Size
  className?: string
  showName?: boolean
}) {
  const entry = useUserProfile(userId)
  const name =
    entry.status === "success" ? entry.data.display_name : shortId(userId)
  return (
    <UserHovercard userId={userId}>
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 align-middle",
          className
        )}
      >
        <Avatar className={AVATAR_SIZE[size]}>
          <AvatarImage
            src={
              entry.status === "success"
                ? entry.data.avatar_url ?? undefined
                : undefined
            }
            alt=""
          />
          <AvatarFallback className="text-[9px]">
            {initialsOf(name)}
          </AvatarFallback>
        </Avatar>
        {showName && (
          <span className="truncate text-sm font-medium">{name}</span>
        )}
      </span>
    </UserHovercard>
  )
}

export function GuildInline({
  guildId,
  size = "sm",
  className,
  showName = true,
}: {
  guildId: string
  size?: Size
  className?: string
  showName?: boolean
}) {
  const entry = useGuildProfile(guildId)
  const name = entry.status === "success" ? entry.data.name : shortId(guildId)
  const icon =
    entry.status === "success"
      ? guildIconUrl(entry.data.guild_id, entry.data.icon)
      : null
  return (
    <GuildHovercard guildId={guildId}>
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 align-middle",
          className
        )}
      >
        <Avatar className={cn(AVATAR_SIZE[size], "rounded-[6px]")}>
          <AvatarImage src={icon ?? undefined} alt="" />
          <AvatarFallback className="rounded-[6px] text-[9px]">
            {initialsOf(name)}
          </AvatarFallback>
        </Avatar>
        {showName && (
          <span className="truncate text-sm font-medium">{name}</span>
        )}
      </span>
    </GuildHovercard>
  )
}

function SystemInline({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof CogIcon
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 align-middle text-sm font-medium",
        className
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" />
      </span>
      {label}
    </span>
  )
}

/** Réf d'auteur/émetteur, résolue selon le type. */
export function ActorInline({
  type,
  id,
  size = "sm",
  className,
}: {
  type: IssuerType | AuthorType | null
  id: string | null
  size?: Size
  className?: string
}) {
  if (type === "automod")
    return <SystemInline icon={BotIcon} label="AutoMod" className={className} />
  if (type === "system")
    return <SystemInline icon={CogIcon} label="Système" className={className} />
  if (type === "external")
    return (
      <SystemInline icon={GlobeIcon} label="Externe" className={className} />
    )
  if (!id)
    return (
      <SystemInline icon={CogIcon} label="Système" className={className} />
    )
  if (type === "moddy_staff")
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <UserInline userId={id} size={size} />
        <ShieldIcon
          className="size-3.5 text-primary"
          aria-label="Équipe Moddy"
        />
      </span>
    )
  return <UserInline userId={id} size={size} className={className} />
}

/** Sujet d'une case (utilisateur ou serveur). */
export function SubjectInline({
  subjectType,
  subjectId,
  size = "sm",
  className,
}: {
  subjectType: SubjectType
  subjectId: string
  size?: Size
  className?: string
}) {
  if (subjectType === "discord_guild")
    return <GuildInline guildId={subjectId} size={size} className={className} />
  if (subjectType === "external")
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 align-middle text-sm font-medium",
          className
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <GlobeIcon className="size-3" />
        </span>
        {shortId(subjectId)}
      </span>
    )
  return <UserInline userId={subjectId} size={size} className={className} />
}

function shortId(id: string): string {
  if (id.length <= 10) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}
