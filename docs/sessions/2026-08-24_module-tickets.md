# 2026-08-24 — Module Tickets

## Objectif

Intégrer le module **Tickets** au dashboard : configuration des panneaux et de
leurs catégories, plus les trois vues en lecture seule sur les tickets réels
(liste, statistiques, orphelins). Le module suit la spécification d'API fournie
(endpoints `/guilds/{id}/modules/tickets*` et `/guilds/{id}/tickets*`).

## Tâches accomplies

1. Types, constantes et plafonds du module (`types/api.ts`).
2. Helpers purs : identifiants, normalisation, sérialisation, quotas,
   validation, lecture des erreurs API et de l'accusé du bot (`lib/tickets.ts`).
3. Service HTTP couvrant les 8 routes (`services/tickets.ts`).
4. Écrans : page du module, carte de panneau, dialogue de catégorie, explorateur
   de tickets, briques partagées (`pages/modules/TicketsPage.tsx`,
   `components/tickets/`).
5. Câblage : route, entrée de sidebar, carte dans la vue d'ensemble du serveur.
6. Traductions EN + FR (`modules.tickets.*`, ~270 clés par langue).
7. Documentation (`CLAUDE.md`, ce fichier).

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/lib/tickets.ts` | Helpers purs du module |
| `app/src/services/tickets.ts` | Appels API (config, limites, tickets, stats, orphelins) |
| `app/src/pages/modules/TicketsPage.tsx` | Page du module (onglets Panneaux / Tickets) |
| `app/src/components/tickets/fields.tsx` | `Field`, `ChannelSelect`, `RoleChips`, `Notice`, `ApplyNotice` |
| `app/src/components/tickets/panel-card.tsx` | Un panneau : réglages + liste de ses catégories |
| `app/src/components/tickets/category-dialog.tsx` | Édition d'une catégorie (4 onglets) |
| `app/src/components/tickets/ticket-explorer.tsx` | Vues en lecture seule sur la table `tickets` |
| `docs/sessions/2026-08-24_module-tickets.md` | Ce résumé |

## Fichiers modifiés

- `app/src/types/api.ts` — section Tickets (types, constantes, plafonds).
- `app/src/main.tsx` — route `servers/:guildId/modules/tickets`.
- `app/src/components/app-sidebar.tsx` — entrée de navigation.
- `app/src/pages/GuildOverviewPage.tsx` — carte du module + `isTicketsActive()`.
- `app/src/locales/{en,fr}/translation.json` — arbre `modules.tickets`.
- `CLAUDE.md` — description du module, route, date de mise à jour.

## Décisions techniques

### Un brouillon, une écriture

La config est **un seul document réécrit en entier**. La page tient donc un
brouillon complet (`panels`) comparé à l'état enregistré via
`serializeTicketsConfig()` : c'est ce diff sérialisé qui pilote `UnsavedBar`.
Pas d'écriture immédiate à chaque action (contrairement à `welcome_channel`) :
chaque `PUT` republie tous les panneaux dans Discord et prend plusieurs secondes.

### Ids stables et `message_id`

`newTicketId()` génère `p_`/`c_` + 6 hex à la **création de l'objet uniquement**.
`message_id` est relu, conservé dans l'état et renvoyé tel quel : le bot apparie
les panneaux par `id` et republie de toute façon, mais perdre `message_id`
laisserait des messages orphelins dans les salons.

### `buttons` : trois états

`null` (défauts du bot), `[]` (aucun bouton) et une liste explicite doivent
produire trois JSON différents. L'UI expose donc un interrupteur
« personnaliser » : éteint → `null`, allumé et tout décoché → `[]`. Le
réordonnancement n'est pas proposé, l'ordre envoyé étant ignoré par le bot.

### `open_message`

Champ multi-lignes avec bascule aperçu (`DiscordMarkup`), insertion de
placeholders, et surtout : champ vidé → `null`, jamais `""`. Le texte par défaut
n'est affiché qu'en **placeholder**, depuis
`modules.tickets.channel.default_open_message` / `default_close_message`.

> ⚠️ Ces deux clés sont une **copie des locales du bot** (même convention que les
> libellés du module `logs`). Elles ne sont jamais enregistrées, mais leur
> wording doit être resynchronisé quand celui du bot change ; le dépôt du bot
> n'était pas accessible pendant cette session, le texte actuel est une reprise
> du format décrit par la spécification.

### Concurrence : le 409

Verrou local (`savingRef`) **et** gestion du `409` du backend : encart dédié avec
bouton *Réessayer*, aucun retry automatique, aucune relecture avant la réponse du
`PUT` précédent. Un double-clic sur « Enregistrer » ne part jamais deux fois.

### `_apply`

`ticketsApplyFeedback()` traduit l'accusé du bot en clé i18n + niveau :
`panels_failed > 0` → avertissement (« enregistré, mais le panneau est invisible
dans Discord »), `bot_timeout` → information **sans** bouton de réessai (la tâche
reste en file, la rejouer republierait deux fois),
`task_transport_unavailable` → erreur. Le retour est doublé : toast + encart
persistant sur la page.

### Erreurs

`mapTicketsApiError()` distingue les trois formes du champ `error` : tableau
Pydantic (dont le `loc` est remonté aux **ids envoyés** pour surligner le bon
champ dans le bon panneau/catégorie), chaîne métier (quota, salon, permissions →
bandeau global) et l'enveloppe `Validation error` des query params.
`validateTicketsConfig()` rejoue les règles certaines avant l'appel, sans jamais
bloquer un brouillon partiel (panneau sans salon, catégorie sans destination).

### Quotas

Tout vient de `GET .../limits`, rechargé au montage et après chaque écriture. Le
plafond d'un panneau est `min(max_categories_per_panel, discord_max[style])`,
recalculé à chaque rendu — changer le style d'un panneau met la limite à jour
immédiatement. Les valeurs en dur (`15`/`25`) ne servent que si la route n'a pas
répondu.

### Vues en lecture

Aucune écriture n'existe côté API : l'explorateur n'affiche donc **aucun bouton
d'action**. On montre `number` (jamais le snowflake), l'état est **dérivé** de
`status`/`escalated`/`claimed_by` (comme le fait le bot pour la pastille du nom
de salon), et `category: null` devient un badge « catégorie disparue ».
Un bandeau permanent s'affiche tant que `/tickets/orphans` renvoie `count > 0`,
et la suppression d'une catégorie ayant des tickets ouverts passe par une
confirmation chiffrée qui renvoie vers `/ticket move`.

## Vérifications

- `npm run build` (tsc + vite) : OK.
- `npm run lint` : aucun nouveau problème (les 22 restants préexistaient).

## Prochaines étapes suggérées

1. Resynchroniser `modules.tickets.channel.*` avec les locales réelles du bot.
2. Aperçu du panneau (rendu Components V2) une fois le format exposé côté bot.
3. Filtre par panneau et par propriétaire dans l'explorateur (l'API les accepte
   déjà : `panel_id`, `owner_id`).
