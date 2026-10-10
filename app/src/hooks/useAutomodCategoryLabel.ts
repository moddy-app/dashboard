import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getAutomodCatalog, getAutomodConfig } from "@/services/automod"

/**
 * Libellé lisible d'une catégorie automod (`payload.categorie`) dans une case.
 *
 * Ordre : 1. catalogue / config du serveur (lecteur qui administre le serveur),
 * 2. `categorie_label` (instantané au moment de la sanction), 3. id brut.
 *
 * Les appels ne sont faits que si `guildId` est fourni (vue serveur). Tout
 * échec (403…) est silencieux : on retombe simplement sur l'étape 2.
 * Le catalogue est déjà en cache dans le service ; la config l'est ici.
 */

interface Source {
  /** id prédéfini → nom brut (chaîne ou dictionnaire de locales) */
  catalog: Map<string, unknown>
  /** id `perso:<id>` → nom */
  custom: Map<string, string>
}

const sourceCache = new Map<string, Promise<Source | null>>()

function loadSource(guildId: string): Promise<Source | null> {
  const cached = sourceCache.get(guildId)
  if (cached) return cached
  // Lecture défensive : le typage du catalogue peut évoluer.
  const promise = Promise.all([
    getAutomodCatalog(guildId).catch(() => null),
    getAutomodConfig(guildId).catch(() => null),
  ]).then(([catalog, config]) => {
    if (!catalog && !config) return null
    const catalogMap = new Map<string, unknown>()
    const infractions = (catalog as { infractions?: unknown } | null)?.infractions
    if (Array.isArray(infractions)) {
      for (const inf of infractions as Record<string, unknown>[]) {
        if (typeof inf?.id === "string") catalogMap.set(inf.id, inf.name ?? inf.nom ?? inf.label)
      }
    }
    const customMap = new Map<string, string>()
    const perso = (config as { infractions_perso?: unknown } | null)?.infractions_perso
    if (Array.isArray(perso)) {
      for (const inf of perso as Record<string, unknown>[]) {
        if (typeof inf?.id === "string" && typeof inf.nom === "string") customMap.set(inf.id, inf.nom)
      }
    }
    return { catalog: catalogMap, custom: customMap }
  })
  sourceCache.set(guildId, promise)
  return promise
}

function pickName(raw: unknown, language: string): string | null {
  if (typeof raw === "string") return raw || null
  if (raw && typeof raw === "object") {
    const dict = raw as Record<string, unknown>
    const preferred = language.toLowerCase().startsWith("fr") ? dict["fr"] : dict["en-US"]
    if (typeof preferred === "string" && preferred) return preferred
    const first = Object.values(dict).find((v): v is string => typeof v === "string" && v !== "")
    return first ?? null
  }
  return null
}

export function useAutomodCategoryLabel(guildId: string | null) {
  const { i18n } = useTranslation()
  const [source, setSource] = useState<Source | null>(null)

  useEffect(() => {
    if (!guildId) return
    let active = true
    loadSource(guildId).then((s) => active && setSource(s))
    return () => {
      active = false
    }
  }, [guildId])

  const language = i18n.language
  return useCallback(
    (categorie: string | null, snapshot?: string | null): string | null => {
      if (!categorie) return snapshot ?? null
      if (guildId && source) {
        const name = categorie.startsWith("perso:")
          ? source.custom.get(categorie.slice("perso:".length)) ?? source.custom.get(categorie) ?? null
          : pickName(source.catalog.get(categorie), language)
        if (name) return name
      }
      return snapshot || categorie
    },
    [guildId, source, language]
  )
}
