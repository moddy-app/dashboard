import { NavLink } from "react-router-dom"
import {
  BanIcon,
  GavelIcon,
  type LucideIcon,
  ServerIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useViewer } from "@/hooks/useViewer"

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

type NavSection = {
  heading: string
  items: NavItem[]
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const viewer = useViewer()

  const sections: NavSection[] = [
    {
      heading: "Personnel",
      items: [{ to: "/me", label: "Mes sanctions", icon: UserIcon }],
    },
    {
      heading: "Serveurs",
      items: [{ to: "/servers", label: "Modération", icon: ServerIcon }],
    },
  ]

  if (viewer.isStaff) {
    sections.push({
      heading: "Staff",
      items: [
        { to: "/staff/cases", label: "Cases", icon: GavelIcon },
        { to: "/staff/blacklist", label: "Blacklist", icon: BanIcon },
      ],
    })
  }

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {section.heading}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {viewer.isStaff && (
        <div className="mt-auto px-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <ShieldIcon className="size-3" />
            Équipe Moddy
          </span>
        </div>
      )}
    </nav>
  )
}
