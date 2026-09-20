# 2026-09-20 — Refonte du module Tickets (configuration + avis) et correction du `Switch`

## Objectif

Rendre le module Tickets lisible. Deux demandes :

1. la **configuration** était incompréhensible et hétérogène par rapport au reste du dashboard ;
2. l'onglet **Avis** devait reprendre le système de filtres en chips de l'onglet Tickets.

Plus un défaut signalé en cours de route : le composant `Switch` s'affichait mal **partout sur le site**.

## Préalable : le checkout était périmé

Le dépôt local était sur `c11b84c` alors que `origin/preview` **et** `origin/main` pointaient tous
deux sur `20c230a` — 10 commits de retard, dont `4661708` (explorateur unifié + chips) et `a61158b`
(transcriptions, avis, réglages). La branche `preview` a été repartie de `origin/main`
(`git checkout -B preview origin/main`) ; rien d'unmergé n'a été perdu, `preview` ayant été squashée
dans `main`.

## Le vrai bug du `Switch`

`app/src/components/ui/switch.tsx` ciblait `data-checked:` / `data-unchecked:`, qui sont les
sélecteurs **Base UI**. Ce projet est sur **Radix**, qui n'écrit que `data-state="checked" | "unchecked"`
(vérifié dans `@radix-ui/react-switch@1.2.6`), et Tailwind v4 compile `data-checked:` en `[data-checked]`
— attribut jamais posé. **Aucune** règle d'état ne s'appliquait : pas de fond, pas de déplacement du
curseur. Le registre shadcn sert la même version fautive (contrôlé avec `shadcn add switch --diff`),
donc « réinstaller le composant » n'aurait rien corrigé : la correction est locale et commentée dans
le fichier pour qu'on ne la « remette pas comme l'upstream ».

La géométrie a été reprise dans la foulée en nombres entiers (piste 36×20 et curseur 16 px en taille
par défaut, 28×16 et 12 px en `sm`, 1 px de bordure + 1 px de padding) : l'ancienne version collait le
curseur au bord, d'où l'impression qu'il débordait.

Même classe de bug corrigée dans `ui/field.tsx` (`has-data-checked:` → `has-data-[state=checked]:`).

## Ce qui a changé dans le module

### Vocabulaire et structure (`TicketsPage.tsx`, `panels-tab.tsx`)

- Les onglets **disaient le contraire de leur contenu** : `settings` portait les *panneaux* et
  `general` les *réglages*. Nouvel ordre et nouvelles valeurs : `panels` · `settings` · `tickets` ·
  `ratings`, avec une icône chacun. `tabs.general` est supprimée.
- Quatre bandeaux pouvaient s'empiler avant le contenu. Seuls le conflit `409` et l'accusé du bot
  restent en tête de page ; le bandeau orphelins et les erreurs globales sont descendus dans l'onglet
  qu'ils concernent.
- Chaque onglet est une `Card`, comme tous les autres modules du dépôt.
- L'onglet des panneaux est extrait dans `panels-tab.tsx` ; la page redevient un chef d'orchestre.
- Pendant la sauvegarde (plusieurs secondes), le contenu des deux onglets d'édition passe en `inert` :
  la réponse du `PUT` remplace l'état local, ce qui serait tapé entre-temps disparaîtrait sans bruit.

### Les erreurs deviennent visibles

Une erreur de validation pouvait être invisible : panneau replié, dialogue fermé, onglet non
sélectionné. Désormais un panneau replié porte un badge « N erreurs », chaque onglet du dialogue de
catégorie une pastille rouge, et un blocage ou un `422` **ouvre le panneau fautif et défile jusqu'au
champ** (`Field` porte un `fieldId` dérivé de `panelFieldKey()`).

### Formulaires

- `panel-card.tsx` : trois sections nommées (Publication / Apparence / Catégories), `FieldGroup`,
  `ToggleGroup` pour le style, `InputGroup` pour la couleur d'accent (le bouton de réinitialisation
  est désormais toujours rendu, la largeur ne saute plus). La poignée `GripVertical` est retirée :
  il n'y a aucun drag & drop, c'était une affordance mensongère.
