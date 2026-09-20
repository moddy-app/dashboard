import type { ReactNode } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { absoluteTime, relativeTime } from "@/lib/cases"
import { authorInitials } from "@/lib/transcripts"
import { cn } from "@/lib/utils"

// Briques de ligne partagées par les trois listes du module — tickets vivants,
// archives et avis. Elles vivent ici plutôt que dans l'explorateur pour que les
// trois listes se ressemblent **par construction** : une ligne d'avis et une
// ligne de ticket doivent se lire pareil, sinon l'onglet d'à côté a l'air
// d'appartenir à un autre produit.

/** Point de séparation dans une ligne de méta — même motif que `case-list.tsx`. */
export function Dot() {
  return <span className="size-1 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
}

/** Horodatage relatif, avec la date absolue en infobulle au survol. */
export function RelativeTime({
  iso,
  locale,
  className,
}: {
  iso: string
  locale: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("shrink-0 tabular-nums", className)}>{relativeTime(iso, locale)}</span>
      </TooltipTrigger>
      <TooltipContent>{absoluteTime(iso, locale)}</TooltipContent>
    </Tooltip>
  )
}

/** Avatar minuscule (agent qui a pris en charge, agent noté). */
export function MiniAvatar({ url, name }: { url?: string | null; name: string }) {
  return (
    <Avatar className="size-4">
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="text-[8px]">{authorInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

/** Avatar d'en-tête de ligne (auteur du ticket, agent noté). */
export function RowAvatar({ url, name }: { url?: string | null; name: string }) {
  return (
    <Avatar className="size-8 shrink-0">
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback className="text-xs">{authorInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

/** Compteur d'en-tête de liste. */
export function StatTile({
  label,
  value,
  text,
}: {
  label: string
  value?: number
  text?: string
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {text ?? (value === undefined ? "—" : value)}
      </p>
    </div>
  )
}

/**
 * Coquille d'une ligne de liste. Cliquable quand `onClick` est fourni — c'est
 * alors un vrai `<button>`, jamais un `<div>` avec un gestionnaire de clic.
 */
export function ListRow({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const className = "flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"

  if (!onClick) return <div className={className}>{children}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("group transition-colors hover:bg-muted/50", className)}
    >
      {children}
    </button>
  )
}
