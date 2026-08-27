import { useLocation } from 'react-router-dom'
import { useMemo } from 'react'

/**
 * Retourne true si l'URL contient ?debug=true (ou ?debug sans valeur).
 * Le paramètre est conservé lors de la navigation (propagé automatiquement).
 */
export function useDebugMode(): boolean {
  const location = useLocation()
  return useMemo(() => {
    const params = new URLSearchParams(location.search)
    const val = params.get('debug')
    return val === 'true' || val === '' || val === '1'
  }, [location.search])
}

/**
 * Retourne une URL avec ?debug=true ajouté/préservé.
 */
export function appendDebug(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    u.searchParams.set('debug', 'true')
    return u.pathname + u.search + u.hash
  } catch {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}debug=true`
  }
}
