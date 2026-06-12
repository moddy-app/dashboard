# Session 2026-06-12 — Suppression de l'assombrissement des overlays

## Objectif
Retirer la couche noire/sombre des arrière-plans flouté des overlays du dashboard, en conservant uniquement l'effet de flou.

## Tâches accomplies
- Suppression de la classe `bg-black/80` dans les 4 composants d'overlay shadcn/ui

## Fichiers modifiés
- `app/src/components/ui/dialog.tsx` — ligne 40 : retrait de `bg-black/80`
- `app/src/components/ui/sheet.tsx` — ligne 40 : retrait de `bg-black/80`
- `app/src/components/ui/drawer.tsx` — ligne 38 : retrait de `bg-black/80`
- `app/src/components/ui/alert-dialog.tsx` — ligne 39 : retrait de `bg-black/80`

## Composants indirectement affectés
- `command.tsx` (CommandDialog) — utilise `dialog.tsx`, bénéficie du changement automatiquement
- `sidebar.tsx` (mobile) — utilise `sheet.tsx`, bénéficie du changement automatiquement
- `notification-drawer.tsx` — utilise `drawer.tsx` et `dialog.tsx`, bénéficie du changement automatiquement

## Décision technique
La classe `supports-backdrop-filter:backdrop-blur-xs` est conservée sur tous les overlays. Seule `bg-black/80` est retirée. Le fond reste donc transparent avec uniquement l'effet de flou CSS (`backdrop-filter: blur`).

## Notes
- Le changement est cohérent sur tous les composants concernés
- Aucune régression sur les animations (fade-in/fade-out) ou le z-index
