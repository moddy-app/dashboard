import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

// `strokeWidth` est exclu des props transmises : `HugeiconsIcon` ne l'accepte
// qu'en nombre, là où les props SVG l'autorisent aussi en chaîne — l'épaisseur
// est fixée ici de toute façon.
function Spinner({ className, ...props }: Omit<React.ComponentProps<"svg">, "strokeWidth">) {
  return (
    <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
