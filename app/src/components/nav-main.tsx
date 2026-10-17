import { ChevronRightIcon, type IconComponent } from "@/components/icons"
import { ModuleStatusDot } from "@/components/module/module-status-badge"
import type { ModuleStatus } from "@/lib/modules"
import { Link, useLocation } from "react-router-dom"

import * as React from "react"

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
  icon?: IconComponent
  disabled?: boolean
  /** Étiquette d'état (« Beta »…) posée après le titre. */
  badge?: string
  /** Statut d'un module : petit point à droite de l'entrée. */
  status?: ModuleStatus
  /** Titre de groupe affiché au-dessus de cette entrée. */
  group?: string
}

interface NavItem {
  title: string
  url: string
  icon?: IconComponent
  isActive?: boolean
  disabled?: boolean
  /** Étiquette d'état (« Beta »…) posée après le titre. */
  badge?: string
  items?: NavSubItem[]
}

/**
 * Étiquette d'état d'une entrée de navigation. Elle disparaît quand la sidebar
 * est repliée en icônes : il n'y reste plus de titre à qualifier.
 */
function NavBadge({ children }: { children: string }) {
  return (
    <span className="ml-auto shrink-0 rounded-4xl bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
      {children}
    </span>
  )
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
                          <React.Fragment key={subItem.title}>
                          {subItem.group && (
                            <li className="px-2 pt-2 text-xs font-medium text-sidebar-foreground/60 first:pt-0">
                              {subItem.group}
                            </li>
                          )}
                          <SidebarMenuSubItem>
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
                                  <span className="truncate">{subItem.title}</span>
                                  {subItem.badge && (
                                    <NavBadge>{subItem.badge}</NavBadge>
                                  )}
                                </span>
                              ) : (
                                <Link to={subItem.url}>
                                  {subItem.icon && (
                                    <subItem.icon className="size-3.5" />
                                  )}
                                  <span className="truncate">{subItem.title}</span>
                                  {subItem.badge && (
                                    <NavBadge>{subItem.badge}</NavBadge>
                                  )}
                                  {subItem.status && (
                                    <ModuleStatusDot status={subItem.status} className="ml-auto" />
                                  )}
                                </Link>
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          </React.Fragment>
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
                    <span className="truncate">{item.title}</span>
                    {item.badge && <NavBadge>{item.badge}</NavBadge>}
                  </span>
                ) : (
                  <Link to={item.url}>
                    {item.icon && <item.icon />}
                    <span className="truncate">{item.title}</span>
                    {item.badge && <NavBadge>{item.badge}</NavBadge>}
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
