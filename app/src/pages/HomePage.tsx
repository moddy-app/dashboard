import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderIcon } from 'lucide-react'
import { DashboardPage } from '@/pages/DashboardPage'
import { login } from '@/lib/auth'

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

  return <DashboardPage user={auth.user} />
}
