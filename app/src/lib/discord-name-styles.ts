/**
 * Rendu des « name styles » Discord (police × effet × couleur).
 *
 * Le CSS et les polices viennent du build web Discord (voir
 * `src/styles/discord-name-styles.css`). Ce module fait deux choses que le CSS
 * ne peut pas faire seul :
 *
 * 1. **Dériver la palette.** Discord ne transmet qu'une couleur de base ; les
 *    six autres variables (`--dns-light-1`, `--dns-dark-2`, …) sont calculées
 *    côté client, en HSL, à H et S constants. Les formules sont recalées sur
 *    les 4 palettes complètes présentes dans le DOM Discord (`#7935ef`,
 *    `#f42098`, `#0fcf86`, `#dcdcdf`) : 24 valeurs sur 24 exactes au hex près.
 * 2. **Traduire les identifiants de l'API en classes CSS.** Le backend Moddy
 *    expose `font_id` / `effect_id` numériques ; le CSS attend des slugs.
 */

// ─── Conversion couleur ───────────────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v))

interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToHsl(hex: string): Hsl {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let hue = 0
  let sat = 0

  if (max !== min) {
    const d = max - min
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue /= 6
  }
  return { h: hue * 360, s: sat * 100, l: l * 100 }
}

export function hslToHex({ h, s, l }: Hsl): string {
  const S = s / 100
  const L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) =>
    L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

// ─── Palette ──────────────────────────────────────────────────────────────────

export interface NameStylePalette {
  main: string
  light1: string
  light2: string
  dark1: string
  dark2: string
  toonStroke: string
  neonStroke: string
}

/** Couleur « Par défaut » du sélecteur Discord (gris clair). */
export const DEFAULT_NAME_COLOR = '#dcdcdf'

/**
 * Palette exacte du swatch « Par défaut », relevée dans le DOM Discord : elle
 * ne suit pas la règle `S → 100 %` sur `neonStroke` (sa saturation reste à
 * 4,5 %), donc elle est reprise telle quelle plutôt que recalculée.
 */
const DEFAULT_PALETTE: NameStylePalette = {
  main: '#dcdcdf',
  light1: '#ffffff',
  light2: '#ffffff',
  dark1: '#7f7f8a',
  dark2: '#2a2a2e',
  toonStroke: '#55555d',
  neonStroke: '#94949e',
}

