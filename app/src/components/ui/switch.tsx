"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// ⚠️ Les sélecteurs d'état sont `data-[state=checked]` / `data-[state=unchecked]`,
// pas `data-checked` / `data-unchecked`. Le registre shadcn sert la variante
// Base UI de ces classes, mais ce projet est sur **Radix**, qui n'expose que
// `data-state="checked" | "unchecked"` (cf. @radix-ui/react-switch). Avec les
// classes d'origine, aucune règle ne s'appliquait : l'interrupteur restait sans
// fond et son curseur ne se déplaçait jamais. Ne pas les « remettre comme
// l'upstream » sans repasser le projet en Base UI.
//
// La géométrie est en nombres entiers pour garder un liseré visible de 2 px
// (1 px de bordure + 1 px de padding) autour du curseur : piste 36×20 et curseur
// de 16 px en taille par défaut, 28×16 et 12 px en taille `sm`. L'ancienne
// version collait le curseur au bord.

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent p-px transition-all outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform",
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3",
          "data-[state=unchecked]:translate-x-0",
          "group-data-[size=default]/switch:data-[state=checked]:translate-x-4",
          "group-data-[size=sm]/switch:data-[state=checked]:translate-x-3",
          "dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
