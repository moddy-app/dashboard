# Session du 2026-08-16 — Refonte de l'écran de suspension

> **Seconde passe (même jour).** Le premier jet inventait sa propre grammaire
> visuelle au lieu de reprendre celle des `cases`, et parlait de « dossiers » à
> des gens qui veulent juste savoir ce qu'on leur reproche. Tout est repris
> ci-dessous à partir de « Seconde passe ».

## Objectif

Reprendre l'écran d'un compte suspendu (`SuspendedScreen`) et le vocabulaire des
sanctions globales : dire « suspension » là où l'UI disait « bannissement »,
donner à l'écran la lisibilité d'une page de statut de compte (façon Discord,
adaptée à nos quatre niveaux), garder la facturation accessible malgré la
suspension, et retirer une affirmation fausse sur le dépôt des appels.

## Tâches accomplies

1. **Vocabulaire** — `violations.action.ban` devient « Suspension » (et
   `restrict` « Limitation »), aligné sur les niveaux `warn` / `limited` /
   `suspended`. Plus aucun « bannissement » dans les sanctions globales.
2. **Échelle de niveaux** (`SanctionScale`) — quatre paliers, du compte sain à
   la suspension, avec la portion parcourue peinte et la suivante éteinte.
   Réutilisée par l'écran de suspension **et** par `/violations`.
3. **Refonte de `SuspendedScreen`** — logotype Moddy, verdict en hero (avatar +
   niveau), échelle, motif retenu, compte à rebours, bloc d'appel, facturation,
   puis le dossier en deux sections repliables (en cours / terminées).
4. **Facturation accessible sous suspension** — section dédiée appelant
   `GET /stripe/subscription` puis `POST /stripe/portal`.
5. **Références de dossier en texte courant** — plus de puce copiable ni de
   monospace (`ReferenceText` remplace `ReferenceChip`).
