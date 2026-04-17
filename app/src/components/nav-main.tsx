import { ChevronRightIcon, type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface NavSubItem {
  title: string
  url: string
  icon?: LucideIcon
  disabled?: boolean
}

interface NavItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  disabled?: boolean
  items?: NavSubItem[]
}

export function NavMain({
  items,
  label,
}: {
  items: NavItem[]
  label?: string
}) {
  const location = useLocation()

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const hasChildren = item.items && item.items.length > 0
          const isCurrentlyActive =
            item.isActive ?? location.pathname === item.url

          // Item avec sous-menu
          if (hasChildren) {
            const isSubActive = item.items?.some(
              (sub) => location.pathname === sub.url
            )
            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={isCurrentlyActive || isSubActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      className={cn(
                        item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => {
                        const isSubCurrent = location.pathname === subItem.url
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild={!subItem.disabled}
                              isActive={isSubCurrent}
                              className={cn(
                                subItem.disabled &&
                                  "opacity-40 cursor-not-allowed pointer-events-none"
                              )}
                            >
                              {subItem.disabled ? (
                                <span>
                                  {subItem.icon && (
                                    <subItem.icon className="size-3.5" />
                                  )}
                                  <span>{subItem.title}</span>
                                </span>
                              ) : (
                                <Link to={subItem.url}>
                                  {subItem.icon && (
                                    <subItem.icon className="size-3.5" />
                                  )}
                                  <span>{subItem.title}</span>
                                </Link>
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }

          // Item simple (sans sous-menu)
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild={!item.disabled && item.url !== '#'}
                tooltip={item.title}
                isActive={isCurrentlyActive}
                className={cn(
                  item.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
              >
                {item.disabled || item.url === '#' ? (
                  <span>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </span>
                ) : (
                  <Link to={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
