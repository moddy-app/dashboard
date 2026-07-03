import * as React from "react"

import { verifySession } from "@/lib/auth"
import { getUserProfile } from "@/services/cases"
import type { UserProfile } from "@/services/cases-types"

const MODERATOR_ROLES = ["Dev", "Manager", "Supervisor_Mod", "Moderator"]

export type Viewer = {
  status: "loading" | "authenticated" | "unauthenticated"
  discordId: string | null
  profile: UserProfile | null
  isStaff: boolean
  /** Indice UI : rôle susceptible de créer/modifier (l'API reste l'autorité). */
  isModerator: boolean
}

const ViewerContext = React.createContext<Viewer | null>(null)

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewer] = React.useState<Viewer>({
    status: "loading",
    discordId: null,
    profile: null,
    isStaff: false,
    isModerator: false,
  })

  React.useEffect(() => {
    let active = true
    async function run() {
      const session = await verifySession()
      if (!active) return
      if (!session.valid || !session.discord_id) {
        setViewer({
          status: "unauthenticated",
          discordId: null,
          profile: null,
          isStaff: false,
          isModerator: false,
        })
        return
      }
      const discordId = String(session.discord_id)
      let profile: UserProfile | null = null
      try {
        profile = await getUserProfile(discordId)
      } catch {
        profile = null
      }
      if (!active) return
      const roles = profile?.staff_roles ?? []
      setViewer({
        status: "authenticated",
        discordId,
        profile,
        isStaff: profile?.is_staff ?? false,
        isModerator: roles.some((r) => MODERATOR_ROLES.includes(r)),
      })
    }
    run()
    return () => {
      active = false
    }
  }, [])

  return (
    <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
  )
}

export function useViewer(): Viewer {
  const ctx = React.useContext(ViewerContext)
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider")
  return ctx
}
