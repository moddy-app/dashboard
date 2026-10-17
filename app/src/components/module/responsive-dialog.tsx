import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

// Dialog au-dessus de `sm`, Drawer en dessous (convention de la boîte de
// réception). Le Title est obligatoire pour l'accessibilité : masquez-le avec
// `className="sr-only"` si le design ne le montre pas.

const ResponsiveContext = React.createContext<boolean>(true)

interface ResponsiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /** Classes de la boîte (largeur du Dialog, hauteur du Drawer…). */
  className?: string
}

function ResponsiveDialog({ open, onOpenChange, children, className }: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 640px)")
  return (
    <ResponsiveContext.Provider value={isDesktop}>
      {isDesktop ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className={cn("flex max-h-[85vh] flex-col gap-4", className)}>
            {children}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className={cn("max-h-[92dvh]", className)}>{children}</DrawerContent>
        </Drawer>
      )}
    </ResponsiveContext.Provider>
  )
}

function ResponsiveDialogHeader(props: React.ComponentProps<"div">) {
  return React.useContext(ResponsiveContext) ? <DialogHeader {...props} /> : <DrawerHeader {...props} />
}

function ResponsiveDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return React.useContext(ResponsiveContext) ? <DialogTitle {...props} /> : <DrawerTitle {...props} />
}

function ResponsiveDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return React.useContext(ResponsiveContext) ? (
    <DialogDescription {...props} />
  ) : (
    <DrawerDescription {...props} />
  )
}

/** Zone défilante entre l'en-tête et le pied. */
function ResponsiveDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  const isDesktop = React.useContext(ResponsiveContext)
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto", !isDesktop && "px-4", className)}
      {...props}
    />
  )
}

function ResponsiveDialogFooter(props: React.ComponentProps<"div">) {
  return React.useContext(ResponsiveContext) ? <DialogFooter {...props} /> : <DrawerFooter {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
}
