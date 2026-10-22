import { useState, useEffect } from 'react'
import { ApiError, getMe, type User } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'down' }

/** Intervalle de relecture de `/auth/me` tant que l'API est injoignable. */
const DOWN_RETRY_MS = 30_000

/**
 * L'API ne répond pas du tout : pas de réponse (erreur réseau) ou une 5xx sur
 * `/auth/me`. Sans cette distinction, l'échec retombait sur `unauthenticated`
 * et renvoyait vers le login… servi par cette même API en panne.
 */
function isApiDown(e: unknown): boolean {
  return e instanceof ApiError && (e.isNetworkError || e.isServerError)
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const check = () => {
      getMe()
        .then(user => {
          if (cancelled) return
          setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated' })
        })
        .catch((e: unknown) => {
          if (cancelled) return
          if (isApiDown(e)) {
            setState({ status: 'down' })
            timer = setTimeout(check, DOWN_RETRY_MS)
          } else {
            setState({ status: 'unauthenticated' })
          }
        })
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return state
}
