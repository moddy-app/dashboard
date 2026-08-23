# 2026-08-23 — Module `logs` (logs de serveur)

## Objectif

Implémenter le module **`logs`** dans le dashboard d'après le guide backend :
18 catégories d'événements reliées à des salons Discord, avec exclusions par
catégorie, filtres et diagnostics. Aucun interrupteur, aucun gating premium, un
seul document JSON lu et réécrit **en entier**.

L'ancien module `logging` (`GET/PATCH /guilds/{id}/logging`, page
`LoggingPage.tsx`) a été **retiré** dans la foulée : il est obsolète et faisait
doublon à l'écran. `logs` est désormais le seul écran de logs du dashboard.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/lib/logs.ts` | Normalisation, corps du `PUT`, validation miroir, mapping des erreurs, diagnostics, libellés |
| `app/src/services/logs.ts` | Les 5 endpoints (`/catalog`, `GET`, `PUT`, `/diagnostics`, `DELETE`) |
| `app/src/pages/modules/LogsPage.tsx` | Page du module |
| `docs/sessions/2026-08-23_module-logs.md` | Ce résumé |

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/types/api.ts` | Types `LogsConfig`, `LogCategoryConfig`, `LogsCatalog`, `LogsDiagnostics`, `LogsChannelDiagnostic` ; `'logs'` ajouté à `ModuleId` et à `ModuleConfig` ; types de fils (`10`/`11`/`12`) ajoutés à `CHANNEL_TYPES` + `THREAD_CHANNEL_TYPES` |
| `app/src/main.tsx` | Route `servers/:guildId/modules/logs` |
| `app/src/components/app-sidebar.tsx` | Entrée de sidebar (icône `FileClockIcon`) |
| `app/src/pages/GuildOverviewPage.tsx` | Carte du module + `isLogsActive()` dans `isModuleEnabled()` |
| `app/src/locales/{en,fr}/translation.json` | Bloc `modules.logs.*` ajouté, bloc `modules.logging.*` supprimé |

## Retrait de l'ancien module `logging`

Supprimés : `app/src/pages/modules/LoggingPage.tsx`, l'entrée de sidebar, la
carte de la vue d'ensemble, `'logging'` dans `ModuleId`, `LoggingConfig` (type
et entrée de `ModuleConfig`), `getLoggingConfig()` / `updateLogging()` dans
`services/guilds.ts`, et le bloc de traductions `modules.logging.*`.

La route `servers/:guildId/modules/logging` est **conservée en redirection**
(`<Navigate to="../logs" replace />`) : les liens et favoris existants tombent
sur le nouveau module au lieu d'une 404. Les endpoints `/guilds/{id}/logging`
existent peut-être encore côté backend — plus rien ne les appelle ici.

## Décisions d'implémentation

### Le catalogue est la source de vérité
Limites (`channels_per_category`, `ignored_channels`, `ignored_roles`), locales,
catégories et événements viennent tous de `GET /catalog` — rien n'est codé en
dur. `normalizeLogsCatalog()` porte des valeurs de repli (3 / 25 / 25) utilisées
**uniquement** si la réponse ne sert pas `limits`, jamais à la place.

Le catalogue est identique pour toutes les guildes : il est mis en cache au
niveau du module de service (une requête par session). Un échec n'est **jamais**
mis en cache, sinon la page resterait cassée jusqu'au rechargement complet.

### On ne persiste que les exclusions
`buildLogsBody()` calcule `disabled_events` comme la liste des **décochés**,
filtrée sur le catalogue. Les cases sont donc cochées par défaut et un événement
ajouté plus tard au registre du bot démarre allumé — c'est la propriété que le
stockage inversé protège.

### La réponse du `PUT` remplace l'état local
Le backend retire les catégories qui n'ont ni salon ni exclusion : la réponse
peut contenir moins de catégories que l'envoi. `setSavedConfig(saved)` +
`setDraft(saved)`, jamais le brouillon.

### Pas d'interrupteur
`enabled` est calculé (`any(categories[*].channel_ids)`), il n'est jamais envoyé.
Le badge d'état reflète la valeur **de la base** ; un `enabled: false` après une
sauvegarde réussie déclenche un toast d'avertissement explicite (« enregistré,
mais rien ne sera logué ») — c'est le piège n°1 du module.

Deux façons d'arrêter, exposées séparément parce qu'elles ne font pas la même
chose :
- **Retirer tous les salons** — mutation du brouillon, l'admin enregistre
  lui-même ; les décochages sont conservés.
- **Réinitialiser** — `DELETE`, avec dialogue de confirmation qui annonce la
  perte des exclusions et des listes d'ignorés.

### Erreurs : deux formes, un emplacement global
`mapLogsError()` normalise le champ `error` sous ses deux formes (tableau
Pydantic / chaîne contextuelle Discord), retire le préfixe `Value error, `,
range les messages par chemin (`categories.server.channel_ids`, `locale`,
`ignored_*`) et extrait catégorie et snowflakes du texte pour surligner la bonne
carte. Les messages à `loc: []` (validateurs de modèle) partent dans un encart
**global** en haut du formulaire, sinon ils disparaîtraient.

`validateLogsBody()` refait les contrôles du backend avant l'appel : le 422 reste
le filet, pas l'UX.

### Diagnostics
Appelé au montage **et** après chaque sauvegarde réussie. `checked: false`
n'affiche rien (Discord injoignable ≠ diagnostic négatif). Salon supprimé, type
incompatible et permissions manquantes sortent en rouge ; `manage_webhooks` en
jaune, avec le message long qui explique la conséquence réelle (perte de l'envoi
groupé pendant les pics), jamais présenté comme une erreur. Chaque encart nomme
les catégories routées vers le salon concerné.

### Webhooks orphelins
Le dashboard n'a pas de jeton Discord : il ne supprime rien. Après une écriture,
les salons déliés depuis l'état précédent sont listés dans un encart qui dit où
supprimer le webhook « Moddy Logs » à la main.

### Libellés
Le catalogue ne sert que des identifiants ; les noms lisibles vivent dans les
locales du **bot**, à résoudre via `locale_keys` (`modules.logs.events.…` /
`modules.logs.titles.…`). `eventLabel()` teste `i18n.exists()` et retombe sur
l'identifiant nu — aucun nom n'est réinventé côté dashboard. **Tant que le
fichier de locales du bot n'est pas recopié dans `src/locales/`, le formulaire
affiche les identifiants** : c'est le comportement prescrit, et poser ce fichier
suffira à faire apparaître les libellés sans toucher au code.

Les noms de catégories n'ont pas de clé au catalogue : ils passent par
`modules.logs.categories.<id>` avec repli sur l'identifiant. Seules les trois
catégories attestées dans le guide (`server`, `messages`, `moderation`) sont
traduites pour l'instant.

### Détails respectés
- Snowflakes **chaînes** de bout en bout, aucun `Number()` (d'où le non-usage de
  `resolveChannelId`, qui compare via `Number`).
- Destinations filtrées sur texte / annonces / fils actifs ; les fils sont
  marqués 🧵 et le hint rappelle qu'un fil archivé est traité comme introuvable.
- `ignored_channel_ids` accepte **tous** les types de salons (exclusion, pas
  destination).
- Événements `unimplemented` grisés avec badge « bientôt » + tooltip, jamais
  masqués ; `moderation.case_update` porte « partiel ».
- Aucun badge premium, aucun gating. Le seul verrou est la sanction globale sur
  l'activation d'un module jamais configuré (`gates.canEnableNewModule`).
- Aucune attente d'accusé de réception : ce module n'en a pas (`_apply` est
  propre à `altguard`).
- `404` sur le `GET` = « jamais configuré », pas une erreur.

## Vérifications

- `npm run build` (tsc -b + vite build) : OK.
- `npm run lint` : aucun problème dans les fichiers ajoutés/modifiés (les 18
  erreurs restantes préexistent sur d'autres fichiers).

## Prochaines étapes

1. Recopier (ou servir) le fichier de locales du bot pour les 163 événements et
   leurs titres — le mécanisme est déjà branché.
2. Compléter `modules.logs.categories.*` avec les 18 identifiants réels une fois
   le catalogue observé en vrai.
3. Éventuellement nettoyer les webhooks « Moddy Logs » via l'API Discord si le
   dashboard obtient un jeton — aujourd'hui c'est une simple mention.
