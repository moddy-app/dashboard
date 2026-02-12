import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function HomePage() {
  const auth = useAuth()
  const { t } = useTranslation()

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      const currentUrl = window.location.href
      window.location.href = `https://moddy.app/sign-in?url=${encodeURIComponent(currentUrl)}`
    }
  }, [auth.status])

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('home.checkingSession')}</p>
        </div>
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('home.redirecting')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-lg font-medium">{t('home.loggedIn')}</p>
    </div>
  )
}