export function derivePalette(baseHex: string): NameStylePalette {
  const hex = baseHex.toLowerCase()
  if (hex === DEFAULT_NAME_COLOR) return { ...DEFAULT_PALETTE }

  const { h, s, l } = hexToHsl(hex)
  const L = (mult: number) => hslToHex({ h, s, l: clamp(l * mult) })

  return {
    main: hex,
    light1: L(1.2),
    light2: L(1.6),
    dark1: L(0.6),
    dark2: L(0.2),
    toonStroke: L(0.4),
    // Saturation poussée à 100 %, luminosité relevée de 10 pts puis plafonnée à
    // 60 %. Exact sur les 3 palettes colorées de l'échantillon ; la borne des
    // 60 % n'est confirmée que par un seul cas non plafonné. Le garde-fou sur
    // les couleurs très désaturées (< 20 %) est une supposition, pas une
    // observation — c'est le seul endroit du fichier qui en contient une.
    neonStroke: hslToHex({ h, s: s < 20 ? s : 100, l: Math.min(60, l + 10) }),
  }
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

/** Slugs de police — suffixes des classes CSS `dns-font-<slug>`. */
export const NAME_FONT_SLUGS = [
  'default',
  'tempo',
  'sakura',
  'jellybean',
  'modern',
  'medieval',
  '8bit',
  'vampyre',
] as const
export type NameFontSlug = (typeof NAME_FONT_SLUGS)[number]

/** Slugs d'effet — suffixes des classes CSS `dns--<slug>`. */
export const NAME_EFFECT_SLUGS = ['solid', 'gradient', 'neon', 'toon', 'pop'] as const
export type NameEffectSlug = (typeof NAME_EFFECT_SLUGS)[number]

/**
 * `font_id` de l'API → classe CSS. La table est établie à partir des familles
 * d'origine : Discord a renommé ses fichiers et vidé leurs tables `name`, mais
 * ses propres noms de classes CSS trahissent les polices sources.
 *
 * | id | Famille d'origine | Nom Discord | Slug |
 * |----|-------------------|-------------|------|
 * | 3  | Cherry Bomb One   | Sakura      | `sakura` |
 * | 4  | Chicle            | Jellybean   | `jellybean` |
 * | 6  | MuseoModerno      | Moderne     | `modern` |
 * | 7  | Neo Castel        | Médiéval    | `medieval` |
 * | 8  | Pixelify Sans     | 8 bits      | `8bit` |
 * | 10 | Sinistre          | Vampyre     | `vampyre` |
 * | 12 | Zilla Slab        | Tempo       | `tempo` |
 *
 * Corriger ce seul objet suffit à corriger tout le rendu — aucune autre partie
 * du code ne connaît les identifiants. Un id absent de la table retombe sur la
 * police d'UI ({@link fontSlug}) plutôt que de casser l'aperçu.
 */
export const FONT_ID_TO_SLUG: Record<number, NameFontSlug> = {
  3: 'sakura',
  4: 'jellybean',
  6: 'modern',
  7: 'medieval',
  8: '8bit',
  10: 'vampyre',
  12: 'tempo',
}

/**
 * Effets. Un seul point d'ancrage confirmé : `gradient_effect_id === 2`
 * (documenté par l'API). Le reste suit l'ordre du sélecteur Discord — solid
 * n'est pas proposé par le backend (`effect_ids: [2, 3, 4, 5]`), l'absence
 * d'effet valant déjà « couleur unie ».
 *
 * `effectSlug()` relit le dégradé depuis `limits.gradient_effect_id` plutôt
 * que depuis cette table : si le backend renumérote, le dégradé suit.
 */
export const EFFECT_ID_TO_SLUG: Record<number, NameEffectSlug> = {
  2: 'gradient',
  3: 'neon',
  4: 'toon',
  5: 'pop',
}

export function fontSlug(fontId: number | null | undefined): NameFontSlug {
  if (fontId === null || fontId === undefined) return 'default'
  return FONT_ID_TO_SLUG[fontId] ?? 'default'
}

export function effectSlug(
  effectId: number | null | undefined,
  gradientEffectId?: number
): NameEffectSlug {
  if (effectId === null || effectId === undefined) return 'solid'
  if (gradientEffectId !== undefined && effectId === gradientEffectId) return 'gradient'
  return EFFECT_ID_TO_SLUG[effectId] ?? 'solid'
}

/** `true` si la police/l'effet est rendu fidèlement (sinon : repli silencieux). */
export function isKnownFont(fontId: number): boolean {
  return fontId in FONT_ID_TO_SLUG
}

export function isKnownEffect(effectId: number, gradientEffectId?: number): boolean {
  return effectId === gradientEffectId || effectId in EFFECT_ID_TO_SLUG
}

// ─── Variables CSS ────────────────────────────────────────────────────────────

/** Style inline prêt à être posé sur le conteneur `.dns-name`. */
export type NameStyleVars = Record<string, string>

/**
 * Portage direct de `paletteToCssVars()` du kit. Les valeurs de `--dns-wrap`
 * sont celles attendues par le CSS (`wrap` / `nowrap`), pas des synonymes.
 */
export function paletteToCssVars(
  baseHex: string,
  { wrap = "nowrap", opacity = 1 }: { wrap?: "wrap" | "nowrap"; opacity?: number } = {}
): NameStyleVars {
  const p = derivePalette(baseHex)
  return {
    "--dns-main": p.main,
    "--dns-light-1": p.light1,
    "--dns-light-2": p.light2,
    "--dns-dark-1": p.dark1,
    "--dns-dark-2": p.dark2,
    "--dns-toon-stroke-color": p.toonStroke,
    "--dns-neon-stroke": p.neonStroke,
    "--dns-wrap": wrap,
    "--dns-font-opacity": String(opacity),
  }
}

/** Le dégradé n'utilise pas la palette dérivée : deux arrêts explicites. */
export function gradientVars(
  fromHex: string,
  toHex: string,
  { from = 10, to = 90 }: { from?: number; to?: number } = {}
): NameStyleVars {
  return {
    "--dns-gradient-stops": `${fromHex} ${from}%, ${toHex} ${to}%`,
    "--dns-main": fromHex,
  }
}

/**
 * Variables pour un effet donné. `colors` vient du module : une couleur pour
 * tous les effets, deux pour le dégradé.
 */
export function nameStyleVars(
  colors: string[],
  effect: NameEffectSlug,
  { wrap = false }: { wrap?: boolean } = {}
): NameStyleVars {
  const base = colors[0] ?? DEFAULT_NAME_COLOR
  const opts = { wrap: (wrap ? "wrap" : "nowrap") as "wrap" | "nowrap" }

  if (effect === "gradient") {
    return {
      ...paletteToCssVars(base, opts),
      ...gradientVars(base, colors[1] ?? base),
    }
  }
  return paletteToCssVars(base, opts)
}

// ─── Style par défaut du bot ──────────────────────────────────────────────────

/**
 * Style de pseudo global de Moddy : **effet pop, en bleu**. C'est ce que
 * Discord affiche là où la guilde n'a rien personnalisé — l'aperçu doit donc y
 * retomber, au même titre que l'avatar ou la bio retombent sur le profil global.
 *
 * Aucun endpoint ne l'expose (`/bot/profile` ne renvoie pas le style de pseudo) :
 * ces trois valeurs sont écrites en dur, ici et nulle part ailleurs. Le bleu est
 * celui du sélecteur Discord.
 */
export const DEFAULT_BOT_NAME_STYLE = {
  font: 'default' as NameFontSlug,
  effect: 'pop' as NameEffectSlug,
  color: '#1C98EB',
}
