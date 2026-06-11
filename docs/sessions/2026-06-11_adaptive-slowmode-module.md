# Session 2026-06-11 — Module Adaptive Slowmode

## Objectif
Intégrer le module "Adaptive Slowmode" dans le dashboard Moddy, permettant aux admins de configurer un slowmode dynamique par salon Discord.

## Tâches accomplies

### 1. Composant Slider UI (`app/src/components/ui/slider.tsx`)
- Créé le composant `Slider` basé sur `@radix-ui/react-slider` (via `radix-ui`)
- Supporte les sliders à double poignée (range) pour sélectionner min/max
- Suit les conventions shadcn/ui existantes (data-slot, cn(), etc.)

### 2. Types TypeScript (`app/src/types/api.ts`)
- Ajouté `Sensitivity` type (`'low' | 'medium' | 'high'`)
- Ajouté `ChannelSlowmodeConfig` interface (`min_delay`, `max_delay`, `sensitivity`)
- Ajouté `AdaptiveSlowmodeConfig` interface (`channels: Record<string, ChannelSlowmodeConfig>`)
- Ajouté `'adaptive_slowmode'` au type `ModuleId`
- Ajouté `AdaptiveSlowmodeConfig` à l'union `ModuleConfig`

### 3. Service API (`app/src/services/guilds.ts`)
- `getAdaptiveSlowmodeConfig(guildId)` — GET `/guilds/{id}/modules/adaptive_slowmode`
- `upsertSlowmodeChannel(guildId, channelId, config)` — PUT `/guilds/{id}/modules/adaptive_slowmode/channels/{channelId}`
- `deleteSlowmodeChannel(guildId, channelId)` — DELETE `/guilds/{id}/modules/adaptive_slowmode/channels/{channelId}`
- `saveAdaptiveSlowmodeConfig(guildId, config)` — PUT `/guilds/{id}/modules/adaptive_slowmode` (batch)

### 4. Page du module (`app/src/pages/modules/AdaptiveSlowmodePage.tsx`)
Architecture : liste de salons avec Dialog d'ajout/édition (per-channel immediate saves)

**Composants internes :**
- `ChannelForm` — formulaire complet avec :
  - Select de salon (text channels uniquement, hors salons déjà configurés)
  - Dual range Slider (indices 0-13 → délais VALID_DELAYS non linéaires)
  - Sélecteur de sensibilité (3 boutons visuels : low/medium/high)
  - Labels dynamiques (min → max en temps humain)
- `SensitivityBadge` — badge coloré par sensibilité (bleu/amber/rouge)

**UX implémentée :**
- Liste des salons configurés avec info de délai et badge de sensibilité
- Boutons Éditer (PencilIcon) et Supprimer (TrashIcon) par ligne
- Dialog modal pour ajout/édition (SELECT bloqué en mode édition)
- AlertDialog de confirmation avant suppression
- État vide avec call-to-action "Ajouter le premier salon"
- Bouton "Désactiver le module" (DELETE générique via GuildContext)
- Skeletons de chargement pendant le fetch de config

**Gestion des délais valides :**
```ts
const VALID_DELAYS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600]
```
Le slider utilise des indices (0-13) mappés aux délais réels pour que les crans soient uniformes.

**Pas d'UnsavedBar** : chaque action est immédiate (PUT/DELETE par salon), pas de batch edit.

### 5. Routing (`app/src/main.tsx`)
- Import de `AdaptiveSlowmodePage`
- Route ajoutée : `servers/:guildId/modules/adaptive_slowmode`

### 6. Sidebar (`app/src/components/app-sidebar.tsx`)
- Import de `GaugeIcon` depuis lucide-react
- Entrée ajoutée dans `guildNavItems` pour le module Adaptive Slowmode

### 7. Vue d'ensemble (`app/src/pages/GuildOverviewPage.tsx`)
- Import de `GaugeIcon`
- `adaptive_slowmode` ajouté à la liste `allModules` (affiché dans les cartes de modules)

### 8. Traductions (`app/src/locales/en/translation.json` + `fr/translation.json`)
Clés ajoutées sous `modules.adaptive_slowmode.*` :
- Métadonnées du module (name, description, enableDescription)
- Config UI (configTitle, configDescription, addChannel, editChannel, etc.)
- Délais (delayRange, delayRangeDescription, delayOff)
- Sensibilité (sensitivity, sensitivity_low/medium/high + _desc)
- États vides et erreurs (empty, emptyDescription, errorMaxMin)
- Dialogs (confirmDeleteTitle, confirmDeleteDescription)
- Actions communes (cancel, save, delete)

## Fichiers créés/modifiés

| Fichier | Action |
|---|---|
| `app/src/components/ui/slider.tsx` | Créé |
| `app/src/pages/modules/AdaptiveSlowmodePage.tsx` | Créé |
| `app/src/types/api.ts` | Modifié (types + ModuleId + ModuleConfig) |
| `app/src/services/guilds.ts` | Modifié (4 nouvelles fonctions) |
| `app/src/main.tsx` | Modifié (import + route) |
| `app/src/components/app-sidebar.tsx` | Modifié (GaugeIcon + nav item) |
| `app/src/pages/GuildOverviewPage.tsx` | Modifié (GaugeIcon + allModules) |
| `app/src/locales/en/translation.json` | Modifié (adaptive_slowmode section) |
| `app/src/locales/fr/translation.json` | Modifié (adaptive_slowmode section) |

## Décisions techniques

- **Per-channel saves** plutôt que batch : l'API permet les upserts individuels, plus réactif pour une liste
- **Slider à indices** : VALID_DELAYS est non linéaire (0→5→10→...→21600), mapper les indices du slider aux valeurs réelles donne des crans uniformes
- **AlertDialog pour suppression** : action irréversible, nécessite confirmation
- **SELECT bloqué en édition** : on ne peut pas changer le salon d'une config existante (l'ID est la clé de la config)
- **Sensibilité par boutons visuels** : meilleur affordance qu'un select pour 3 options avec descriptions

## Technologies utilisées
- `@radix-ui/react-slider` via `radix-ui` (unifié)
- Shadcn/ui patterns (Dialog, AlertDialog, Slider, Badge, Skeleton)
- react-i18next pour les traductions EN/FR
- lucide-react (GaugeIcon, PencilIcon, PlusIcon, Trash2Icon, LoaderIcon)

## Prochaines étapes suggérées
- Ajouter le module dans la liste des commandes de la CommandMenu (command-menu.tsx)
- Tester les 422 de validation Pydantic côté backend (affichage du `detail[0].msg`)
- Envisager la sauvegarde batch (PUT complet) pour un mode "édition multi-salons"