6. **Correctifs de texte** — suppression de la phrase « les appels se déposent
   sur le site de support », remplacée par le serveur de support ; correction du
   « il y a il y a 5 j » de `violations.list.openedAgo`.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/components/moddy-logo.tsx` | Logotype Moddy (tracés officiels, couleur en `currentColor`) |
| `app/src/components/violations/sanction-scale.tsx` | `SanctionScale` — échelle des quatre niveaux |

## Fichiers modifiés

- `app/src/pages/SuspendedPage.tsx` — refonte complète + section facturation.
- `app/src/pages/ViolationsPage.tsx` — échelle sous le bandeau d'état.
- `app/src/components/violations/violation-badges.tsx` — `ReferenceChip` →
  `ReferenceText`, `EnforcementNotice` gagne `showAppeal`, avertissement premium
  reneutralisé (violet → carte neutre + icône carte bancaire).
- `app/src/components/violations/violation-list.tsx` — références en pied de
  carte, titre sur deux lignes au lieu d'une troncature sèche.
- `app/src/components/violations/violation-detail.tsx` — mêmes références.
- `app/src/lib/sanctions.ts` — `LevelTone.ring` (anneau d'avatar).
- `app/src/locales/{en,fr}/translation.json` — voir ci-dessous.

## Documentation technique

### L'échelle, et pourquoi elle est ici

Un bandeau rouge dit « c'est grave » mais pas « où j'en suis ». `SanctionScale`
répond aux deux questions que se pose quelqu'un qui découvre une sanction : à
quel palier je suis, et qu'est-ce qui vient après. Les paliers franchis sont
peints du ton du niveau courant, les suivants restent gris — on ne met jamais en
avant une aggravation qui n'a pas eu lieu.

Géométrie : quatre colonnes égales, pastilles centrées, donc la piste va du
centre de la première (12,5 %) au centre de la dernière, soit 75 % de large. La
portion peinte vaut `75 % × rang / 3`. C'est la seule façon d'obtenir un
espacement régulier — une piste découpée en segments par cellule décale les
pastilles de bord.

### Facturation d'un compte suspendu

Une sanction ne gèle pas l'argent de quelqu'un : consulter ses factures et
résilier restent possibles. `POST /stripe/portal` n'est bloqué par aucune
sanction, suspension comprise — c'est la **création** d'un paiement
(`create-checkout`) qui est refusée.

`GET /stripe/subscription`, en revanche, ne figure pas dans les exemptions du
niveau « suspendu » listées en tête de `docs/API_ENDPOINTS.md`. Il ne sert donc
qu'à **masquer** la section, et seulement quand il répond et qu'il n'y a rien à
gérer (ni `tier`, ni `stripe_customer_id`). Tant qu'on n'a pas sa réponse — ou
s'il renvoie `403` — la section reste affichée : fermer l'accès au portail sur
la foi d'un endpoint qui n'a peut-être pas le droit de répondre couperait un
accès qui, lui, fonctionne.

### Références de dossier

`WUD2EW` est une référence à citer au support, pas un identifiant à manipuler :
elle se lit au fil du texte (`Réf. WUD2EW, EX7NVJ`), en typographie courante,
sans bouton de copie. Les `cases` de modération gardent le leur — là, l'ID
s'utilise vraiment (recherche, commandes).

### Deux CTA d'appel, un seul bouton

`EnforcementNotice` porte son propre bouton « Faire appel », utile en liste et
en détail. Sur l'écran de suspension il précède immédiatement le bloc d'appel :
`showAppeal={false}` évite deux boutons identiques à trois centimètres l'un de
l'autre. Le compte à rebours donne l'urgence, le bloc d'appel donne la sortie.

### Clés i18n touchées

| Clé | Changement |
|---|---|
| `violations.action.{ban,restrict}` | « Bannissement » → « Suspension », « Restriction » → « Limitation » |
| `violations.reference` | **ajoutée** — `Réf. {{refs}}` |
| `violations.ladder.*` | **ajoutée** — libellés de l'échelle |
| `violations.list.openedAgo` | `Ouverte il y a {{time}}` → `Ouverte {{time}}` (`relativeTime` porte déjà « il y a ») |
| `violations.detail.appealDescription` | pointe le **serveur** de support, plus le site |
| `violations.detail.copyReference` | **supprimée** |
| `violations.suspended.*` | refondue : `headlinePrefix`, `reasonLabel`, `activeRecord`, `pastRecord`, `billing*` ; `appealNote`, `record`, `recordNote` supprimées |

## Notes & décisions

- Le logotype est repris **tel quel** ; seule la couleur bouge, via
  `currentColor` et une classe (`#0046F8` en clair, `#5B8DFF` en sombre — le
  bleu d'origine est illisible sur fond noir).
- Une liste d'infractions vide sur un compte suspendu est une **anomalie de
  chargement**, pas un dossier vierge : l'écran affiche un encart discret au
  lieu du grand vide « aucune infraction ».
- L'avertissement premium du compte à rebours passe du violet à une carte
  neutre : dans un bloc rouge, une troisième teinte brouillait la hiérarchie.

## Prochaines étapes suggérées

- Exempter `GET /stripe/subscription` du blocage « suspendu » côté back-end :
  la section facturation s'affiche sans lui, mais elle ne peut alors pas se
  masquer pour un compte qui n'a jamais rien payé.
- Section « Sanctions » dans `/debug` (toujours en attente).
- Vue staff des infractions (filtres `subject_type` / `subject_id`).

---

# Seconde passe — alignement sur les `cases` et refonte du texte

## Ce qui n'allait pas dans le premier jet

