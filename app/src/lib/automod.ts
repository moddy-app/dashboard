import type {
  AutomodAiConfig,
  AutomodCrans,
  AutomodFeature,
  AutomodGravity,
  AutomodProfileAction,
  AutomodSanction,
} from '@/types/api'

// Helpers purs du module `automod_ai`. Les snowflakes restent des chaînes de
// bout en bout : aucun `Number()` ici (un id de 19 chiffres perdrait sa
// précision).

/**
 * Les cinq détecteurs connus, dans l'ordre du backend (celui de
 * `status.active_features`). Un id hors de cette liste est refusé en `422
 * Fonctionnalité inconnue` : le dashboard n'en invente jamais.
 */
export const AUTOMOD_FEATURE_IDS = [
  'content',
  'image_nsfw',
  'image_gore',
  'image_scam',
  'profile',
] as const
export type AutomodFeatureId = (typeof AUTOMOD_FEATURE_IDS)[number]

/** Seul bloc qui porte `scan_all` (ignoré par le backend ailleurs). */
export const SCAN_ALL_FEATURE = 'image_scam'

/** Seul bloc qui porte `avatar` / `banner` / `pseudo`. */
export const PROFILE_FEATURE = 'profile'

/**
 * Le détecteur de profils n'a pas d'exemption de salons (un profil n'est pas
 * dans un salon) : son `exempt_channels` vaut toujours `[]`.
 */
function hasChannelExemptions(id: string): boolean {
  return id !== PROFILE_FEATURE
}

/**
 * Valeurs par défaut d'un bloc, celles du `/schema` : désactivé, sans
 * exemption, `scan_all: false` sur `image_scam` et les trois contrôles de
 * profil actifs sur `profile`.
 */
export function defaultAutomodFeature(id: string): AutomodFeature {
  const feature: AutomodFeature = { enabled: false, exempt_roles: [], exempt_channels: [] }
  if (id === SCAN_ALL_FEATURE) feature.scan_all = false
  if (id === PROFILE_FEATURE) {
    feature.avatar = true
    feature.banner = true
    feature.pseudo = true
  }
  return feature
}

/** Ids dans l'ordre d'affichage : les cinq connus d'abord, puis le reste reçu. */
export function orderedFeatureIds(features: Record<string, AutomodFeature>): string[] {
  const known: string[] = AUTOMOD_FEATURE_IDS.filter((id) => id in features)
  const extra = Object.keys(features).filter((id) => !known.includes(id))
  return [...known, ...extra]
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())]
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((v) => set.has(v))
}

export interface SharedExemptions {
  roles: string[]
  channels: string[]
  /**
   * Les blocs ne portent pas la même liste (config modifiée ailleurs que dans
   * le panneau du bot ou ce dashboard). L'UI affiche alors l'**union** et le
   * signale : elle n'unifie rien tant que l'admin ne le demande pas.
   */
  diverged: boolean
}

/**
 * La liste unique affichée dans l'UI, dérivée des blocs. Les salons ignorent
 * `profile` (toujours vide) : il ne peut pas créer de divergence.
 */
export function sharedExemptions(features: Record<string, AutomodFeature>): SharedExemptions {
  const entries = Object.entries(features)
  const roles = union(entries.map(([, f]) => f.exempt_roles ?? []))
  const channelBlocks = entries.filter(([id]) => hasChannelExemptions(id)).map(([, f]) => f)
  const channels = union(channelBlocks.map((f) => f.exempt_channels ?? []))
  const diverged =
    entries.some(([, f]) => !sameSet(f.exempt_roles ?? [], roles)) ||
    channelBlocks.some((f) => !sameSet(f.exempt_channels ?? [], channels))
  return { roles, channels, diverged }
}

/**
 * Recopie une liste d'exemptions sur **tous** les blocs, comme le panneau du
 * bot — sauf les salons, jamais écrits sur `profile` (toujours `[]`).
 */
export function applyExemptions(
  features: Record<string, AutomodFeature>,
  changes: { roles?: string[]; channels?: string[] }
): Record<string, AutomodFeature> {
  const next: Record<string, AutomodFeature> = {}
  for (const [id, feature] of Object.entries(features)) {
    next[id] = {
      ...feature,
      ...(changes.roles && { exempt_roles: [...changes.roles] }),
      ...(!hasChannelExemptions(id)
        ? { exempt_channels: [] }
        : changes.channels && { exempt_channels: [...changes.channels] }),
    }
  }
  return next
}

