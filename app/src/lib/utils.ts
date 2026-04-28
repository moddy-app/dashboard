import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Résout un snowflake stocké (possiblement arrondi avant le fix JSON) vers l'ID
 * correct de la liste live Discord. Compare d'abord en string exacte, puis en
 * nombre (Number() arrondit pareil → même float → égalité).
 */
export function resolveChannelId(
  stored: string | number | null | undefined,
  liveIds: string[]
): string {
  if (!stored) return ''
  const s = String(stored)
  if (liveIds.includes(s)) return s
  const matched = liveIds.find((id) => Number(id) === Number(s))
  return matched ?? s
}

export function resolveRoleIds(
  stored: (string | number)[],
  liveIds: string[]
): string[] {
  return stored.map((id) => {
    const s = String(id)
    if (liveIds.includes(s)) return s
    return liveIds.find((live) => Number(live) === Number(s)) ?? s
  })
}
