# Notifications — branchement sur l'API

**Date** : 2026-08-26
**Objectif** : rendre fonctionnel le système de notifications du dashboard, jusqu'ici alimenté par un tableau de données factices, en le branchant sur l'API réelle décrite par le « Guide d'intégration Dashboard — Notifications ».

---

## 0. Une correction en cours de session

Un premier passage a été fait sur la base d'un document différent — le guide
d'intégration **backend/bot** (contrat des quatre tables PostgreSQL,
algorithme de substitution des placeholders, worker de livraison). Ce n'était
pas le bon document pour ce dépôt : le dashboard ne parle pas à ces tables,
il parle à l'API HTTP, qui rend déjà tout.

Le bon document (« Guide d'intégration Dashboard — Notifications ») a été
fourni en cours de session et le travail a été repris dessus. La différence
change beaucoup de choses :

| | Guide backend (écarté) | Guide dashboard (utilisé) |
|---|---|---|
| Contenu | gabarit (`{user}`, `{server}`…), à substituer côté client | déjà résolu par l'API |
| `icon` | émoji custom `<:nom:id>`, à convertir en URL CDN | `icon_url` déjà une URL CDN |
| `accent_color` | entier décimal, à convertir en hex | déjà un hex CSS |
| Pagination | curseur composite `"<created_at>,<uuid>"` construit à la main | curseur opaque `next`, jamais construit — juste repassé |
| Endpoints | requêtes SQL directes sur les 4 tables | `GET /notifications`, `/notifications/{id}`, `/guilds/{id}/notifications[/inbox]` |

Ce document ne raconte que la version finale, sur le bon guide. Les fichiers
`lib/notifications.ts` et `services/notifications.ts` ont perdu toute la
partie substitution (`substitute()`, `renderTemplate()`, `customEmojiUrl()`,
`accentColorToHex()`) — inutile puisque l'API la fait déjà.

## 1. Point de départ

Le tiroir de notifications existait mais était une maquette :

- `app/src/types/notification.ts` — un modèle inventé (`criticality`, `sender`, `expiresAt`, `actions[]`) sans rapport avec le système réel ;
- `app/src/data/notifications.ts` — cinq notifications écrites en dur (« Maintenance programmée », « TrollMaster#9876 »…) ;
- `DashboardPage` tenait l'état en `useState`, le « lu » ne survivait pas à un rechargement.

## 2. Tâches accomplies

1. Modèle de données aligné sur la forme réellement servie par l'API : contenu résolu, origine (`source`, `null` seulement pour `kind = 'official'`), livraison Discord optionnelle.
2. Rendu du corps : `DiscordMarkup` pour le markdown, `degradeDiscordSyntax()` pour la syntaxe que seul Discord comprend (`<@id>`, `<#id>`, `<t:…:R>`).
3. Service de lecture (`GET /notifications`, `/notifications/{id}`, `/guilds/{id}/notifications[/inbox]`) avec pagination par curseur opaque.
4. État de lecture local (`localStorage`), faute d'accusé de réception côté API.
5. Réécriture du tiroir : origine, corps, sections, liens, pied, état de livraison Discord, chargement paginé, erreurs, squelettes.
6. Pastille de non-lues dans le menu utilisateur.
7. Suppression des données factices et de l'ancien modèle.
8. i18n complète (en + fr).

## 3. Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/types/notifications.ts` | Types du système : contenu résolu, origine, livraison, page |
| `app/src/lib/notifications.ts` | `degradeDiscordSyntax`, `notificationOrigin`, `isSafeNotificationUrl`, `reportBlockReasonKey` — fonctions **pures** de présentation, plus de substitution |
| `app/src/lib/notification-read-state.ts` | Lu/non-lu côté navigateur (`moddy_notifications_read`) |
| `app/src/services/notifications.ts` | `getNotifications`, `getNotification`, `getGuildNotifications`, `getGuildNotificationsInbox` + normalisation défensive |
| `app/src/hooks/useNotifications.ts` | Chargement, pagination par curseur, rafraîchissement, marquage |

## 4. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/components/notification-drawer.tsx` | Réécrit sur le nouveau modèle |
| `app/src/pages/DashboardPage.tsx` | `useNotifications()` remplace l'état local et les données d'exemple |
| `app/src/components/app-sidebar.tsx` | Passe `unreadNotifications` à `NavUser` |
| `app/src/components/nav-user.tsx` | Pastille de non-lues sur l'entrée « Notifications » |
| `app/src/locales/{en,fr}/translation.json` | Bloc `notifications` : origine, mentions, livraison ; `criticality` retiré |
| `CLAUDE.md` | Section « Notifications » + inventaire des fichiers |

## 5. Fichiers supprimés

- `app/src/data/notifications.ts` (données factices)
- `app/src/types/notification.ts` (modèle inventé — remplacé par `types/notifications.ts`, au pluriel)

## 6. Documentation technique

### 6.1 Le contenu est déjà résolu — pas de substitution côté dashboard

C'est la différence structurante avec le bot lui-même : le bot stocke un
*gabarit* (`{user}`, `{server}`) partagé par tous les destinataires d'un même
message, mais l'API que le dashboard consomme rend déjà tout avant de
répondre. `content.title`, `content.body`, chaque section, chaque lien et
`content.footer` sont du texte final. `icon_url` est une URL CDN (ou `null`),
`accent_color` un hex CSS (ou `null`).

Conséquence directe : `lib/notifications.ts` ne contient **aucune** fonction
de substitution. Un premier passage de cette session en avait écrit une
(`substitute()`, `renderTemplate()`, conversion d'entier en hex…) sur la base
du mauvais document — tout ça a été retiré.

### 6.2 Ce que l'API ne peut pas résoudre : la syntaxe propre à Discord

Le corps reste du **markdown Discord**, et peut porter `<@id>`, `<@&id>`,
`<#id>`, `<t:1700000000:R>` — des balises que seul le client Discord sait
afficher. `DiscordMarkup` (déjà utilisé pour les bios du bot) ne les
comprend pas : sans traitement, elles s'afficheraient brutes.

`degradeDiscordSyntax()` les remplace par du texte lisible **avant** de
passer par `DiscordMarkup` :

- les horodatages passent par `formatDiscordTimestamps()` (déjà écrit pour
  l'aperçu du module Welcome DM — fonction pure, `now` en paramètre) ;
- **une seule** mention est résolue : celle du lecteur (`selfId` = son propre
  `user_id`). C'est la seule identité disponible sans requête supplémentaire,
  et de très loin la plus fréquente (un message de bienvenue s'adresse à la
  personne qui le lit). Le reste tombe sur un libellé générique, traduit
  (« @utilisateur », « #salon »).

### 6.3 Le texte n'est pas de confiance

`body`/`sections[].body`/`footer` peuvent contenir du texte tapé par un
**admin de serveur tiers**. `DiscordMarkup` construit des nœuds React par
analyse de motifs — jamais de `dangerouslySetInnerHTML` — donc aucune
injection HTML n'est possible même si le texte est hostile. Les liens sont
rendus avec `rel="noopener noreferrer"` ; `isSafeNotificationUrl()`
(vérification `https://` uniquement) n'est qu'une seconde ligne de défense,
l'API filtrant déjà les liens sur ce critère.

### 6.4 L'origine, comme dans Discord

`source` est `null` **uniquement** quand `kind = 'official'` — Moddy en tant
qu'institution n'a personne d'autre à nommer. Sinon :

| État de `source` | Ce qui s'affiche |
|---|---|
| `guild_id` présent | icône (via `getGuildIconUrl()` — `guild_icon` est un **hash**, pas une URL) + nom + coche si `verified` ou `official`, lien vers `guild_url` (déjà construite par l'API) |
| pas de serveur, `service_id` présent | `service_label`, déjà résolu par l'API — pas de repli i18n à écrire côté dashboard |

Une valeur d'énumération inconnue (`kind`, `author`, `report_block`, le
`status` de livraison) dégrade silencieusement vers une valeur sûre plutôt
que de casser le rendu : le bot peut livrer de nouveaux expéditeurs sans
coordonner un déploiement de l'API.

### 6.5 La livraison Discord est optionnelle

`delivery.discord` n'existe que lorsque le bot a quelque chose à en dire. Un
`failed` ou `skipped` est **affiché** : « Moddy n'a pas pu vous envoyer ce
message sur Discord ». C'est précisément ce qui justifie une boîte de
réception sur le dashboard — un membre qui a fermé ses DM lit ici ce qu'il
n'a pas reçu là-bas.

### 6.6 Lu / non-lu : local, et assumé comme tel

Il n'existe aucun endpoint d'accusé de lecture. L'état vit dans
`localStorage` (`moddy_notifications_read`) :

```jsonc
{ "readBefore": "2026-08-26T18:00:00.000Z", "ids": ["uuid", "…"] }
```

« Tout marquer comme lu » pose une **borne temporelle** plutôt que d'énumérer
les ids : les pages pas encore chargées sont couvertes elles aussi. Toute
lecture et toute écriture sont enveloppées : en navigation privée ou quota
plein, la boîte reste lisible, simplement sans état de lecture. C'est un
confort d'affichage, pas une donnée de référence.

### 6.7 Pagination par curseur opaque

`next` est renvoyé par l'API et repassé **tel quel** dans `?before=` — jamais
construit à la main, jamais un `OFFSET`. `next: null` signifie « dernière
page », le hook ne rappelle pas l'API dans ce cas. Le hook déduplique à la
concaténation (une notification arrivée entre deux pages décale le curseur et
pourrait se présenter deux fois) et ne garde **qu'une requête en vol**.

### 6.8 La locale du chrome vient du message

`notifications.locale` porte la langue dans laquelle le message a été
**rendu**. L'habillage (note de livraison) se localise depuis cette colonne,
pas depuis la langue du lecteur. La date relative, elle, reste dans la langue
de l'interface — repère de lecture, pas partie du message.

### 6.9 Pas de bouton « signaler »

`reportable`/`report_block` n'expliquent aujourd'hui que l'**absence** du
bouton, jamais une action qu'on peut offrir : déposer un signalement doit
aussi poster un panneau de revue Discord côté bot, cette tâche n'existe pas
encore. `reportBlockReasonKey()` est prêt pour afficher le motif le jour où
c'est utile, mais rien dans le tiroir actuel ne rend de bouton.

### 6.10 Un 404 générique, jamais distingué

Une notification illisible (elle n'existe pas, ou elle n'est pas à
l'utilisateur) doit rendre le même écran — sinon l'API deviendrait un moyen
de sonder si un uuid existe. `getNotification()` est prêt pour une future
page de détail ; aucune page ne l'utilise encore.

## 7. Endpoints branchés vs exposés

| Endpoint | Statut |
|---|---|
| `GET /notifications` | branché (tiroir) |
| `GET /notifications/{id}` | service écrit, pas encore consommé (pas de page de détail) |
| `GET /guilds/{id}/notifications[?service=]` | service écrit, pas encore consommé |
| `GET /guilds/{id}/notifications/inbox` | service écrit, pas encore consommé |

Les deux endpoints serveur correspondent à un futur onglet « Notifications »
dans les réglages d'un serveur (§4 du guide) : « Envoyés » (les mots du
serveur) et « Reçus » (ce que Moddy lui a adressé). Écrire le service sans
la page évite de refaire la normalisation le jour où cet onglet est demandé,
sans ajouter de surface non demandée aujourd'hui.

## 8. Technologies utilisées

React 19, TypeScript strict, react-i18next, Tailwind CSS + shadcn/ui
(Dialog / Drawer / Avatar / Badge / Skeleton / Tooltip), `Intl.RelativeTimeFormat`.

## 9. Décisions prises

- **Le premier document reçu était le mauvais guide** (backend/bot au lieu de
  dashboard) : tout le code de substitution qu'il justifiait a été retiré une
  fois le bon document fourni, plutôt que gardé « au cas où ».
- **Pas de vue « outbox »/« inbox » serveur** pour l'instant : les services
  existent, aucune page ne les appelle — ajouter l'onglet sans qu'il soit
  demandé aurait été hors scope.
- **`criticality` disparaît** : le modèle réel n'a pas de niveau de gravité.
  `accent_color` (déjà résolu par l'API) le remplace.
- **`formatDiscordTimestamps` est importée depuis `lib/welcome-dm.ts`** plutôt
  que recopiée — fonction pure et générique déjà écrite pour un autre module.

## 10. Problèmes rencontrés

- **Mauvais document en entrée** : la première implémentation modélisait un
  contrat de substitution de gabarits qui n'existe pas côté dashboard. Repris
  entièrement une fois le bon guide fourni — vérifié en rejouant l'exemple du
  guide (`normalizeNotification()`) et en confirmant que `kind = 'official'`
  produit bien `source: null`, qu'un lien non-`https://` est éliminé, et
  qu'une valeur d'énumération inconnue dégrade sans planter.
- **`ErrorState` exige un message**, pas un booléen : le hook expose
  `error: string | null` (non nul seulement quand rien n'a pu être affiché).
- **Aucune classe `.discord-markup` n'existe** dans le projet : la mise en
  forme du markdown se fait par variantes Tailwind, alignées sur celles de
  l'aperçu Welcome DM pour que les deux écrans rendent pareil.

## 11. Prochaines étapes suggérées

1. **Onglet serveur « Notifications »** (`getGuildNotifications` /
   `getGuildNotificationsInbox`, déjà écrits) — deux flux, « Envoyés » et
   « Reçus », filtrables par `service`.
2. **Page de détail** (`GET /notifications/{id}`, déjà écrit) si un lien
   direct vers une notification est un jour nécessaire (deep-link depuis un
   mail, par exemple).
3. **Bouton de signalement**, le jour où la tâche correspondante existe côté
   bot.
4. **Suite de tests** (le projet n'a pas de lanceur) sur
   `src/lib/notifications.ts` et `src/services/notifications.ts` — les deux
   sont purs et faciles à tester une fois un runner ajouté.
