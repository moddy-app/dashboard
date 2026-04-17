import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  BellIcon,
  BookOpenIcon,
  CreditCardIcon,
  GavelIcon,
  InfoIcon,
  LogOutIcon,
  PlusIcon,
  ServerIcon,
  SettingsIcon,
  SparklesIcon,
  TicketIcon,
} from "lucide-react"
import { getGuildIconUrl } from "@/lib/auth"

interface Server {
  name: string
  id: string
  icon?: string | null
}

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servers?: Server[]
  onSelectServer?: (id: string) => void
  onLogoutRequest?: () => void
  onOpenNotifications?: () => void
}

export function CommandMenu({
  open,
  onOpenChange,
  servers = [],
  onSelectServer,
  onLogoutRequest,
  onOpenNotifications,
}: CommandMenuProps) {
  const { t } = useTranslation()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open, onOpenChange])

  const runCommand = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder={t('commandMenu.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('commandMenu.noResults')}</CommandEmpty>

          {/* Mes serveurs */}
          <CommandGroup heading={t('commandMenu.groups.myServers')}>
            {servers.length > 0 ? (
              servers.map((server) => {
                const iconUrl = server.icon !== undefined
                  ? getGuildIconUrl(server.id, server.icon ?? null)
                  : null
                return (
                  <CommandItem
                    key={server.id}
                    value={server.name}
                    onSelect={() => runCommand(() => onSelectServer?.(server.id))}
                  >
                    <Avatar className="size-5 rounded-sm">
                      <AvatarImage src={iconUrl ?? undefined} alt={server.name} />
                      <AvatarFallback className="rounded-sm text-[10px]">
                        {server.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{server.name}</span>
                  </CommandItem>
                )
              })
            ) : (
              <CommandItem disabled>
                <ServerIcon />
                <span className="text-muted-foreground">{t('commandMenu.noServers')}</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* Liens utiles */}
          <CommandGroup heading={t('commandMenu.groups.usefulLinks')}>
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  openExternal(
                    "https://discord.com/oauth2/authorize?client_id=1373916203814490194"
                  )
                )
              }
            >
              <PlusIcon />
              <span>{t('commandMenu.items.addModdy')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => openExternal("https://moddy.app/support"))}
            >
              <TicketIcon />
              <span>{t('commandMenu.items.openTicket')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => openExternal("https://docs.moddy.app"))}
            >
              <BookOpenIcon />
              <span>{t('commandMenu.items.documentation')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  openExternal("https://www.moddy.app/navigation/subscriptions/")
                )
              }
            >
              <SparklesIcon />
              <span>{t('commandMenu.items.subscriptions')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => openExternal("https://status.moddy.app"))}
            >
              <InfoIcon />
              <span>{t('commandMenu.items.servicesStatus')}</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Mon compte */}
          <CommandGroup heading={t('commandMenu.groups.myAccount')}>
            <CommandItem onSelect={() => runCommand(() => {})}>
              <GavelIcon />
              <span>{t('commandMenu.items.myPunishments')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => onOpenNotifications?.())}>
              <BellIcon />
              <span>{t('commandMenu.items.notifications')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => {})}>
              <CreditCardIcon />
              <span>{t('commandMenu.items.billing')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => {})}>
              <SettingsIcon />
              <span>{t('commandMenu.items.settings')}</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onLogoutRequest?.())}
              className="text-destructive data-selected:text-destructive data-selected:bg-destructive/10"
            >
              <LogOutIcon className="!text-destructive" />
              <span>{t('commandMenu.items.logOut')}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
