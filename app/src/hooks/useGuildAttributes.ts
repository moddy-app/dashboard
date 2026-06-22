import { useEffect, useState } from "react"
import { getGuilds } from "@/services/guilds"
import type { GuildAttributes } from "@/types/api"

// Attributs par serveur (GET /guilds → { guild_id, attributes }), mis en cache au
// niveau module. Sert aux badges (OFFICIAL, VERIFIED_ORG…) dans les listes où l'on
// n'a pas le détail complet de la guilde.

let cache: Map<string, GuildAttributes> | null = null
let inflight: Promise<Map<string, GuildAttributes>> | null = null

/** L'API renvoie parfois `attributes` comme JSON encodé en string. On normalise. */
function parseAttributes(raw: unknown): GuildAttributes {
  if (!raw) return {}
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as GuildAttributes
    } catch {
      return {}
    }
  }
  return raw as GuildAttributes
}

function load(): Promise<Map<string, GuildAttributes>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = getGuilds()
      .then((list) => {
        cache = new Map(
          list.map((g) => [String(g.guild_id), parseAttributes(g.attributes)])
        )
        return cache
      })
      .catch(() => new Map<string, GuildAttributes>())
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Retourne la map des attributs par serveur (vide tant que non chargée). */
export function useGuildAttributes(): Map<string, GuildAttributes> {
  const [map, setMap] = useState<Map<string, GuildAttributes>>(cache ?? new Map())
  useEffect(() => {
    let active = true
    load().then((m) => {
      if (active) setMap(m)
    })
    return () => {
      active = false
    }
  }, [])
  return map
}
