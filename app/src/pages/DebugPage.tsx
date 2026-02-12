import { ComponentExample } from '@/components/component-example'
import { useAuth } from '@/hooks/useAuth'
import { signInWithDiscord, logout } from '@/lib/auth'
import { getPreferences, setPreferences, detectBrowserLanguage } from '@/lib/preferences'
import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as Sentry from '@sentry/react'

// Store logs globally
const logs: string[] = []
const logListeners: Set<(logs: string[]) => void> = new Set()

// Intercept console methods to capture logs
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
  const { t, i18n } = useTranslation()
  const [languageMode, setLanguageMode] = useState<'auto' | 'en' | 'fr'>(() => {
    const pref = getPreferences().language
    return (pref as 'en' | 'fr') ?? 'auto'
  })
  const [displayLogs, setDisplayLogs] = useState<string[]>([])
  const [apiPing, setApiPing] = useState<{ status: string; latency: number | null; error?: string } | null>(null)
  const [proxyPing, setProxyPing] = useState<{ status: string; latency: number | null; error?: string } | null>(null)
  const [now, setNow] = useState(new Date())

  const changeLanguage = useCallback((mode: 'auto' | 'en' | 'fr') => {
    setLanguageMode(mode)
    if (mode === 'auto') {
      setPreferences({ language: undefined })
      const detected = detectBrowserLanguage(['en', 'fr'], 'en')
      i18n.changeLanguage(detected)
    } else {
      setPreferences({ language: mode })
      i18n.changeLanguage(mode)
    }
  }, [i18n])

  useEffect(() => {
    const listener = (newLogs: string[]) => setDisplayLogs(newLogs)
    logListeners.add(listener)
    setDisplayLogs([...logs])
    return () => { logListeners.delete(listener) }
  }, [])

  // Live clock
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
    VITE_API_URL: import.meta.env.VITE_API_URL || '(not set)',
    VITE_DISCORD_CLIENT_ID: import.meta.env.VITE_DISCORD_CLIENT_ID || '(not set)',
    MODE: import.meta.env.MODE,
    DEV: String(import.meta.env.DEV),
    PROD: String(import.meta.env.PROD),
    BASE_URL: import.meta.env.BASE_URL,
  }

  const perf = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined : undefined

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('debug.title')}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('debug.languageSwitcher')}:</span>
            <div className="flex gap-1">
              {(['auto', 'en', 'fr'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => changeLanguage(mode)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${languageMode === mode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                >
                  {mode === 'auto' ? t('debug.languageAuto') : mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{now.toLocaleString()}</span>
        </div>
      </div>

      {/* Auth Status */}
      <DebugSection title={t('debug.auth.title')}>
        {auth.status === 'loading' && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{t('debug.auth.checkingSession')}</span>
          </div>
        )}
        {auth.status === 'authenticated' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <StatusDot ok />
              <span className="font-semibold">{t('debug.auth.authenticated')}</span>
            </div>
            {auth.userInfo && (
              <>
                <div className="flex items-center gap-3">
                  {auth.userInfo.avatar_url && (
                    <img src={auth.userInfo.avatar_url} alt={t('debug.auth.avatar')} className="h-10 w-10 rounded-full" />
                  )}
                  <div>
                    <p className="font-medium text-primary">
                      {auth.userInfo.username}
                      {auth.userInfo.discriminator !== '0' && `#${auth.userInfo.discriminator}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('debug.auth.id', { id: auth.userInfo.id })}</p>
                  </div>
                </div>
                <div className="rounded bg-muted p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('debug.auth.userInfoRaw')}</p>
                  <pre className="overflow-x-auto text-xs">{JSON.stringify(auth.userInfo, null, 2)}</pre>
                </div>
              </>
            )}
            <div className="rounded bg-muted p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('debug.auth.sessionData')}</p>
              <KeyValue label={t('debug.auth.discordId')} value={auth.user.discord_id} mono />
              <KeyValue label={t('debug.auth.email')} value={auth.user.email || t('debug.auth.notProvided')} />
            </div>
            <button
              onClick={async () => { if (await logout()) window.location.reload() }}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t('debug.auth.logout')}
            </button>
          </div>
        )}
        {auth.status === 'unauthenticated' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-yellow-600">
              <StatusDot ok={false} />
              <span className="font-semibold">{t('debug.auth.notLoggedIn')}</span>
            </div>
            <button
              onClick={() => signInWithDiscord()}
              className="flex items-center gap-2 rounded-md bg-[#5865F2] px-4 py-2 font-medium text-white hover:bg-[#4752C4]"
            >
              {t('debug.auth.signInDiscord')}
            </button>
          </div>
        )}
      </DebugSection>

      {/* API Connectivity */}
      <DebugSection title={t('debug.api.title')}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={pingApi} className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
              {t('debug.api.pingDirect')}
            </button>
            <button onClick={pingProxy} className="rounded bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:opacity-90">
              {t('debug.api.pingProxy')}
            </button>
          </div>
          {apiPing && (
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={apiPing.status === 'ok'} />
              <span>{t('debug.api.directApi')} <strong>{apiPing.status}</strong></span>
              {apiPing.latency !== null && <span className="text-muted-foreground">({apiPing.latency}ms)</span>}
              {apiPing.error && <span className="text-red-500">{apiPing.error}</span>}
            </div>
          )}
          {proxyPing && (
            <div className="flex items-center gap-2 text-sm">
              <StatusDot ok={proxyPing.status === 'ok'} />
              <span>{t('debug.api.vercelProxy')} <strong>{proxyPing.status}</strong></span>
              {proxyPing.latency !== null && <span className="text-muted-foreground">({proxyPing.latency}ms)</span>}
              {proxyPing.error && <span className="text-red-500">{proxyPing.error}</span>}
            </div>
          )}
        </div>
      </DebugSection>

      {/* Environment */}
      <DebugSection title={t('debug.environment.title')}>
        <div className="space-y-1">
          {Object.entries(envVars).map(([key, val]) => (
            <KeyValue key={key} label={key} value={val} mono />
          ))}
        </div>
      </DebugSection>

      {/* Router */}
      <DebugSection title={t('debug.router.title')}>
        <KeyValue label={t('debug.router.pathname')} value={location.pathname} mono />
        <KeyValue label={t('debug.router.search')} value={location.search || t('common.empty')} mono />
        <KeyValue label={t('debug.router.hash')} value={location.hash || t('common.empty')} mono />
        <KeyValue label={t('debug.router.origin')} value={window.location.origin} mono />
        <KeyValue label={t('debug.router.fullUrl')} value={window.location.href} mono />
      </DebugSection>

      {/* Browser */}
      <DebugSection title={t('debug.browser.title')} defaultOpen={false}>
        <KeyValue label={t('debug.browser.userAgent')} value={navigator.userAgent} mono />
        <KeyValue label={t('debug.browser.language')} value={navigator.language} />
        <KeyValue label={t('debug.browser.languages')} value={navigator.languages.join(', ')} />
        <KeyValue label={t('debug.browser.online')} value={<><StatusDot ok={navigator.onLine} /> {navigator.onLine ? t('common.yes') : t('common.no')}</>} />
        <KeyValue label={t('debug.browser.cookiesEnabled')} value={navigator.cookieEnabled ? t('common.yes') : t('common.no')} />
        <KeyValue label={t('debug.browser.cpuCores')} value={navigator.hardwareConcurrency} />
        <KeyValue label={t('debug.browser.platform')} value={navigator.platform} />
        <KeyValue label={t('debug.browser.screen')} value={`${screen.width}x${screen.height} (${devicePixelRatio}x)`} />
        <KeyValue label={t('debug.browser.window')} value={`${window.innerWidth}x${window.innerHeight}`} />
        <KeyValue label={t('debug.browser.timezone')} value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
      </DebugSection>

      {/* Performance */}
      <DebugSection title={t('debug.performance.title')} defaultOpen={false}>
        {perf ? (
          <>
            <KeyValue label={t('debug.performance.domContentLoaded')} value={`${Math.round(perf.domContentLoadedEventEnd - perf.startTime)}ms`} />
            <KeyValue label={t('debug.performance.pageLoad')} value={`${Math.round(perf.loadEventEnd - perf.startTime)}ms`} />
            <KeyValue label={t('debug.performance.dnsLookup')} value={`${Math.round(perf.domainLookupEnd - perf.domainLookupStart)}ms`} />
            <KeyValue label={t('debug.performance.tcpConnect')} value={`${Math.round(perf.connectEnd - perf.connectStart)}ms`} />
            <KeyValue label={t('debug.performance.ttfb')} value={`${Math.round(perf.responseStart - perf.requestStart)}ms`} />
            <KeyValue label={t('debug.performance.domInteractive')} value={`${Math.round(perf.domInteractive - perf.startTime)}ms`} />
            <KeyValue label={t('debug.performance.transferSize')} value={`${(perf.transferSize / 1024).toFixed(1)} KB`} />
            <KeyValue label={t('debug.performance.type')} value={perf.type} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('debug.performance.notAvailable')}</p>
        )}
        <KeyValue label={t('debug.performance.memory')} value={
          'memory' in performance
            ? `${((performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.usedJSHeapSize / 1048576).toFixed(1)} MB / ${((performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.totalJSHeapSize / 1048576).toFixed(1)} MB`
            : t('debug.performance.notSupported')
        } />
      </DebugSection>

      {/* Cookies */}
      <DebugSection title={t('debug.cookies.title')} defaultOpen={false}>
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
              {t('debug.cookies.httpOnlyNote').split('<code>').map((part, i) => {
                if (i === 0) return part
                const [code, rest] = part.split('</code>')
                return <span key={i}><code className="rounded bg-muted px-1">{code}</code>{rest}</span>
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('debug.cookies.noCookies')}
          </p>
        )}
      </DebugSection>

      {/* Storage */}
      <DebugSection title={t('debug.storage.title')} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t('debug.storage.localStorage', { count: localStorage.length })}</p>
            {localStorage.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('debug.storage.empty')}</p>
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
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t('debug.storage.sessionStorage', { count: sessionStorage.length })}</p>
            {sessionStorage.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('debug.storage.empty')}</p>
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
      <DebugSection title={t('debug.logs.title', { count: displayLogs.length })}>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => { logs.length = 0; setDisplayLogs([]) }}
            className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t('common.clear')}
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded bg-black p-4 font-mono text-xs">
          {displayLogs.length === 0 ? (
            <p className="text-gray-500">{t('debug.logs.noLogs')}</p>
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

      {/* Sentry */}
      <DebugSection title={t('debug.sentry.title')} defaultOpen={false}>
        <div className="space-y-3">
          <KeyValue label={t('debug.sentry.dsn')} value={Sentry.getClient()?.getDsn()?.toString() ?? t('debug.sentry.notConfigured')} mono />
          <KeyValue label={t('debug.sentry.status')} value={Sentry.getClient() ? t('debug.sentry.initialized') : t('debug.sentry.notInitialized')} />
          <div className="flex gap-2">
            <button
              onClick={() => {
                throw new Error('This is a Sentry test error!')
              }}
              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              {t('debug.sentry.throwTestError')}
            </button>
            <button
              onClick={() => {
                Sentry.captureMessage('Test message from Debug Panel')
                console.log('[Sentry] Test message sent')
              }}
              className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700"
            >
              {t('debug.sentry.sendTestMessage')}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('debug.sentry.description')}
          </p>
        </div>
      </DebugSection>

      {/* Component Showcase */}
      <DebugSection title={t('debug.components.title')} defaultOpen={false}>
        <ComponentExample />
      </DebugSection>
    </div>
  )
}
