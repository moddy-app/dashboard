import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ShieldCheckIcon,
  BotIcon,
  Settings2Icon,
  GlobeIcon,
  UserIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getAvatarUrl, getGuildIconUrl } from "@/lib/auth"
import { copyText } from "@/lib/cases"
import { useUserProfile, useGuildProfile } from "@/hooks/useProfile"

// Un « kind » couvre les subject_type / issuer_type / author_type possibles.
export type EntityKind =
  | "discord_user"
  | "discord_guild"
  | "moddy_user"
  | "moddy_staff"
  | "automod"
  | "system"
  | "external"

interface EntityRefProps {
  kind: EntityKind
  id: string | null | undefined
  /** inline = avatar 5 + nom ; block = avatar 9 + nom + id secondaire. */
  variant?: "inline" | "block"
  className?: string
}

const SYSTEM_META: Record<
  "moddy_staff" | "automod" | "system" | "external",
  { icon: typeof BotIcon; labelKey: string; tone: string }
> = {
  moddy_staff: { icon: ShieldCheckIcon, labelKey: "cases.actor.moddy_staff", tone: "text-violet-500" },
  automod: { icon: BotIcon, labelKey: "cases.actor.automod", tone: "text-sky-500" },
  system: { icon: Settings2Icon, labelKey: "cases.actor.system", tone: "text-muted-foreground" },
  external: { icon: GlobeIcon, labelKey: "cases.actor.external", tone: "text-orange-500" },
}

// ─── Utilisateur Discord ──────────────────────────────────────────────────────

function DiscordUserRef({ id, variant, className }: { id: string; variant: "inline" | "block"; className?: string }) {
  const { data, loading } = useUserProfile(id)
  const inline = variant === "inline"
  const avatarUrl = data ? getAvatarUrl(data.user_id, data.avatar, data.avatar_url) : getAvatarUrl(id, null)
  const name = data?.display_name ?? id

  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <Avatar className={cn("shrink-0", inline ? "size-5" : "size-9")}>
        <AvatarImage src={avatarUrl} alt={name} referrerPolicy="no-referrer" />
        <AvatarFallback className={inline ? "text-[9px]" : "text-xs"}>
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {loading && !data ? (
        <Skeleton className={cn(inline ? "h-3.5 w-20" : "h-4 w-28")} />
      ) : (
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", inline ? "text-xs" : "text-sm")}>{name}</span>
          {!inline && <span className="block truncate font-mono text-[11px] text-muted-foreground">{id}</span>}
        </span>
      )}
    </span>
  )
}

// ─── Serveur Discord ──────────────────────────────────────────────────────────

function DiscordGuildRef({ id, variant, className }: { id: string; variant: "inline" | "block"; className?: string }) {
  const { data, loading } = useGuildProfile(id)
  const inline = variant === "inline"
  const iconUrl = data ? getGuildIconUrl(id, data.icon) : null
  const name = data?.name ?? id

  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <Avatar className={cn("shrink-0 rounded-md after:rounded-md", inline ? "size-5" : "size-9")}>
        <AvatarImage src={iconUrl ?? undefined} alt={name} referrerPolicy="no-referrer" className="rounded-md" />
        <AvatarFallback className={cn("rounded-md", inline ? "text-[9px]" : "text-xs")}>
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {loading && !data ? (
        <Skeleton className={cn(inline ? "h-3.5 w-20" : "h-4 w-28")} />
      ) : (
        <span className="min-w-0">
          <span className={cn("block truncate font-medium", inline ? "text-xs" : "text-sm")}>{name}</span>
          {!inline && <span className="block truncate font-mono text-[11px] text-muted-foreground">{id}</span>}
        </span>
      )}
    </span>
  )
}

// ─── Acteur système (staff / automod / system / external) ─────────────────────

function SystemRef({
  kind,
  id,
  variant,
  className,
}: {
  kind: "moddy_staff" | "automod" | "system" | "external"
  id: string | null | undefined
  variant: "inline" | "block"
  className?: string
}) {
  const { t } = useTranslation()
  const inline = variant === "inline"
  const meta = SYSTEM_META[kind]
  const Icon = meta.icon
  // moddy_staff porte souvent l'id Discord du membre du staff : on le résout.
  if (kind === "moddy_staff" && id) {
    return (
      <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
        <DiscordUserRef id={id} variant={variant} />
        <Icon className={cn("shrink-0", meta.tone, inline ? "size-3" : "size-3.5")} />
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted",
          inline ? "size-5" : "size-9"
        )}
      >
        <Icon className={cn(meta.tone, inline ? "size-3" : "size-4")} />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate font-medium", inline ? "text-xs" : "text-sm")}>
          {t(meta.labelKey)}
        </span>
        {!inline && id && (
          <span className="block truncate font-mono text-[11px] text-muted-foreground">{id}</span>
        )}
      </span>
    </span>
  )
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