/**
 * Complète une config lue. Une config enregistrée avant les détecteurs d'image
 * ne contient que `content` : un bloc absent veut dire « désactivé », on le
 * remplit avec les défauts du `/schema` et la prochaine sauvegarde écrit les
 * trois blocs. Les exemptions du bloc ajouté reprennent la liste commune — il
 * est désactivé, et sans ça l'UI signalerait une divergence qui n'en est pas une.
 *
 * Tout le reste (`scan_all`, `avatar`/`banner`/`pseudo`, champs inconnus) est
 * conservé tel quel : le `PUT` remplace la config entière.
 */
export function normalizeAutomodConfig(config: AutomodAiConfig): AutomodAiConfig {
  const received = config.features ?? {}
  const features: Record<string, AutomodFeature> = {}
  for (const [id, feature] of Object.entries(received)) {
    features[id] = {
      ...feature,
      enabled: feature.enabled === true,
      exempt_roles: feature.exempt_roles ?? [],
      exempt_channels: feature.exempt_channels ?? [],
    }
  }
  const shared = sharedExemptions(features)
  for (const id of AUTOMOD_FEATURE_IDS) {
    if (features[id]) continue
    features[id] = {
      ...defaultAutomodFeature(id),
      exempt_roles: [...shared.roles],
      exempt_channels: hasChannelExemptions(id) ? [...shared.channels] : [],
    }
  }
  return {
    ...config,
    sanctions: config.sanctions ?? {},
    infractions_perso: config.infractions_perso ?? [],
    features,
  }
}

// ─── Barème et infractions personnalisées ─────────────────────────────────────
// Le `/catalog` fait foi : ces constantes ne servent que de repli.

export const CUSTOM_INFRACTION_PREFIX = 'perso:'

/** Clé de `sanctions` d'une infraction personnalisée. */
export function customSanctionKey(id: string): string {
  return `${CUSTOM_INFRACTION_PREFIX}${id}`
}

export const GRAVITIES: readonly AutomodGravity[] = ['basse', 'moyenne', 'haute', 'critique']

/** Échelle des crans : 0 suppression seule, 1 avertissement, 2–6 mute, 7 ban. */
export const CRAN_LADDER: readonly {
  cran: number
  action: 'delete' | 'warn' | 'mute' | 'ban'
  duration_hours: number | null
}[] = [
  { cran: 0, action: 'delete', duration_hours: null },
  { cran: 1, action: 'warn', duration_hours: null },
  { cran: 2, action: 'mute', duration_hours: 2 },
  { cran: 3, action: 'mute', duration_hours: 12 },
  { cran: 4, action: 'mute', duration_hours: 48 },
  { cran: 5, action: 'mute', duration_hours: 168 },
  { cran: 6, action: 'mute', duration_hours: 672 },
  { cran: 7, action: 'ban', duration_hours: null },
]

export const PROFILE_ACTION_IDS: readonly AutomodProfileAction[] = [
  'hold',
  'rename_warn',
  'alert',
  'bareme',
]

export const DEFAULT_CUSTOM_CRANS: AutomodCrans = { basse: 0, moyenne: 1, haute: 2, critique: 4 }

/**
 * Identifiant d'infraction personnalisée : 6 caractères `[a-z0-9]`. Jamais un
 * id déjà pris (`existingIds`) ni déjà utilisé (`usedIds`, ex. ids supprimés
 * dans la session) : un id réutilisé ferait hériter la nouvelle infraction
 * d'un ancien réglage de sanction.
 */
export function generateCustomInfractionId(
  existingIds: Iterable<string>,
  usedIds: Iterable<string> = []
): string {
  const taken = new Set<string>([...existingIds, ...usedIds])
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    const id = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
    if (!taken.has(id)) return id
  }
  throw new Error('Could not generate a unique custom infraction id')
}

/**
 * Retire une infraction personnalisée **et** son entrée de `sanctions` : une
 * clé `perso:<id>` orpheline est refusée en `422`.
 */
export function removeCustomInfraction(config: AutomodAiConfig, id: string): AutomodAiConfig {
  const { [customSanctionKey(id)]: _removed, ...sanctions } = config.sanctions ?? {}
  void _removed
  return {
    ...config,
    infractions_perso: (config.infractions_perso ?? []).filter((i) => i.id !== id),
    sanctions,
  }
}

/** Pose le réglage d'une infraction ; `null` supprime la clé (« Réinitialiser »). */
export function setSanction(
  config: AutomodAiConfig,
  key: string,
  entry: AutomodSanction | null
): AutomodAiConfig {
  const { [key]: _old, ...rest } = config.sanctions ?? {}
  void _old
  return { ...config, sanctions: entry === null ? rest : { ...rest, [key]: entry } }
}
