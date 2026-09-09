import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'
import { getLatestInstall } from '@/services/install'
import type { InstallInfo } from '@/types/stats'

/**
 * Détecte le retour d'une installation et alimente l'écran de remerciement.
 *
 * Trois choses que ce hook porte, et qui sont faciles à rater :
 *
 * 1. **Le paramètre `?installed=` est nettoyé de l'URL** dès qu'il est lu
 *    (`history.replaceState`). Sans ça, l'écran reviendrait à chaque
 *    rafraîchissement.
 * 2. **`confirmed: false` juste après le retour n'est pas un échec** : le bot
 *    pose `confirmed_at` quand la passerelle Discord lui livre l'événement,
 *    de l'ordre de la seconde. On affiche quand même, et on re-interroge
 *    `/install/latest` une fois ~3 s plus tard pour préciser l'état.
 * 3. **Une installation acquittée ne revient pas.** `/install/latest` répond
 *    pendant 30 minutes : sans mémoire locale, fermer l'écran puis recharger
 *    le rouvrirait. L'acquittement est un confort d'affichage, pas une donnée
 *    de référence — un `localStorage` indisponible dégrade sans casser.
 */

const ACK_STORAGE_KEY = 'moddy_install_ack'
/** Délai avant la relecture de confirmation — le guide parle de « ~3 s ». */
const CONFIRM_RECHECK_MS = 3000

function readAck(): string | null {
  try {
    return window.localStorage.getItem(ACK_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeAck(guildId: string) {
  try {
    window.localStorage.setItem(ACK_STORAGE_KEY, guildId)
  } catch {
    /* navigation privée, stockage désactivé — sans conséquence */
  }
}

/** Retire `installed` / `auth_error` de l'URL sans recharger ni empiler d'entrée. */
function stripInstallParams() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('installed') && !url.searchParams.has('auth_error')) return
  url.searchParams.delete('installed')
  url.searchParams.delete('auth_error')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export type InstallWelcomeState =
  | { kind: 'idle' }
  /** L'utilisateur a cliqué « Annuler » sur l'écran Discord — pas une erreur technique. */
  | { kind: 'cancelled' }
  | { kind: 'installed'; guildId: string; install: InstallInfo | null }

export interface UseInstallWelcome {
  state: InstallWelcomeState
  /** `true` tant que la confirmation du bot est en cours de vérification. */
  isChecking: boolean
  dismiss: () => void
  /** Relance une lecture de `/install/latest` (bouton « Réessayer » après un refresh guilds). */
  recheck: () => Promise<void>
}

/**
 * Lecture pure de l'URL de retour. Séparée du montage pour servir d'état
 * initial : poser cet état depuis un effet provoquerait un rendu en cascade.
 */
function readReturnParams(): { installedId: string | null; authError: string | null } {
  const params = new URLSearchParams(window.location.search)
  return { installedId: params.get('installed'), authError: params.get('auth_error') }
}

export function useInstallWelcome(): UseInstallWelcome {
  const [state, setState] = useState<InstallWelcomeState>(() => {
    const { installedId, authError } = readReturnParams()
    // « Annuler » sur l'écran Discord : message neutre, pas une erreur technique.
    if (authError) return { kind: 'cancelled' }
    // L'id de l'URL fait foi ; `/install/latest` ne sert qu'à l'enrichir.
    if (installedId) return { kind: 'installed', guildId: installedId, install: null }
    return { kind: 'idle' }
  })
  const [isChecking, setIsChecking] = useState(() => readReturnParams().installedId !== null)
  // StrictMode monte deux fois en développement : sans garde, `?installed=` est
  // lu une fois puis effacé, et le second passage repartirait sur le repli.
  const started = useRef(false)

  const fetchLatest = useCallback(async (): Promise<InstallInfo | null> => {
    try {
      const { install } = await getLatestInstall()
      return install
    } catch (e) {
      // Le repli est un confort : son échec ne doit pas remonter à l'écran.
      logger.warn('install', 'Unable to read /install/latest', e)
      return null
    }
  }, [])

  const recheck = useCallback(async () => {
    setIsChecking(true)
    const install = await fetchLatest()
    setIsChecking(false)
    setState((current) => {
      if (current.kind !== 'installed') return current
      // On ne remplace que si la réponse parle bien du serveur affiché : une
      // seconde installation entre-temps ne doit pas réécrire cet écran-ci.
      if (!install || install.guild_id !== current.guildId) return current
      return { ...current, install }
    })
  }, [fetchLatest])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const { installedId, authError } = readReturnParams()
    // Le paramètre est retiré dès qu'il est lu : sans ça, l'écran reviendrait
    // à chaque rafraîchissement.
    stripInstallParams()
    if (authError) return

    let cancelled = false

    const run = async () => {
      const install = await fetchLatest()
      if (cancelled) return

      if (installedId) {
        setIsChecking(false)
        if (install && install.guild_id === installedId) {
          setState({ kind: 'installed', guildId: installedId, install })
        }
        return
      }

      // Repli : le paramètre a été perdu (rafraîchissement, redirection
      // intermédiaire, app mobile). Une installation déjà acquittée est ignorée.
      if (!install) return
      if (readAck() === install.guild_id) return
      setState({ kind: 'installed', guildId: install.guild_id, install })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [fetchLatest])

  // Le bot n'a pas encore confirmé : une seule relecture, pas de sondage en boucle.
  const recheckedFor = useRef<string | null>(null)
  useEffect(() => {
    if (state.kind !== 'installed') return
    if (state.install && state.install.confirmed) return
    if (recheckedFor.current === state.guildId) return
    recheckedFor.current = state.guildId
    const timer = setTimeout(() => void recheck(), CONFIRM_RECHECK_MS)
    return () => clearTimeout(timer)
  }, [state, recheck])

  const dismiss = useCallback(() => {
    setState((current) => {
      if (current.kind === 'installed') writeAck(current.guildId)
      return { kind: 'idle' }
    })
  }, [])

  return { state, isChecking, dismiss, recheck }
}
