import { toast } from 'sonner'
import i18n from '@/i18n'
import { ApiError } from '@/lib/auth'
import { asSanctionError, notifySanctionChanged, VIOLATIONS_PATH } from '@/lib/sanctions'
import type { SanctionErrorPayload } from '@/types/violations'

interface ErrorToastOptions {
  /** Message principal affiché à l'utilisateur */
  title: string
  /** Contexte technique (ex: "starboard/save") — visible uniquement en debug */
  context?: string
}

/**
 * Toast dédié aux 403 de sanction globale. Le message vient du back-end quand
 * il existe, sinon d'une clé i18n par code (`user_suspended`,
 * `new_module_blocked`…) — jamais le code nu. `subject_type` dit qui porte la
 * sanction : « votre compte » vs « ce serveur ».
 */
export function showSanctionToast(sanction: SanctionErrorPayload): void {
  // L'UI vient de découvrir une sanction qu'elle ne connaissait pas : on
  // recharge le statut pour aligner les verrous sur la réalité.
  notifySanctionChanged()
  const t = i18n.t.bind(i18n)
  const title = t(`violations.errors.${sanction.code}`, {
    defaultValue: t('violations.errors.default'),
  })
  const parts = [
    sanction.message ||
      t(`violations.errorSubject.${sanction.subject_type}`, { defaultValue: '' }),
    sanction.references.length > 0
      ? t('violations.errorReferences', { refs: sanction.references.join(' · ') })
      : '',
  ].filter(Boolean)

  toast.error(title, {
    description: parts.join(' — ') || undefined,
    action: {
      label: t('violations.banner.seeDetails'),
      onClick: () => {
        // `violations_url` est absolue (https://moddy.app/violations) : sur le
        // dashboard lui-même, c'est notre propre route — on y reste plutôt que
        // d'ouvrir un onglet vers la même page.
        const raw = sanction.violations_url || VIOLATIONS_PATH
        try {
          const url = new URL(raw, window.location.origin)
          if (url.origin === window.location.origin) window.location.assign(url.pathname)
          else window.open(url.href, '_blank', 'noopener,noreferrer')
        } catch {
          window.location.assign(VIOLATIONS_PATH)
        }
      },
    },
  })
}

/**
 * Gestion d'erreur centralisée pour les actions utilisateur (save, disable…).
 * - Affiche un toast d'erreur avec le message API si disponible
 * - En mode debug (?debug=true), affiche les détails techniques
 * - Re-throw si c'est une erreur 401 (l'intercepteur dans api() gère déjà la redirection)
 */
export function handleSaveError(error: unknown, options: ErrorToastOptions): void {
  if (error instanceof ApiError) {
    // 401 → déjà géré par l'intercepteur global (redirection login)
    if (error.isUnauthorized) return

    const isDebug = new URLSearchParams(window.location.search).get('debug')

    // 403 de sanction globale : son `error` est un objet, pas une chaîne. Il
    // porte son propre message et le lien vers le dossier — le handler
    // générique le rendrait en « HTTP 403 ».
    const sanction = asSanctionError(error)
    if (sanction) {
      showSanctionToast(sanction)
      return
    }

    if (error.isForbidden) {
      toast.error("Accès refusé", {
        description: "Vous n'avez pas la permission d'effectuer cette action.",
      })
      return
    }

    if (error.isNetworkError) {
      toast.error("Erreur de connexion", {
        description: "Impossible de contacter le serveur. Vérifiez votre connexion.",
      })
      return
    }

    if (error.isServerError) {
      toast.error(options.title, {
        description: isDebug
          ? `[HTTP ${error.status}] ${error.message}`
          : "Erreur serveur. Réessayez dans quelques instants.",
      })
      return
    }

    // Autre erreur API (400, 422, 404…) → affiche le message de l'API
    toast.error(options.title, {
      description: isDebug
        ? `[HTTP ${error.status}] ${error.message}`
        : error.message,
    })
    return
  }

  // Erreur JavaScript inattendue
  const isDebug = new URLSearchParams(window.location.search).get('debug')
  toast.error(options.title, {
    description: isDebug
      ? String(error)
      : "Une erreur inattendue s'est produite.",
  })
}
