# Session 2026-08-21 — Intégration frontend du module AltGuard

## Objectif

Intégrer le module **AltGuard** (vérification anti multi-comptes à l'entrée d'un
serveur) au dashboard, en suivant le guide d'implémentation frontend fourni par
le backend et `docs/API_ENDPOINTS.md` § « Module — AltGuard ».

## Ce qui distingue AltGuard des autres modules

C'est un module **classique** : pas de routeur dédié, tout passe par le CRUD
générique `GET/PUT/DELETE /guilds/{id}/modules/altguard`. Deux particularités
seulement, mais structurantes :

1. **`_apply`** — la réponse d'une écriture contient l'accusé du bot. Une
   sauvegarde peut réussir en base et échouer à moitié dans Discord (panneau non
   posté, salons non verrouillés). Traiter un `200` comme un succès complet
   ferait croire à l'admin que son serveur est protégé alors qu'il ne l'est pas.
2. **Pas d'interrupteur** — `enabled` est *calculé* côté serveur (salon + les
   deux rôles). L'UI n'expose donc aucun switch : un badge d'état dérivé, et
   « Désactiver » = `DELETE`.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/services/altguard.ts` | `GET` / `PUT` / `DELETE`. Sépare `_apply` de la config, omet `message_id` et `enabled` du body, traite le `404` comme « jamais configuré » |
| `app/src/lib/altguard.ts` | Normalisation (snowflakes en chaînes), champs manquants, `isAltGuardActive()`, filtrage des sélecteurs, `applyFeedback()` |
| `app/src/pages/modules/AltGuardPage.tsx` | Page du module |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/types/api.ts` | `AltGuardConfig`, `AltGuardApply`, `AltGuardSaveResult`, `ALTGUARD_PANEL_LOCALES`, `'altguard'` dans `ModuleId` et `ModuleConfig`, `tags` ajouté à `Role` |
| `app/src/contexts/GuildContext.tsx` | Nouveau `syncModule(moduleId, config \| null)` |
| `app/src/main.tsx` | Route `servers/:guildId/modules/altguard` |
| `app/src/components/app-sidebar.tsx` | Entrée de navigation (`ShieldCheckIcon`) |
| `app/src/pages/GuildOverviewPage.tsx` | Carte du module + état actif dérivé via `isAltGuardActive()` |
| `app/src/locales/{en,fr}/translation.json` | Bloc `modules.altguard.*` (dont `apply.*`) |

## Décisions techniques

### `_apply` traduit en clés i18n, pas en phrases

`applyFeedback()` (`lib/altguard.ts`) reprend la logique du guide mais renvoie
`{ level, key, problems[] }` — des **clés i18n**, pas des chaînes françaises en
dur : le dashboard est bilingue. Correspondances :

| Cas | Niveau | Clé |
|---|---|---|
| pas de `_apply` | success | `apply.savedOnly` |
| `error: bot_timeout` | info | `apply.pending` |
| `error: task_transport_unavailable` | error | `apply.transportUnavailable` |
| `ok: false` | error | `apply.notApplied` |
| `panel: "failed"`, `permissions.failed > 0`, `hook_error`, `cleaned: false` | warning | `apply.appliedWithProblems` + détails |
| sinon | success | `apply.applied` / `apply.deleted` |

`bot_timeout` **ne propose aucun « Réessayer »** : la tâche reste dans le stream
et sera rejouée, un nouveau `PUT` republierait le panneau pour rien.

### L'accusé reste à l'écran

Le retour est doublé : un toast (immédiat) **et** un encart persistant sur la
page. Une permission manquante ne doit pas disparaître au bout de quatre
secondes — c'est le seul endroit où l'admin apprend que son serveur n'est pas
protégé malgré un « Enregistré ✅ ».

### `_apply` n'entre jamais dans le formulaire

Le service le retire du corps (`splitApply`) avant de rendre la config : il ne
peut donc ni polluer l'état du formulaire, ni repartir dans le body suivant.
Idem pour `message_id` et `enabled`, jamais envoyés (le premier est du
bookkeeping du bot, le second est calculé).

### Hiérarchie des rôles : signalée, pas masquée

Le guide filtre les rôles au-dessus du rôle le plus haut du bot. Le dashboard ne
dispose d'**aucune donnée sur le membre bot** (ni `/guilds/{id}/discord` ni
`/roles` ne renvoient ses rôles) : la seule approximation possible est son rôle
d'intégration, retrouvé via `tags.bot_id === VITE_DISCORD_CLIENT_ID`. C'est une
borne **basse** — un bot peut porter des rôles plus hauts. Les rôles au-dessus
sont donc rendus **désactivés avec une mention « au-dessus de Moddy »**, jamais
masqués : masquer sur une estimation ferait disparaître sans explication des
rôles peut-être valides. Les règles certaines (pas `@everyone`, pas de rôle
géré, pas deux fois le même rôle) filtrent ou désactivent réellement.

### Sauvegarde partielle assumée

Le bouton Enregistrer n'est jamais bloqué : une config incomplète est acceptée
(`200`, `enabled: false`). En revanche un encart « Module inactif : il manque
X » nomme précisément les champs qui manquent, et le badge d'en-tête passe en
« Inactif ». Pas d'auto-save au `blur` : chaque écriture republie le panneau.

### 422 rattachées aux champs

`mapValidationError()` mappe d'abord les erreurs Pydantic via `loc`, puis, pour
les 422 contextuelles (`pre_save`) qui arrivent en chaîne lisible, reconnaît le
champ nommé en début de message (« `channel_id` invalide: … »). Le message est
affiché tel quel sous le champ.

### `syncModule` dans `GuildContext`

La page utilise son propre service (elle a besoin de `_apply`), donc le contexte
ne voyait pas l'écriture : la sidebar et la vue d'ensemble seraient restées sur
l'état d'avant la sauvegarde. `syncModule('altguard', config | null)` aligne
l'état local sans relancer un chargement complet du serveur (qui, lui,
démonterait le formulaire et effacerait l'accusé affiché).

### Sanctions globales

Rien de spécifique : le bandeau `DashboardSanctionBanner` reconnaît déjà toute
route `/servers/:id/modules/:moduleId`. La page ajoute la garde de cohérence
habituelle — un module **jamais configuré** ne peut pas être créé sous sanction
(`new_module_blocked`), vérifié avant d'engager une requête qui peut durer 25 s.
Un module déjà configuré reste pleinement modifiable, et `DELETE` n'est jamais
bloqué.

## Points d'attention

- **Pas d'aperçu du panneau.** Le guide suggérait un aperçu statique par langue.
  Le texte exact du panneau vit côté bot : en inventer une version côté front
  aurait produit un aperçu faux dès la première retouche du bot. Le sélecteur de
  langue indique simplement que le texte n'est pas configurable. À rajouter le
  jour où le backend expose ce texte.
- **Aucune donnée de vérification n'est affichée** (scores, signaux, données du
  membre) : le backend n'en reçoit rien, c'est volontaire.
- **Pas de timeout côté client** : une sauvegarde peut prendre ~25 s, un encart
  le dit sous le formulaire.

## Vérifications

- `npm run build` (tsc + vite) : OK
- `npm run lint` : 21 problèmes, tous préexistants — aucun sur les fichiers
  touchés (même total qu'avant la session).