| Problème | Correction |
|---|---|
| Grammaire visuelle inventée (`rounded-2xl`, grosses cartes empilées, médaillons d'icône) là où le dashboard utilise `rounded-xl border bg-card p-4` et des listes `divide-y` | Liste et détail reconstruits sur les gabarits de `case-list.tsx` / `case-detail.tsx` |
| Palette parallèle : `LEVEL_TONE` redéfinissait des rouges et des ambres à côté de `ACTION_TONE` | `LEVEL_TONE` **dérive** de `ACTION_TONE` ; un ton `emerald` a été ajouté à la source commune pour le niveau sain |
| `ActionBadge` dupliquait `ActionChip` (mêmes classes, icône différente) | `GlobalActionChip` réutilise `ACTION_META` (icône) et `actionTone` (couleur) — seul le libellé diffère |
| `EnforcementNotice` codait ses couleurs en dur (`border-red-200 bg-red-50 dark:…`) | Passe par `LEVEL_TONE` |
| Vocabulaire de back-office : « dossier », « case », « portée » | Vocabulaire de l'utilisateur : ce qui lui est reproché, ce que ça change, comment contester |
| Rien ne disait **pourquoi** une sanction existe | Chaque écran renvoie aux Conditions d'utilisation (`TERMS_URL`) |
| Deux cartes rouges empilées sur l'écran de suspension | Le rouge est réservé au bloc « ce qui va se passer » ; le motif est neutre |
| « Appel en cours d'examen » restait affiché sur une sanction levée | `EnforcementNotice` prend `active` et ne rend rien pour une infraction close |
| Souscription verrouillée mais toujours visible (bouton grisé + tooltip) | L'entrée disparaît : sidebar, carte premium, sélecteur de serveur |
| Logo minuscule et page centrée | Logo `h-8`/`h-9`, tout est aligné à gauche |

## Les vues, désormais

**Liste** (`violation-list.tsx`) — un conteneur `divide-y rounded-xl border`,
une ligne par infraction : pastille d'état (`CircleDotIcon` / `CheckCircle2Icon`
comme les cases), motif tronqué, méta ponctuée de points (référence, sujets),
puis chips d'action, pastille de niveau et date relative. Plus aucune carte.

**Détail** (`violation-detail.tsx`) — le gabarit de `CaseDetailView` : barre
retour + référence + pastille d'état, titre pleine largeur, puis deux colonnes.
À gauche ce qui s'applique et le recours, à droite un `Panel` de `PropRow`
(qui est visé, mesures prises, date). Pas de composeur ni d'action d'écriture :
une infraction ne se modifie pas depuis le dashboard.

## Le texte

Le mot « dossier » n'apparaît plus dans l'interface. Une sanction globale
sanctionne un **manquement aux Conditions d'utilisation** ; les trois écrans le
disent et pointent vers `moddy.app/terms`. Le reste suit :

- `ban` → « suspension », `restrict` → « limitation » (déjà fait en 1ʳᵉ passe) ;
- `active` → « en vigueur », `revoked` → « levée » ;
- « faire appel » → « contester », et la contestation est décrite pour ce
  qu'elle est : traitée par un humain sur le **serveur de support**, sans
  suspendre la sanction pendant l'examen ;
- chaque niveau explique ce qu'il change **concrètement** plutôt que de répéter
  son nom (« vous pouvez toujours régler ce qui est déjà en place ; souscrire à
  Max et mettre en service un module jamais configuré vous sont fermés »).

## Souscription sous sanction : on retire, on ne grise pas

Un bouton grisé avec un tooltip est une promesse qu'on retire au dernier
moment. Les trois points d'entrée disparaissent quand le compte est
`restricted` :

- `app-sidebar.tsx` — l'entrée Moddy Max n'est plus rendue… **sauf** si un
  abonnement existe (`tier` ou `stripe_customer_id`), auquel cas elle devient
  « Gérer l'abonnement ». Le test ne peut pas porter sur `is_active` : une
  sanction le fait retomber à `false`, ce qui aurait coupé l'accès à la
  facturation d'un abonné qui paie encore.
