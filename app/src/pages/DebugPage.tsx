import { ComponentExample } from '@/components/component-example'
import { useAuth } from '@/hooks/useAuth'
import { signInWithDiscord, logout } from '@/lib/auth'
import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'

// Stocker les logs globalement
const logs: string[] = []
const logListeners: Set<(logs: string[]) => void> = new Set()

// Intercepter console.log pour capturer les logs
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

function captureLog(level: string, args: unknown[]) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  logs.push(`[${level}] ${new Date().toLocaleTimeString()} - ${message}`)
  if (logs.length > 100) logs.shift()
  logListeners.forEach(listener => listener([...logs]))
}

console.log = (...args: unknown[]) => { captureLog('LOG', args); originalLog(...args) }
console.error = (...args: unknown[]) => { captureLog('ERROR', args); originalError(...args) }
console.warn = (...args: unknown[]) => { captureLog('WARN', args); originalWarn(...args) }

function DebugSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-6 rounded-lg border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left font-bold hover:bg-muted/50"
      >
        <span>{title}</span>
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="border-t p-4">{children}</div>}
    </div>
  )
}

function KeyValue({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}:</span>
      <span className={`break-all ${mono ? 'font-mono text-xs' : ''}`}>{value ?? <span className="italic text-muted-foreground">null</span>}</span>
    </div>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
}