export function EntityRef({ kind, id, variant = "inline", className }: EntityRefProps) {
  if ((kind === "discord_user" || kind === "moddy_user") && id) {
    return <DiscordUserRef id={id} variant={variant} className={className} />
  }
  if (kind === "discord_guild" && id) {
    return <DiscordGuildRef id={id} variant={variant} className={className} />
  }
  if (kind === "moddy_staff" || kind === "automod" || kind === "system" || kind === "external") {
    return <SystemRef kind={kind} id={id} variant={variant} className={className} />
  }
  // Repli : id brut (rare — ex. moddy_user sans profil Discord).
  const inline = variant === "inline"
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted", inline ? "size-5" : "size-9")}>
        <UserIcon className={cn("text-muted-foreground", inline ? "size-3" : "size-4")} />
      </span>
      <span className={cn("truncate font-mono", inline ? "text-xs" : "text-sm")}>{id ?? "—"}</span>
    </span>
  )
}

// ─── Avatar seul (visuel) ─────────────────────────────────────────────────────

function UserAvatarVisual({ id, className }: { id: string; className?: string }) {
  const { data } = useUserProfile(id)
  const url = data ? getAvatarUrl(data.user_id, data.avatar, data.avatar_url) : getAvatarUrl(id, null)
  const name = data?.display_name ?? id
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarImage src={url} alt={name} referrerPolicy="no-referrer" />
      <AvatarFallback className="text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function GuildAvatarVisual({ id, className }: { id: string; className?: string }) {
  const { data } = useGuildProfile(id)
  const url = data ? getGuildIconUrl(id, data.icon) : null
  const name = data?.name ?? id
  return (
    <Avatar className={cn("size-8 rounded-md after:rounded-md", className)}>
      <AvatarImage src={url ?? undefined} alt={name} referrerPolicy="no-referrer" className="rounded-md" />
      <AvatarFallback className="rounded-md text-xs">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function AvatarVisual({ kind, id, className }: { kind: EntityKind; id: string | null | undefined; className?: string }) {
  if ((kind === "discord_user" || kind === "moddy_user" || kind === "moddy_staff") && id) {
    return <UserAvatarVisual id={id} className={className} />
  }
  if (kind === "discord_guild" && id) {
    return <GuildAvatarVisual id={id} className={className} />
  }
  const meta = kind in SYSTEM_META ? SYSTEM_META[kind as keyof typeof SYSTEM_META] : null
  const Icon = meta?.icon ?? UserIcon
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-full bg-muted", className)}>
      <Icon className={cn("size-4", meta?.tone ?? "text-muted-foreground")} />
    </span>
  )
}

// ─── Avatar cliquable (popover profil) ────────────────────────────────────────
// Affiche uniquement la pp ; au clic, ouvre les infos de l'entité (façon message).

export function EntityAvatar({
  kind,
  id,
  className,
}: {
  kind: EntityKind
  id: string | null | undefined
  className?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const hasProfile =
    !!id &&
    (kind === "discord_user" ||
      kind === "moddy_user" ||
      kind === "moddy_staff" ||
      kind === "discord_guild")

  const avatar = <AvatarVisual kind={kind} id={id} className={className} />
  if (!hasProfile) return avatar

  return (
    <Popover onOpenChange={(o) => !o && setCopied(false)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {avatar}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-2 p-3">
        <EntityRef kind={kind} id={id} variant="block" />
        <button
          type="button"
          onClick={() =>
            copyText(id!).then((ok) => {
              if (!ok) return
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5 shrink-0 animate-in zoom-in-50 text-emerald-500 duration-200" />
          ) : (
            <CopyIcon className="size-3.5 shrink-0" />
          )}
          {copied ? t("cases.detail.copied") : t("cases.detail.copyId")}
        </button>
      </PopoverContent>
    </Popover>
  )
}