- `GuildOverviewPage.tsx` — la carte premium entière disparaît (`canLinkGuild`).
- `settings-dialog.tsx` — le sélecteur « ajouter un serveur » disparaît ;
  l'explication au-dessus reste, et **retirer** un serveur reste permis.

## Fichiers de la seconde passe

- Créé : rien.
- Réécrits : `violation-badges.tsx`, `violation-list.tsx`, `violation-detail.tsx`,
  `ViolationsPage.tsx`, `SuspendedPage.tsx`, bloc `violations.*` des deux locales.
- Modifiés : `lib/cases.ts` (ton `emerald`), `lib/sanctions.ts` (`LEVEL_TONE`
  dérivé, `TERMS_URL`, `globalActionTone`), `app-sidebar.tsx`,
  `GuildOverviewPage.tsx`, `settings-dialog.tsx`.

---

# Troisième passe — hiérarchie et redites

La seconde passe avait la bonne grammaire visuelle mais pas la bonne
**hiérarchie** : tout était au même niveau, et la même information revenait
deux ou trois fois sous des formes différentes.

## Les redites supprimées

| Répétition | Décision |
|---|---|
| Le motif écrit dans une carte « ce qui vous est reproché » **puis** répété en première ligne de « sanctions en cours » | Un seul bloc `ActiveSanction` porte le motif ; la liste en dessous ne montre plus que les sanctions **passées** |
| Ligne de liste portant une chip « Suspension » *et* une pastille « Suspendu » — deux formes pour une seule idée | La ligne ne garde que la pastille de niveau : le niveau **est** le résumé des mesures actives. Le détail par mesure vit dans la vue détail |
| Vue détail : aside « Qui est visé » + « Mesures prises » recopiant la colonne centrale, et une date déjà sous le titre | Aside supprimé. `case-detail` en a un parce qu'il a de quoi le remplir (auteur, portée, groupe, appels) ; une infraction n'a que ses sujets et ses mesures |
| « En vigueur » affiché sur chaque mesure active | `MeasureStatus` ne dit plus rien pour `active` — c'est l'état par défaut. Seuls « levée » et « expirée » méritent un mot |
| Compte à rebours encadré et teinté **à l'intérieur** d'une carte | `EnforcementNotice` gagne `variant="inline"` : dans un panneau, un simple filet et l'icône colorée suffisent |
| `/violations` : bandeau d'état **et** carte d'échelle disant la même chose | Un seul bloc « état du compte » : l'échelle, un filet, le niveau courant et ce qu'il change |
| Note sur le cache de 60 s en pied de page | Supprimée — détail d'implémentation, pas information utilisateur |

## La facturation redescend au pied de page

Ce n'est pas ce qu'on vient chercher sur un écran de suspension : plus de
section, plus de carte, plus de phrase d'explication. Un bouton fantôme
« Gérer la facturation » en pied de page, sous un filet, avec le reste des
utilitaires. La logique de masquage ne change pas.

## L'ordre de lecture

L'écran suit désormais les questions dans l'ordre où on se les pose :

1. **Qu'est-ce qui m'arrive** — le verdict, et l'échelle qui le situe ;
2. **Pourquoi** — le motif, les mesures, la référence, une seule fois ;
3. **Jusqu'à quand** — le compte à rebours, en filet sous le motif ;
4. **Comment le contester** — un bouton principal, un secondaire ;
5. le reste (historique, facturation) en périphérie.

## Détails de finition

- L'échelle est bornée à `max-w-xl` : au-delà, les quatre paliers s'éloignent
  au point qu'on ne lit plus une progression mais quatre étiquettes isolées.
- Le point séparateur des lignes de liste est passé **dans** le conteneur des
  sujets : dehors, il laissait un point orphelin sur mobile, où les sujets
  sont masqués faute de place.
- Un espaceur de 3 rem précède le pied de page pour que `mt-auto` ne colle pas
  le filet à la dernière section quand la page dépasse l'écran.