- `category-dialog.tsx` : `FieldSet`/`FieldLegend` pour les boutons et les permissions, `ToggleGroup`
  pour le style de bouton, `claim_lock` indenté sous `claim_enabled`, et le `Select` à valeur vide
  détourné en menu « ajouter un rôle » remplacé par un `DropdownMenu`.
- `settings-panel.tsx` : trois `FieldSet` (Journal / Archives / Fermeture).

### Briques partagées (nouveau)

- `fields.tsx` repose désormais sur `ui/field`, `ui/alert` et `ui/empty`. Description et erreur
  **cohabitent** : retirer l'aide au moment précis où l'on se trompe est le pire moment.
- `row-primitives.tsx` — avatar, point de séparation, horodatage relatif (date absolue en infobulle),
  compteur, coquille de ligne. Les trois listes du module se ressemblent maintenant par construction.
- `filter-primitives.tsx` — la mécanique des chips, écrite **une seule fois**. Elle porte deux
  temporisations qu'on ne devine pas en relisant : 160 ms avant d'ouvrir un chip fraîchement ajouté
  et 250 ms de garde à la fermeture. Sans elles, le clic qui vient de sélectionner le filtre dans le
  menu est reçu par le popover comme un « clic extérieur » et le chip se retire aussitôt.
  `ticket-filter-bar.tsx` a été reposé dessus sans changer son API.

### Onglet Avis

`rating-filters.ts` + `rating-filter-bar.tsx`, calqués sur ceux des tickets. Filtres : `window`,
`trigger`, `category`, `staff` — **tous serveur** (`TicketRatingsFilters` accepte `rated_staff_id`).
Le filtre d'appréciation n'expose que « négatifs seulement » (`max_score: 2`) : l'API ne sait pas
filtrer sur une appréciation précise, et on n'invente pas un filtre que le backend ne peut pas honorer.

⚠️ `window` pilote **aussi** `getTicketRatingsSummary()` : un seul chargement porte les deux appels.

Les lignes d'avis reprennent le rendu de l'explorateur (avatar, points, horodatage relatif) et la
ligne entière ouvre la transcription ; `transcript_key: null` (archive purgée) rend la ligne non
cliquable. **L'appréciation n'est jamais rendue en `n/5`** — `score_key` via nos traductions, `score`
ne sert qu'à trier. Le résumé n'est **pas** une `Card` : l'onglet en est déjà une, son titre serait
« Avis » deux fois.

## Invariants respectés

Ids `p_`/`c_` stables à vie · `message_id` propriété du bot · `buttons` à trois états
(`null` ≠ `[]` ≠ liste) · champs vidés → `null`, défauts du bot en placeholder seulement · `_apply`
hors de l'état du formulaire, `bot_timeout` jamais rejoué · `409` sans retry automatique · `PUT`
remplaçant tout · `isDirty` sur `serializeTicketsConfig()` · `admin` absorbant les 9 autres
permissions · `panelCategoryCap` recalculé à chaque rendu · snowflakes en chaînes · vues en lecture
seule · `syncModule()` après save et après disable.

`lib/tickets.ts`, `services/tickets.ts` et les types n'ont pas été touchés : c'est une refonte
d'interface, pas de contrat.

## Contrôles

- `npx tsc --noEmit` ✅ · `npx eslint` sur les fichiers touchés ✅ · `npm run build` ✅
- Les 18 erreurs ESLint restantes du dépôt sont **pré-existantes** et dans des fichiers non touchés
  (`HomePage`, `DashboardPage`, `AutoRolePage`, primitives `ui/` exportant des constantes).
- Vérification des clés i18n par script : toutes les clés statiques **et** les `labelKey` dynamiques
  des barres de filtres existent en `en` et en `fr`.
- **Pas de contrôle visuel** : l'écran demande une session et un serveur Discord réels.

## Prochaines étapes suggérées

- Passer l'explorateur de tickets et la liste d'avis sur `Empty`/`Alert` partout (il reste un encart
  d'erreur maison dans `ticket-explorer.tsx`).
- Ouvrir automatiquement le `CategoryDialog` fautif lors du défilement vers une erreur de catégorie
  (aujourd'hui seul le panneau parent s'ouvre).
- Auditer les autres modules : `AltGuardPage` et `LogsPage` gardent chacun leur copie de `Field`,
  `Notice` et `ToggleRow`, que `components/tickets/fields.tsx` pourrait remplacer.