export function DebugPage() {
  const auth = useAuth()
  const location = useLocation()
  const [displayLogs, setDisplayLogs] = useState<string[]>([])
  const [apiPing, setApiPing] = useState<{ status: string; latency: number | null; error?: string } | null>(null)
  const [proxyPing, setProxyPing] = useState<{ status: string; latency: number | null; error?: string } | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const listener = (newLogs: string[]) => setDisplayLogs(newLogs)
    logListeners.add(listener)
    setDisplayLogs([...logs])
    return () => { logListeners.delete(listener) }
  }, [])

  // Horloge live
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const pingApi = useCallback(async () => {
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) { setApiPing({ status: 'error', latency: null, error: 'VITE_API_URL not set' }); return }
    setApiPing({ status: 'loading', latency: null })
    const start = performance.now()
    try {
      const res = await fetch(`${apiUrl}/auth/verify`, { credentials: 'include' })
      const latency = Math.round(performance.now() - start)
      setApiPing({ status: res.ok ? 'ok' : `http ${res.status}`, latency })
    } catch (e) {
      const latency = Math.round(performance.now() - start)
      setApiPing({ status: 'error', latency, error: e instanceof Error ? e.message : 'Unknown' })
    }
  }, [])

  const pingProxy = useCallback(async () => {
    setProxyPing({ status: 'loading', latency: null })
    const start = performance.now()
    try {
      const res = await fetch('/api/backend-proxy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: '/api/website/ping', body: {} }) })
      const latency = Math.round(performance.now() - start)
      setProxyPing({ status: res.ok ? 'ok' : `http ${res.status}`, latency })
    } catch (e) {
      const latency = Math.round(performance.now() - start)
      setProxyPing({ status: 'error', latency, error: e instanceof Error ? e.message : 'Unknown' })
    }
  }, [])

  const envVars = {
    VITE_API_URL: import.meta.env.VITE_API_URL || '(non défini)',
    VITE_DISCORD_CLIENT_ID: import.meta.env.VITE_DISCORD_CLIENT_ID || '(non défini)',
    MODE: import.meta.env.MODE,
    DEV: String(import.meta.env.DEV),
    PROD: String(import.meta.env.PROD),
    BASE_URL: import.meta.env.BASE_URL,
  }

  const perf = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined : undefined

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Debug Panel</h1>
        <span className="font-mono text-xs text-muted-foreground">{now.toLocaleString()}</span>
      </div>

      {/* Auth Status */}
      <DebugSection title="Authentification">
        {auth.status === 'loading' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Vérification de la session...</span>
          </div>
        )}
        {auth.status === 'authenticated' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <StatusDot ok />
              <span className="font-semibold">Authentifié</span>
            </div>
            {auth.userInfo && (
              <>
                <div className="flex items-center gap-3">
                  {auth.userInfo.avatar_url && (
                    <img src={auth.userInfo.avatar_url} alt="Avatar" className="h-10 w-10 rounded-full" />
                  )}
                  <div>
                    <p className="font-medium text-primary">
                      {auth.userInfo.username}
                      {auth.userInfo.discriminator !== '0' && `#${auth.userInfo.discriminator}`}
                    </p>
                    <p className="text-xs text-muted-foreground">ID: {auth.userInfo.id}</p>
                  </div>
                </div>
                <div className="rounded bg-muted p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">User Info (raw)</p>
                  <pre className="overflow-x-auto text-xs">{JSON.stringify(auth.userInfo, null, 2)}</pre>
                </div>
              </>
            )}
            <div className="rounded bg-muted p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Session Data</p>
              <KeyValue label="Discord ID" value={auth.user.discord_id} mono />
              <KeyValue label="Email" value={auth.user.email || 'Non fourni'} />
            </div>
            <button
              onClick={async () => { if (await logout()) window.location.reload() }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Se déconnecter
            </button>
          </div>
        )}
        {auth.status === 'unauthenticated' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-600">
              <StatusDot ok={false} />
              <span className="font-semibold">Non connecté</span>
            </div>
            <button
              onClick={() => signInWithDiscord()}
              className="flex items-center gap-2 rounded-md bg-[#5865F2] px-4 py-2 font-medium text-white hover:bg-[#4752C4]"
            >
              Se connecter avec Discord
            </button>
          </div>
        )}
      </DebugSection>

      {/* API Connectivity */}
      <DebugSection title="Connectivité API">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={pingApi} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              Ping API directe
            </button>
            <button onClick={pingProxy} className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:opacity-90">
              Ping Proxy Vercel
            </button>
          </div>
          {apiPing && (
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={apiPing.status === 'ok'} />
              <span>API directe: <strong>{apiPing.status}</strong></span>
              {apiPing.latency !== null && <span className="text-muted-foreground">({apiPing.latency}ms)</span>}
              {apiPing.error && <span className="text-red-500">{apiPing.error}</span>}
            </div>
          )}
          {proxyPing && (
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={proxyPing.status === 'ok'} />
              <span>Proxy Vercel: <strong>{proxyPing.status}</strong></span>
              {proxyPing.latency !== null && <span className="text-muted-foreground">({proxyPing.latency}ms)</span>}
              {proxyPing.error && <span className="text-red-500">{proxyPing.error}</span>}
            </div>
          )}
        </div>
      </DebugSection>

      {/* Environment */}
      <DebugSection title="Environnement">
        <div className="space-y-1">
          {Object.entries(envVars).map(([key, val]) => (
            <KeyValue key={key} label={key} value={val} mono />
          ))}
        </div>
      </DebugSection>

      {/* Router */}
      <DebugSection title="Router">
        <KeyValue label="Pathname" value={location.pathname} mono />
        <KeyValue label="Search" value={location.search || '(vide)'} mono />
        <KeyValue label="Hash" value={location.hash || '(vide)'} mono />
        <KeyValue label="Origin" value={window.location.origin} mono />
        <KeyValue label="Full URL" value={window.location.href} mono />
      </DebugSection>

      {/* Browser */}
      <DebugSection title="Navigateur" defaultOpen={false}>
        <KeyValue label="User Agent" value={navigator.userAgent} mono />
        <KeyValue label="Langue" value={navigator.language} />
        <KeyValue label="Langues" value={navigator.languages.join(', ')} />
        <KeyValue label="En ligne" value={<><StatusDot ok={navigator.onLine} /> {navigator.onLine ? 'Oui' : 'Non'}</>} />
        <KeyValue label="Cookies activés" value={navigator.cookieEnabled ? 'Oui' : 'Non'} />
        <KeyValue label="CPU Cores" value={navigator.hardwareConcurrency} />
        <KeyValue label="Plateforme" value={navigator.platform} />
        <KeyValue label="Écran" value={`${screen.width}x${screen.height} (${devicePixelRatio}x)`} />
        <KeyValue label="Fenêtre" value={`${window.innerWidth}x${window.innerHeight}`} />
        <KeyValue label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
      </DebugSection>

      {/* Performance */}
      <DebugSection title="Performance" defaultOpen={false}>
        {perf ? (
          <>
            <KeyValue label="DOM Content Loaded" value={`${Math.round(perf.domContentLoadedEventEnd - perf.startTime)}ms`} />
            <KeyValue label="Page Load" value={`${Math.round(perf.loadEventEnd - perf.startTime)}ms`} />
            <KeyValue label="DNS Lookup" value={`${Math.round(perf.domainLookupEnd - perf.domainLookupStart)}ms`} />
            <KeyValue label="TCP Connect" value={`${Math.round(perf.connectEnd - perf.connectStart)}ms`} />
            <KeyValue label="TTFB" value={`${Math.round(perf.responseStart - perf.requestStart)}ms`} />
            <KeyValue label="DOM Interactive" value={`${Math.round(perf.domInteractive - perf.startTime)}ms`} />
            <KeyValue label="Transfer Size" value={`${(perf.transferSize / 1024).toFixed(1)} KB`} />
            <KeyValue label="Type" value={perf.type} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Données de performance non disponibles</p>
        )}
        <KeyValue label="Memory" value={
          'memory' in performance
            ? `${((performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.usedJSHeapSize / 1048576).toFixed(1)} MB / ${((performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.totalJSHeapSize / 1048576).toFixed(1)} MB`
            : 'Non supporté'
        } />
      </DebugSection>

      {/* Cookies */}
      <DebugSection title="Cookies" defaultOpen={false}>
        {document.cookie ? (
          <div className="space-y-2">
            {document.cookie.split('; ').map((cookie, index) => {
              const [name, ...rest] = cookie.split('=')
              return (
                <div key={index} className="rounded bg-muted p-3 font-mono text-xs">
                  <strong className="text-primary">{name}</strong> = <span className="break-all">{rest.join('=')}</span>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground">
              Le cookie <code className="rounded bg-muted px-1">moddy_session</code> est HttpOnly et n'apparait pas ici.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun cookie visible (les cookies HttpOnly ne sont pas accessibles en JS).
          </p>
        )}
      </DebugSection>

      {/* Storage */}
      <DebugSection title="Storage" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">LocalStorage ({localStorage.length} entrées)</p>
            {localStorage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Vide</p>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: localStorage.length }).map((_, i) => {
                  const key = localStorage.key(i)!
                  const val = localStorage.getItem(key)!
                  return <KeyValue key={key} label={key} value={val.length > 200 ? val.slice(0, 200) + '...' : val} mono />
                })}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">SessionStorage ({sessionStorage.length} entrées)</p>
            {sessionStorage.length === 0 ? (
              <p className="text-sm text-muted-foreground">Vide</p>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: sessionStorage.length }).map((_, i) => {
                  const key = sessionStorage.key(i)!
                  const val = sessionStorage.getItem(key)!
                  return <KeyValue key={key} label={key} value={val.length > 200 ? val.slice(0, 200) + '...' : val} mono />
                })}
              </div>
            )}
          </div>
        </div>
      </DebugSection>

      {/* Logs */}
      <DebugSection title={`Logs en temps réel (${displayLogs.length})`}>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => { logs.length = 0; setDisplayLogs([]) }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Effacer
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded bg-black p-4 font-mono text-xs">
          {displayLogs.length === 0 ? (
            <p className="text-gray-500">Aucun log pour le moment...</p>
          ) : (
            <div className="space-y-0.5">
              {displayLogs.map((log, index) => (
                <div
                  key={index}
                  className={
                    log.includes('[ERROR]')
                      ? 'text-red-400'
                      : log.includes('[WARN]')
                        ? 'text-yellow-400'
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
      </DebugSection>

      {/* Composants d'exemple */}
      <DebugSection title="Composants UI (Showcase)" defaultOpen={false}>
        <ComponentExample />
      </DebugSection>
    </div>
  )
}
