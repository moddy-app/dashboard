import { api } from '@/lib/auth'
import { GUILD_LANGUAGE_CHOICES } from '@/types/api'
import type { GuildLanguageSettings } from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/settings/language`

/**
 * Normalise la réponse. Le backend sert déjà une `language` canonique : on ne
 * la nettoie pas, on se contente de garantir la forme des champs facultatifs
 * (`effective_language`, `is_community` et `preferred_locale` sont `null` quand
 * Discord est injoignable) et de ne jamais rendre un sélecteur vide.
 */
function normalize(raw: Record<string, unknown>): GuildLanguageSettings {
  const choices = Array.isArray(raw.choices)
    ? raw.choices.filter((c): c is string => typeof c === 'string')
    : []
  return {
    guild_id: String(raw.guild_id ?? ''),
    language: typeof raw.language === 'string' ? raw.language : 'auto',
    effective_language:
      typeof raw.effective_language === 'string' ? raw.effective_language : null,
    preferred_locale: typeof raw.preferred_locale === 'string' ? raw.preferred_locale : null,
    is_community: typeof raw.is_community === 'boolean' ? raw.is_community : null,
    choices: choices.length > 0 ? choices : [...GUILD_LANGUAGE_CHOICES],
  }
}

/**
 * Réglage courant. **Jamais mis en cache au-delà de la vue** : un admin peut
 * changer la langue depuis `/config` dans Discord et rien n'est publié vers le
 * dashboard dans ce sens — un cache client afficherait une valeur périmée
 * indéfiniment. On relit donc à chaque ouverture de la page.
 */
export async function getGuildLanguage(
  guildId: string | number
): Promise<GuildLanguageSettings> {
  return normalize((await api(BASE(guildId))) as Record<string, unknown>)
}

/**
 * Écriture clé par clé (`jsonb_set` côté backend).
 *
 * ⚠️ Ne **jamais** passer par `PATCH /guilds/{id}/settings` pour la langue : cet
 * endpoint fait un merge de premier niveau dans `data`, donc un body qui ne
 * porte que `{settings: {language}}` écrase tout le nœud `settings` et efface
 * les autres réglages que `/config` peut y écrire.
 *
 * La réponse est **le même payload que le `GET`**, déjà rafraîchi : on remplace
 * l'état local avec, sans refaire un `GET` derrière.
 */
export async function setGuildLanguage(
  guildId: string | number,
  language: string
): Promise<GuildLanguageSettings> {
  return normalize(
    (await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify({ language }),
    })) as Record<string, unknown>
  )
}
