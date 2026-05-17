import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DashboardPage } from '@/pages/DashboardPage'
import { GuildProvider } from '@/contexts/GuildContext'
import { login } from '@/lib/auth'

type AuthPhase = 'authenticating' | 'authenticated'

function AuthScreen({ phase }: { phase: AuthPhase }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-5">
        {/* Spinner */}
        <div className="w-7 h-7 rounded-full border-2 border-black/12 border-t-black animate-spin" />

        {/* Text with animated suffix */}
        <p className="text-[1.375rem] font-semibold tracking-tight text-black select-none flex items-baseline">
          <span>Authenticat</span>

          {/* Suffix clip container */}
          <span
            className="relative inline-flex items-baseline overflow-hidden"
            style={{ height: '1.5em', verticalAlign: 'bottom' }}
          >
            {/* "ing" — exits downward with blur */}
            <span
              className="absolute inset-0 transition-all duration-500 ease-in-out"
              style={{
                transform: phase === 'authenticated' ? 'translateY(110%)' : 'translateY(0)',
                filter: phase === 'authenticated' ? 'blur(6px)' : 'blur(0)',
                opacity: phase === 'authenticated' ? 0 : 1,
              }}
            >
              ing
            </span>

            {/* "ed" — enters from above with blur */}
            <span
              className="absolute inset-0 transition-all duration-500 ease-in-out"
              style={{
                transform: phase === 'authenticated' ? 'translateY(0)' : 'translateY(-110%)',
                filter: phase === 'authenticated' ? 'blur(0)' : 'blur(6px)',
                opacity: phase === 'authenticated' ? 1 : 0,
              }}
            >
              ed
            </span>

            {/* Spacer to keep "ing" width reserved */}
            <span className="invisible">ing</span>
          </span>
        </p>
      </div>
    </div>
  )
}

export function HomePage() {
  const auth = useAuth()
  const [phase, setPhase] = useState<AuthPhase>('authenticating')
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      login()
    }
    if (auth.status === 'authenticated') {
      setPhase('authenticated')
      const timer = setTimeout(() => setShowDashboard(true), 1100)
      return () => clearTimeout(timer)
    }
  }, [auth.status])

  if (showDashboard && auth.status === 'authenticated') {
    return (
      <GuildProvider guilds={auth.user.guilds} user={auth.user}>
        <DashboardPage user={auth.user} />
      </GuildProvider>
    )
  }

  return <AuthScreen phase={phase} />
}
