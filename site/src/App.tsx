import { useEffect, useState } from 'react';
import { verifySession, getUserInfo, type UserInfo } from './utils/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { TooltipProvider } from './components/ui/tooltip';

export function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const session = await verifySession();
      if (session.valid) {
        const userInfo = await getUserInfo();
        setUser(userInfo);
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <span className="text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <TooltipProvider>
      <DashboardLayout user={user} onLogout={() => setUser(null)} />
    </TooltipProvider>
  );
}
