import { api } from '@/lib/auth'
import type {
  BotCustomizationState,
  BotCustomizationUpdate,
  BotCustomizationUpload,
} from '@/types/api'

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
 * bot_timeout` : dans ce cas la tâche reste en file, **ne pas rejouer**.
 */
export async function saveBotCustomization(
  guildId: string | number,
  update: BotCustomizationUpdate
): Promise<void> {
  await api(BASE(guildId), {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
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
