import type { GuildAttributes } from "@/types/api"

export type VerifiedKind = "official" | "verified_org" | "discord"

/** Détermine le badge de vérification à afficher (priorité : officiel Moddy >
 *  organisation vérifiée > vérifié par Discord). Retourne null si aucun. */
export function resolveVerifiedKind(
  attributes: GuildAttributes | undefined,
  features: string[] | undefined
): VerifiedKind | null {
  if (attributes?.OFFICIAL || features?.includes("OFFICIAL_SERVER")) return "official"
  if (attributes?.VERIFIED_ORG) return "verified_org"
  if (features?.includes("VERIFIED")) return "discord"
  return null
}
