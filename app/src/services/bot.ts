import { api } from '@/lib/auth'
import type { BotProfile } from '@/types/api'

/**
 * Profil Discord global du bot. Session utilisateur normale, aucun droit
 * particulier. Lu en direct côté backend (cache Redis 5 min), donc pas de
 * mise en cache agressive à prévoir ici au-delà de la session.
 */
export async function getBotProfile(): Promise<BotProfile> {
  return (await api('/bot/profile')) as BotProfile
}
