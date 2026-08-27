# Session 2026-08-07 — Intégration du module Automod IA (`automod_ai`)

## Objectif

Intégrer proprement le module de modération IA (`automod_ai`) au dashboard :
page de configuration serveur, état réel du module, contrôle anti-injection des
indications, et panneau staff pour le budget IA quotidien.

Référence : `docs/API_ENDPOINTS.md` § « Module — Automod AI ».

## Tâches accomplies

1. Types TypeScript du module (config, statut, contrôle des indications, budget).
2. Normalisation des erreurs API (`error` chaîne **ou** tableau de validation).
3. Service `automod.ts` couvrant les 6 endpoints du module.
4. Page de configuration `/servers/:guildId/modules/automod_ai`.
5. Panneau staff « Budget IA » (`/staff?tab=automod_budget`).
6. Câblage : route, sidebar serveur, sidebar staff, carte sur l'aperçu du serveur.
7. Traductions EN + FR (parité des clés vérifiée).

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/services/automod.ts` | Appels API du module + config par défaut + constantes (`INDICATIONS_MAX`, `EXEMPT_MAX`) |
| `app/src/pages/modules/AutomodAiPage.tsx` | Page de configuration complète |
| `app/src/components/automod/automod-budget-panel.tsx` | Panneau staff du budget IA |
| `docs/sessions/2026-08-07_module-automod-ai.md` | Ce document |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `app/src/types/api.ts` | `AutomodAiConfig`, `AutomodFeature`, `AutomodAiStatus`, `AutomodIndicationsCheck`, `AutomodBudget`, `AutomodMaxAction`, `AutomodLanguage`, `AutomodWarning` ; `automod_ai` ajouté à `ModuleId` et à l'union `ModuleConfig` |
| `app/src/lib/auth.ts` | `ApiError.detail` + `validationIssues` ; aplatissement des erreurs `422` tableau ; getter `isUnavailable` (503) |
| `app/src/main.tsx` | Route `servers/:guildId/modules/automod_ai` |
| `app/src/components/app-sidebar.tsx` | Entrée « Modération IA » (serveur) et « Budget IA » (staff) |
| `app/src/pages/GuildOverviewPage.tsx` | Carte du module + helper `isModuleEnabled()` |
| `app/src/pages/StaffPage.tsx` | Onglet `automod_budget` (rôles Dev / Manager / Supervisor_Mod) |
| `app/src/locales/{en,fr}/translation.json` | Clés `modules.automod_ai.*`, `staff.automodBudget.*`, `staff.tabs.automodBudget` |

## Documentation technique

### Flow de la page

```
GET /modules/automod_ai   (404 → config par défaut, pas une erreur)
GET /modules/automod_ai/status        } en parallèle
channels + roles                       } déjà fournis par GuildContext
        ↓
édition locale (draft) ; debounce 800 ms sur `indications` → POST /indications/check
        ↓
PUT /modules/automod_ai  (objet COMPLET, dérivé de l'objet reçu)
        ↓
réponse = config persistée → ré-hydratation du formulaire → re-GET /status
```

### Points de conception

- **`running` ≠ `enabled`.** Le badge d'état et les bandeaux d'avertissement se
  lisent exclusivement sur `GET /status` (`running`, `warnings`). `enabled` seul
  n'affiche rien : le module ne tourne qu'avec un salon d'alertes **et** au moins
  un détecteur actif. `missing_notify_channel` est rendu en style *destructive*
  (mauvaise config n°1), les autres avertissements en ambre.
- **Objet complet au PUT.** Le brouillon est un clone de l'objet reçu, muté par
  `patch()` / `patchFeature()` — jamais reconstruit. `categories_desactivees`
  (champ ops, sans sélecteur) et tout champ ajouté plus tard côté backend
  traversent donc l'aller-retour intacts (`[key: string]: unknown` sur le type).
- **Snowflakes en chaînes.** `notify_channel_id`, `exempt_roles` et
  `exempt_channels` restent des `string` de bout en bout ; `api()` requote déjà
  les grands entiers avant `JSON.parse`, aucun `Number()` n'est appliqué.
- **Contrôle anti-injection.** Debounce 800 ms, rejoué uniquement si le texte
  diffère de celui enregistré (activer un toggle ne coûte aucun appel IA). Un
  compteur de séquence ignore les réponses tardives. `503` → avertissement
  ambre, la sauvegarde reste possible. Le check client n'est jamais considéré
  comme suffisant : le PUT peut toujours répondre `422` (raison affichée) ou
  `503` (rien n'a été écrit → toast avec bouton « Réessayer »).
- **Erreurs de validation.** Le champ `error` peut être une chaîne ou un tableau
  `[{loc, msg}]`. `ApiError` conserve la forme brute (`detail`) et expose
  `validationIssues` ; la page mappe `loc` sur le champ concerné. Une chaîne sur
  un `422` est rattachée au salon d'alertes (seul cas produit par le backend).
  Avant ce correctif, un tableau finissait en `[object Object]` dans le toast.
- **Détecteurs génériques.** `features` est rendu par itération sur la map :
  les prochains détecteurs (anti-link, anti-spam…) de forme
  `{enabled, exempt_roles, exempt_channels}` s'afficheront sans code
  supplémentaire, libellés par `defaultValue` sur l'id. Aucun id n'est inventé
  côté front (le backend renvoie `422 Fonctionnalité inconnue`).
- **Limite d'exemptions.** 25 entrées par liste, bloquée côté UI (le sélecteur
  d'ajout est remplacé par un message quand la limite est atteinte).
- **Budget IA.** Staff uniquement, donc hors du dashboard serveur : onglet
  dédié dans `/staff`, avec saisie de l'ID du serveur (gardé en chaîne),
  consommation du jour, plafond modifiable et restauration du défaut
  (`{"cap": null}`).

## Vérifications

- `npm run build` (tsc + vite) : OK.
- `npm run lint` : aucun problème sur les fichiers ajoutés/modifiés.
- Test manuel automatisé (Playwright + API mockée) : rendu de la page, bandeau
  `missing_notify_channel`, badge « À l'arrêt », chips d'exemption, barre de
  sauvegarde, refus puis acceptation du contrôle des indications, corps du PUT
  (`categories_desactivees` conservé, `notify_channel_id` en chaîne), config
  absente (404 → formulaire vierge), `422` tableau et `422` chaîne mappés sur
  leur champ, panneau staff du budget.

## Prochaines étapes suggérées

- Brancher la liste des catégories (`categories_desactivees`) si le besoin
  produit apparaît — le champ est aujourd'hui conservé mais non éditable.
- `GET /modules/automod_ai/schema` reste inutilisé : à envisager si le
  formulaire doit devenir généré plutôt qu'écrit à la main.
- Afficher les décisions récentes de l'automod (cartes du salon d'alertes) dans
  la page, en lien avec la section Preuves des cases.
