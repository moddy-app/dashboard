import type { AutomodAiConfig, AutomodFeature } from '@/types/api'

// Helpers purs du module `automod_ai`. Les snowflakes restent des chaînes de
// bout en bout : aucun `Number()` ici (un id de 19 chiffres perdrait sa
// précision).

/**
 * Les trois détecteurs connus, dans l'ordre du backend (celui de
 * `status.active_features`). Un id hors de cette liste est refusé en `422
 * Fonctionnalité inconnue` : le dashboard n'en invente jamais.
 */
export const AUTOMOD_FEATURE_IDS = ['content', 'image_nsfw', 'image_scam'] as const
export type AutomodFeatureId = (typeof AUTOMOD_FEATURE_IDS)[number]

/** Seul bloc qui porte `scan_all` (ignoré par le backend ailleurs). */
export const SCAN_ALL_FEATURE = 'image_scam'

/**
 * Valeurs par défaut d'un bloc, celles du `/schema` : désactivé, sans
 * exemption, et `scan_all: false` sur `image_scam`.
 */
export function defaultAutomodFeature(id: string): AutomodFeature {
  const feature: AutomodFeature = { enabled: false, exempt_roles: [], exempt_channels: [] }
  if (id === SCAN_ALL_FEATURE) feature.scan_all = false
  return feature
}

/** Ids dans l'ordre d'affichage : les trois connus d'abord, puis le reste reçu. */
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

/** La liste unique affichée dans l'UI, dérivée des blocs. */
export function sharedExemptions(features: Record<string, AutomodFeature>): SharedExemptions {
  const blocks = Object.values(features)
  const roles = union(blocks.map((f) => f.exempt_roles ?? []))
  const channels = union(blocks.map((f) => f.exempt_channels ?? []))
  const diverged = blocks.some(
    (f) => !sameSet(f.exempt_roles ?? [], roles) || !sameSet(f.exempt_channels ?? [], channels)
  )
  return { roles, channels, diverged }
}

/** Recopie une liste d'exemptions sur **tous** les blocs, comme le panneau du bot. */
export function applyExemptions(
  features: Record<string, AutomodFeature>,
  changes: { roles?: string[]; channels?: string[] }
): Record<string, AutomodFeature> {
  const next: Record<string, AutomodFeature> = {}
  for (const [id, feature] of Object.entries(features)) {
    next[id] = {
      ...feature,
      ...(changes.roles && { exempt_roles: [...changes.roles] }),
      ...(changes.channels && { exempt_channels: [...changes.channels] }),
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
 * Tout le reste (`categories_desactivees`, `scan_all`, champs inconnus) est
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
      exempt_channels: [...shared.channels],
    }
  }
  return {
    ...config,
    categories_desactivees: config.categories_desactivees ?? [],
    features,
  }
}
