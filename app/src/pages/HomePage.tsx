import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'

export function HomePage() {
  const auth = useAuth()

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      const currentUrl = window.location.href
      window.location.href = `https://moddy.app/sign-in?url=${encodeURIComponent(currentUrl)}`
    }
  }, [auth.status])

  // Loading ou redirect en cours
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {auth.status === 'loading' ? 'Vérification de la session...' : 'Redirection...'}
        </p>
      </div>
    </div>
  )
}
