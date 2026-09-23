import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Rocket01Icon } from "@hugeicons/core-free-icons"
import { directoryIconUrl } from "@/lib/bump-reminder"
import { cn } from "@/lib/utils"

/**
 * Émoji Discord de l'annuaire. Un annuaire inconnu (ajouté au catalogue sans
 * émoji) ou une image qui ne charge pas retombe sur une icône générique.
 */
export function DirectoryIcon({ bot, className }: { bot: string; className?: string }) {
  const url = directoryIconUrl(bot)
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <span className={cn("flex size-6 shrink-0 items-center justify-center text-muted-foreground", className)}>
        <HugeiconsIcon icon={Rocket01Icon} strokeWidth={2} className="size-4" />
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("size-6 shrink-0 object-contain", className)}
    />
  )
}
