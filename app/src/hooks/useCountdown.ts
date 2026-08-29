/**
 * Compte à rebours d'une échéance ISO, rafraîchi chaque seconde.
 *
 * Partagé par les deux surfaces qui en portent une : la confirmation d'action
 * et le formulaire de question. `null` quand il n'y a pas d'échéance lisible —
 * on n'affiche alors **pas** de compte à rebours plutôt que d'en inventer un.
 *
 * `onExpire` est appelé au passage à zéro : sans lui, la conversation resterait
 * bloquée sur une carte à laquelle plus aucun envoi ne peut répondre.
 */

import { useEffect, useRef, useState } from 'react'
import { secondsUntil } from '@/lib/brocoli'

export function useCountdown(expiresAt: string | null, onExpire: () => void): number | null {
  // C'est l'**horloge** qui est un état, pas le décompte : celui-ci s'en
  // dérive. Stocker les secondes restantes obligerait à les recalculer dans un
  // effet — donc à écrire un état pendant la synchronisation, pour une valeur
  // que le rendu sait produire seul.
  const [now, setNow] = useState(() => Date.now())

  // `onExpire` lu depuis une ref : le relister relancerait l'intervalle à
  // chaque rendu du fil pendant le flux, et le compte à rebours sauterait.
  const expireRef = useRef(onExpire)
  useEffect(() => {
    expireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const left = secondsUntil(expiresAt, now)

  useEffect(() => {
    if (left !== null && left <= 0) expireRef.current()
  }, [left])

  return left
}
