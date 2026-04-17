import { useAuth } from '@/hooks/useAuth'
import { useTranslation } from 'react-i18next'
import { LoaderIcon } from 'lucide-react'
import { DashboardPage } from '@/pages/DashboardPage'
import { GuildProvider } from '@/contexts/GuildContext'
import { login } from '@/lib/auth'
import { useEffect } from 'react'

export function HomePage() {
  const auth = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      login()
    }
  }, [auth.status])

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LoaderIcon className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('home.checkingSession')}</p>
        </div>
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LoaderIcon className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('home.redirecting')}</p>
        </div>
      </div>
    )
  }

  // Authentifié — fourni le GuildProvider et affiche le layout dashboard
  return (
    <GuildProvider guilds={auth.user.guilds} user={auth.user}>
      <DashboardPage user={auth.user} />
    </GuildProvider>
  )
}
