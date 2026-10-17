import { api, ApiError } from '@/lib/auth'
import type {
  BotCustomizationState,
  BotCustomizationUpdate,
  BotCustomizationUpload,
} from '@/types/api'

/** Au-delà, on abandonne l'attente : la tâche reste en file côté bot. */
const SAVE_TIMEOUT_MS = 30_000

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/bot_customization`

/**
 * État courant + tout ce qu'il faut au formulaire (limites, listes de polices et
 * d'effets, statut premium). Aucun appel au bot : la réponse est immédiate.
 */
export async function getBotCustomization(
  guildId: string | number
): Promise<BotCustomizationState> {
  return (await api(BASE(guildId))) as BotCustomizationState
}

/**
 * Applique la personnalisation. **N'envoyer que le diff** : clé absente = champ
 * inchangé, clé à `null` = champ réinitialisé, clé avec valeur = champ appliqué.
 * Un corps vide renvoie `422 empty_update`.
 *
 * L'écriture est déléguée au bot (téléchargement de l'image puis appel Discord)
 * et peut prendre plusieurs secondes — timeout serveur 25 s, puis `504
 * bot_timeout` : dans ce cas la tâche reste en file, **ne pas rejouer**. Le client
 * abandonne lui-même l'attente après 30 s (même signal).
 */
export async function saveBotCustomization(
  guildId: string | number,
  update: BotCustomizationUpdate
): Promise<void> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, SAVE_TIMEOUT_MS)
  try {
    await api(BASE(guildId), {
      method: 'PATCH',
      body: JSON.stringify(update),
      signal: controller.signal,
    })
  } catch (e) {
    // Une attente abandonnée n'est pas une panne réseau : même signal qu'un
    // `504 bot_timeout` du backend (la modification sera appliquée, ne pas rejouer).
    if (timedOut && e instanceof ApiError && e.status === 0) {
      throw new ApiError(504, 'bot_timeout', 'bot_timeout', { error: 'bot_timeout' })
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/** Reset complet : pseudo, bio, avatar, bannière et style. */
export async function resetBotCustomization(guildId: string | number): Promise<void> {
  await api(BASE(guildId), { method: 'DELETE' })
}

/**
 * Héberge temporairement une image pour que le bot la télécharge (premium requis).
 * L'URL renvoyée **expire en 15 min** : uploader au moment du save, pas à la
 * sélection du fichier.
 */
export async function uploadBotCustomizationImage(
  guildId: string | number,
  file: File
): Promise<BotCustomizationUpload> {
  const form = new FormData()
  form.append('file', file)
  return (await api(`${BASE(guildId)}/uploads`, {
    method: 'POST',
    body: form,
  })) as BotCustomizationUpload
}
