import { ComponentExample } from '@/components/component-example'
import { useAuth } from '@/hooks/useAuth'
import { signInWithDiscord, logout } from '@/lib/auth'
import { useState, useEffect } from 'react'

// Stocker les logs globalement
const logs: string[] = []
const logListeners: Set<(logs: string[]) => void> = new Set()

// Intercepter console.log pour capturer les logs
const originalLog = console.log
const originalError = console.error

console.log = (...args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  logs.push(`[LOG] ${new Date().toLocaleTimeString()} - ${message}`)
  if (logs.length > 50) logs.shift() // Garder seulement les 50 derniers
  logListeners.forEach(listener => listener([...logs]))
  originalLog(...args)
}

console.error = (...args: any[]) => {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  logs.push(`[ERROR] ${new Date().toLocaleTimeString()} - ${message}`)
  if (logs.length > 50) logs.shift()
  logListeners.forEach(listener => listener([...logs]))
  originalError(...args)
}

export function App() {
  const auth = useAuth()
  const [displayLogs, setDisplayLogs] = useState<string[]>([])

  useEffect(() => {
    // S'abonner aux logs
    const listener = (newLogs: string[]) => setDisplayLogs(newLogs)
    logListeners.add(listener)
    setDisplayLogs([...logs])

    return () => {
      logListeners.delete(listener)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Status de connexion */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-bold">Backend Connection Status</h2>
        {auth.status === 'loading' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Connexion au backend...</span>
          </div>
        )}
        {auth.status === 'authenticated' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold">Connecté au backend</span>
            </div>
            {auth.userInfo && (
              <p className="text-base font-medium">
                Vous êtes connecté en tant que{' '}
                <span className="text-primary">
                  {auth.userInfo.username}
                  {auth.userInfo.discriminator !== '0' &&
                    `#${auth.userInfo.discriminator}`}
                </span>
              </p>
            )}
            <div className="space-y-1 text-sm">
              <p>
                <strong>Discord ID:</strong> {auth.user.discord_id}
              </p>
              <p>
                <strong>Email:</strong> {auth.user.email || 'Non fourni'}
              </p>
            </div>
            <button
              onClick={async () => {
                const success = await logout()
                if (success) {
                  window.location.reload()
                }
              }}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Se déconnecter
            </button>
          </div>
        )}
        {auth.status === 'unauthenticated' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-600">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="font-semibold">Non connecté</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Connexion établie avec le backend, mais vous n'êtes pas
              authentifié.
            </p>
            <button
              onClick={() => signInWithDiscord()}
              className="flex items-center gap-2 rounded-md bg-[#5865F2] px-4 py-2 font-medium text-white hover:bg-[#4752C4]"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Se connecter avec Discord
            </button>
          </div>
        )}
      </div>

      {/* Debug: Logs en temps réel */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-bold">Logs de débogage (Temps réel)</h2>
        <div className="max-h-96 overflow-y-auto rounded bg-black p-4 font-mono text-xs">
          {displayLogs.length === 0 ? (
            <p className="text-gray-500">Aucun log pour le moment...</p>
          ) : (
            <div className="space-y-1">
              {displayLogs.map((log, index) => (
                <div
                  key={index}
                  className={
                    log.includes('[ERROR]')
                      ? 'text-red-400'
                      : log.includes('[useAuth]')
                        ? 'text-blue-400'
                        : log.includes('[verifySession]')
                          ? 'text-green-400'
                          : 'text-gray-300'
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Debug: Liste des cookies */}
      <div className="mb-8 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-bold">Cookies visibles (Debug)</h2>
        <div className="space-y-2">
          {document.cookie ? (
            <div className="space-y-2">
              {document.cookie.split('; ').map((cookie, index) => {
                const [name, value] = cookie.split('=')
                return (
                  <div
                    key={index}
                    className="rounded bg-muted p-3 font-mono text-sm"
                  >
                    <div className="text-xs text-muted-foreground">Cookie #{index + 1}</div>
                    <div className="mt-1">
                      <strong className="text-primary">{name}:</strong>{' '}
                      <span className="break-all">{value}</span>
                    </div>
                  </div>
                )
              })}
              <p className="mt-4 text-xs text-muted-foreground">
                ⚠️ Note: Le cookie <code className="rounded bg-muted px-1">moddy_session</code> est <strong>HttpOnly</strong> et n'apparaît pas ici (c'est normal pour la sécurité).
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Aucun cookie visible. Le cookie <code className="rounded bg-muted px-1">moddy_session</code> est HttpOnly et n'est pas accessible en JavaScript.
            </p>
          )}
        </div>
      </div>

      {/* Composants d'exemple */}
      <ComponentExample />
    </div>
  )
}

export default App