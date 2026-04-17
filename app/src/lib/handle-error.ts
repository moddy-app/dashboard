import { toast } from 'sonner'
import { ApiError } from '@/lib/auth'

interface ErrorToastOptions {
  /** Message principal affiché à l'utilisateur */
  title: string
  /** Contexte technique (ex: "starboard/save") — visible uniquement en debug */
  context?: string
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