---

# Quatrième passe — tout ce qui touche aux sanctions globales

Les vues `/violations` étaient propres, mais les **autres** surfaces qui parlent
de sanctions globales ne l'étaient pas — et surtout, le même dossier ne se
lisait pas pareil selon la page.

## Un dossier global se lit pareil partout

Une case `global`/`network` **est** une sanction globale. Elle disait pourtant
« Bannir » dans les vues `cases` et « Suspension » sur `/violations`, en violet
d'un côté et en rouge de l'autre. Deux fonctions dans `lib/cases.ts` règlent ça
à la source, pour tout le dashboard :

| Helper | Rôle |
|---|---|
| `isGlobalCaseType(type)` | `global` ou `network` = sanction globale |
| `actionLabelKey(action, caseType)` | `violations.action.*` sur un dossier global, `cases.action.*` sinon |
| `actionAppearance(action, caseType)` | ton + icône **du niveau** sur un dossier global (limitation orange comme « limité »), de l'action sinon |

`ActionChip` les consomme : la portée du dossier suffit, aucun appelant n'a de
couleur à choisir. `case-list`, `case-detail`, `sanctions-panel` et
`case-timeline` reçoivent désormais le `caseType`, et `GlobalActionChip` n'est
plus qu'`ActionChip` figée sur `global`.

`SANCTION_LEVEL_HUE` / `SANCTION_LEVEL_ICON` vivent maintenant dans
`lib/cases.ts` : `LEVEL_TONE` (`lib/sanctions.ts`) **et** `ActionChip` en
dépendent, et devaient s'accorder au pixel. Une seule source, donc jamais une
« limitation » violette à côté d'un « limité » orange.

## Un groupe peut mélanger les niveaux

Un avertissement au compte, une limitation sur un serveur, une suspension sur un
autre : `group.level` n'est qu'un **résumé** (le plus sévère), jamais ce qui
s'applique à un sujet donné.

- `levelFromActions()` déduit le niveau d'un jeu de mesures ;
- la vue détail affiche le niveau **de chaque sujet**, calculé sur ses propres
  mesures actives — c'est là qu'on voit qui prend quoi ;
- l'écran de suspension n'affiche plus les actions agrégées du groupe mais les
  mesures visant **le compte** (`/violations/status`, filtrées par `group_id`),
  plus une ligne « cette infraction vise aussi N de vos serveurs ».

## Qui, quoi, par qui

- La ligne de liste annonce ses sujets : `WUD2EW · Vise votre compte, Serveur A`
  — une énumération étiquetée, pas une rangée d'avatars muets.
- Son propre compte se dit « votre compte », jamais son pseudo : sur une page
  qui parle de vous, votre nom d'utilisateur est la façon la moins claire de
  vous désigner.
- La vue détail dit **par qui** : « Prononcée par l'équipe Moddy », ou l'auteur
  nommé quand l'API le fournit (`issuer_type`/`issuer_id`).

## Composants partagés au lieu de copies

| Avant | Après |
|---|---|
| `GuildSelectionView` : deux badges rouge/orange écrits à la main | `LevelPill size="xs"`, et seulement si `restricted` — un `warn` ne verrouille rien, l'annoncer serait une alerte pour rien |
| `team-switcher` : `BanIcon`/`ShieldMinusIcon` colorés en dur | `LevelDot`, le point de `LEVEL_TONE` |
| `GuildOverviewPage` : badge « verrouillé » en orange codé en dur | tons de `LEVEL_TONE.limited` |
| `settings-dialog` : `text-orange-600` | idem |
| `SanctionNotice` : références en `font-mono` | `ReferenceText`, comme partout ailleurs |

## Références sans préfixe

`Réf. WUD2EW` devient `WUD2EW`. Le code se reconnaît seul ; l'annoncer allonge
la ligne sans rien apprendre. La clé `violations.reference` disparaît.
