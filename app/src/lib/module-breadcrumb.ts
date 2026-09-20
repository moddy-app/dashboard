import { useSyncExternalStore } from 'react'

// Fil d'Ariane des écrans **internes** à un module.
//
// Un module comme Tickets se parcourt en niveaux (module → panneau → catégorie)
// sans changer d'URL : `UnsavedBar` pose un `useBlocker`, une route par niveau
// ferait surgir « modifications non enregistrées » à chaque descente. Le fil
// d'Ariane de `DashboardPage`, lui, se construit depuis l'URL — il n'a donc
// aucun moyen de savoir où l'on est.
//
// D'où ce petit magasin hors de React : la page publie ses segments, l'en-tête
// les lit. Un `useSyncExternalStore` plutôt qu'un contexte, pour que la page
// puisse publier depuis un effet sans déclencher un `setState` en cascade.

export interface ModuleCrumb {
  label: string
  /** Absent sur le dernier segment : c'est l'écran où l'on se trouve. */
  onSelect?: () => void
}

export interface ModuleTrail {
  /** Retour à la racine du module — posé sur le segment qui porte son nom. */
  onRoot?: () => void
  /** Segments **sous** le nom du module, du plus haut au plus profond. */
  items: ModuleCrumb[]
}

const EMPTY: ModuleTrail = { items: [] }

let trail: ModuleTrail = EMPTY
const listeners = new Set<() => void>()

/** Publié par l'écran courant. Sans segment, le fil d'Ariane suit l'URL seule. */
export function setModuleCrumbs(next: ModuleTrail | null): void {
  trail = next && next.items.length > 0 ? next : EMPTY
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useModuleCrumbs(): ModuleTrail {
  return useSyncExternalStore(subscribe, () => trail)
}
