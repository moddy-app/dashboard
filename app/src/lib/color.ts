// Conversions de couleur partagées : Discord stocke une couleur en entier
// décimal (`5793266`), le dashboard la manipule en hex `#RRGGBB`.

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** `#RRGGBB` strict (le `#` est obligatoire). */
export function isHexColor(value: string): boolean {
  return HEX_RE.test(value)
}

/** Tolère `ff0000` / `#ff0000` → `#FF0000` ; renvoie l'entrée rognée sinon. */
export function normalizeHex(value: string): string {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isHexColor(withHash) ? withHash.toUpperCase() : trimmed
}

/** `#FF0000` → `16711680`. Ne valide pas : voir `isHexColor`. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/** `16711680` → `#FF0000`. */
export function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`
}

/** Palette Discord (marque) + couleurs de rôles classiques. */
export const DISCORD_SWATCHES = [
  "#5865F2",
  "#57F287",
  "#FEE75C",
  "#EB459E",
  "#ED4245",
  "#FFFFFF",
  "#23272A",
  "#1ABC9C",
  "#2ECC71",
  "#3498DB",
  "#9B59B6",
  "#E91E63",
  "#F1C40F",
  "#E67E22",
  "#E74C3C",
  "#95A5A6",
]
