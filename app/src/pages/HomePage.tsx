import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { DashboardPage } from '@/pages/DashboardPage'
import { GuildProvider } from '@/contexts/GuildContext'
import { login } from '@/lib/auth'

type AuthPhase = 'authenticating' | 'authenticated'

function AuthScreen({ phase }: { phase: AuthPhase }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white relative overflow-hidden">
      {/* Subtle grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      <div className="flex flex-col items-center gap-5">
        {/* Spinner — légèrement plus rapide */}
        <div
          className="w-7 h-7 rounded-full border-2 border-black/[0.08] border-t-black/80 animate-spin"
          style={{ animationDuration: '0.55s', animationTimingFunction: 'linear' }}
        />

        {/* Text with animated suffix */}
        <div className="relative">
          {/* Fog concentré autour du suffixe "ing"/"ed" */}
          <div
            className="pointer-events-none absolute"
            aria-hidden
            style={{
              top: '-14px',
              bottom: '-14px',
              right: '-14px',
              left: '55%',
              background: 'radial-gradient(ellipse 90% 100% at 70% 50%, rgba(255,255,255,0.98) 20%, rgba(255,255,255,0.7) 55%, transparent 80%)',
              filter: 'blur(14px)',
              borderRadius: '50%',
            }}
          />
          <p className="relative text-[1.375rem] font-semibold tracking-tight text-black select-none flex items-baseline" style={{ zIndex: 1 }}>
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
                  filter: phase === 'authenticated' ? 'blur(14px)' : 'blur(0)',
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
                  filter: phase === 'authenticated' ? 'blur(0)' : 'blur(14px)',
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
