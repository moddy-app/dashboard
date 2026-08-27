/* eslint-disable no-console */
// Detailed frontend logger. Always-on in dev, verbose in debug mode.
// Writes timestamped/colored entries to the browser console for every
// action, API call, navigation, success, warn and error the app emits.

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success' | 'api' | 'event'

const STYLES: Record<LogLevel, string> = {
  info:    'color:#3b82f6;font-weight:600',
  warn:    'color:#f59e0b;font-weight:600',
  error:   'color:#ef4444;font-weight:700',
  debug:   'color:#8b5cf6;font-weight:600',
  success: 'color:#10b981;font-weight:600',
  api:     'color:#06b6d4;font-weight:600',
  event:   'color:#64748b;font-weight:600',
}

function timestamp(): string {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function emit(level: LogLevel, scope: string, message: string, ...rest: unknown[]): void {
  const prefix = `%c[${timestamp()}] %c${level.toUpperCase().padEnd(7)} %c${scope}`
  const base = 'color:#94a3b8'
  const style = STYLES[level]
  const scopeStyle = 'color:#e2e8f0;background:#1e293b;padding:1px 6px;border-radius:4px'
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (rest.length) fn(prefix, base, style, scopeStyle, message, ...rest)
  else fn(prefix, base, style, scopeStyle, message)
}

export const logger = {
  info:    (scope: string, msg: string, ...rest: unknown[]) => emit('info', scope, msg, ...rest),
  warn:    (scope: string, msg: string, ...rest: unknown[]) => emit('warn', scope, msg, ...rest),
  error:   (scope: string, msg: string, ...rest: unknown[]) => emit('error', scope, msg, ...rest),
  debug:   (scope: string, msg: string, ...rest: unknown[]) => emit('debug', scope, msg, ...rest),
  success: (scope: string, msg: string, ...rest: unknown[]) => emit('success', scope, msg, ...rest),
  api:     (scope: string, msg: string, ...rest: unknown[]) => emit('api', scope, msg, ...rest),
  event:   (scope: string, msg: string, ...rest: unknown[]) => emit('event', scope, msg, ...rest),
}

// Print a banner once on first import so dev can confirm logger is active.
if (typeof window !== 'undefined' && !(window as unknown as { __MODDY_LOGGER__?: boolean }).__MODDY_LOGGER__) {
  ;(window as unknown as { __MODDY_LOGGER__?: boolean }).__MODDY_LOGGER__ = true
  emit('info', 'logger', 'Moddy logger initialized')
}
