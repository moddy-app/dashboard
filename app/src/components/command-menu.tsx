import * as React from "react"
import { useNavigate } from "react-router-dom"
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
  ActivityIcon,
  BellIcon,
  BookOpenIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  GaugeIcon,
  HeadphonesIcon,
  LogOutIcon,
  PlusIcon,
  ServerIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  WifiIcon,
} from "lucide-react"

interface Server {
  name: string
  id: string
}

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  servers?: Server[]
  onLogout?: () => void
}

export function CommandMenu({ open, onOpenChange, servers = [], onLogout }: CommandMenuProps) {
  const navigate = useNavigate()

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
        <CommandInput placeholder="Rechercher une action ou une page..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

          {/* Mes serveurs */}
          <CommandGroup heading="Mes serveurs">
            {servers.length > 0 ? (
              servers.map((server) => (
                <CommandItem
                  key={server.id}
                  onSelect={() => runCommand(() => {})}
                >
                  <ServerIcon />
                  <span>{server.name}</span>
                </CommandItem>
              ))
            ) : (
              <CommandItem onSelect={() => runCommand(() => openExternal("https://discord.com/oauth2/authorize?client_id=1373916203814490194"))}>
                <PlusIcon />
                <span>Ajouter Moddy à un serveur</span>
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* Navigation */}
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <GaugeIcon />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <ShieldIcon />
              <span>Modération</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <SettingsIcon />
              <span>Paramètres</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Liens utiles */}
          <CommandGroup heading="Liens utiles">
            <CommandItem onSelect={() => runCommand(() => openExternal("https://discord.com/oauth2/authorize?client_id=1373916203814490194"))}>
              <PlusIcon />
              <span>Ajouter Moddy</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openExternal("https://moddy.app/support"))}>
              <HeadphonesIcon />
              <span>Ouvrir un ticket</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openExternal("https://docs.moddy.app"))}>
              <BookOpenIcon />
              <span>Documentation</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openExternal("https://www.moddy.app/navigation/subscriptions/"))}>
              <SparklesIcon />
              <span>Abonnements</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openExternal("https://status.moddy.app"))}>
              <WifiIcon />
              <span>Statut des services</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Mon compte */}
          <CommandGroup heading="Mon compte">
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <ActivityIcon />
              <span>Mes affaires</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <BellIcon />
              <span>Notifications</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <CreditCardIcon />
              <span>Facturation</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <SettingsIcon />
              <span>Paramètres du compte</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => onLogout?.())}
              className="text-destructive data-[selected=true]:text-destructive"
            >
              <LogOutIcon />
              <span>Se déconnecter</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
