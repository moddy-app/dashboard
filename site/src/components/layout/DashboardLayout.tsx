import { useState } from 'react';
import { Home, Server, Settings, LogOut, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logout, type UserInfo } from '@/utils/auth';
import { DatePickerDemo } from '@/components/DatePickerDemo';

interface DashboardLayoutProps {
  user: UserInfo;
  onLogout: () => void;
}

type Page = 'home' | 'servers' | 'settings';

const navItems = [
  { id: 'home' as const, label: 'Accueil', icon: Home },
  { id: 'servers' as const, label: 'Serveurs', icon: Server },
  { id: 'settings' as const, label: 'Paramètres', icon: Settings },
];

export function DashboardLayout({ user, onLogout }: DashboardLayoutProps) {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  async function handleLogout() {
    const success = await logout();
    if (success) {
      onLogout();
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">M</span>
            </div>
            <span className="text-lg font-semibold">Moddy</span>
          </div>
        </div>

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <Button
                  variant={currentPage === item.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3"
                  onClick={() => setCurrentPage(item.id)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        <Separator />

        {/* User Menu */}
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                  <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium truncate">{user.username}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email || 'Email non disponible'}
                  </div>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
          <h1 className="text-2xl font-semibold">
            {currentPage === 'home' && `Bienvenue, ${user.username} !`}
            {currentPage === 'servers' && 'Vos serveurs'}
            {currentPage === 'settings' && 'Paramètres'}
          </h1>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {currentPage === 'home' && <HomePage />}
          {currentPage === 'servers' && <ServersPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test shadcn/ui - DatePicker</CardTitle>
        </CardHeader>
        <CardContent>
          <DatePickerDemo />
        </CardContent>
      </Card>
    </div>
  );
}

function ServersPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vos serveurs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">La liste de vos serveurs apparaîtra ici.</p>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Les paramètres de votre compte apparaîtront ici.</p>
      </CardContent>
    </Card>
  );
}
