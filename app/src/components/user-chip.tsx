import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserProfile } from "@/hooks/useProfile"
import { getAvatarUrl } from "@/lib/auth"
import { cn } from "@/lib/utils"

/**
 * Nom (et avatar) d'un membre connu par son seul id — un modérateur, un
 * « bumper ». Résolu par `useUserProfile` (cache module, repli public) ;
 * l'id reste affiché si Discord ne répond pas, jamais un vide.
 */
export function UserChip({
  userId,
  className,
  showAvatar = true,
}: {
  userId: string
  className?: string
  showAvatar?: boolean
}) {
  const { t } = useTranslation()
  const { data, loading } = useUserProfile(userId)

  if (loading) return <Skeleton className={cn("inline-block h-4 w-24 align-middle", className)} />

  const name = data?.global_name ?? data?.username ?? userId
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 align-middle", className)}>
      {showAvatar && (
        <Avatar className="size-5">
          <AvatarImage
            src={getAvatarUrl(userId, data?.avatar ?? null, data?.avatar_url)}
            alt={t("common.avatarAlt", { name })}
          />
          <AvatarFallback className="text-[10px]">{name.slice(0, 2)}</AvatarFallback>
        </Avatar>
      )}
      <span className="truncate font-medium">{name}</span>
    </span>
  )
}
