# Session du 2026-08-16 — Refonte de l'écran de suspension

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
résilier doivent rester possibles. La section appelle `GET /stripe/subscription`
puis, au clic, `POST /stripe/portal`.

> ⚠️ **Dépendance back-end.** `docs/API_ENDPOINTS.md` exempte explicitement
> `/stripe/portal` du niveau **limité**, mais le niveau **suspendu** bloque
> « tous les endpoints authentifiés » sauf `/auth/me`, `/auth/refresh`,
> `/auth/logout`, les lectures `/cases` et `/violations`. Tant que ces deux
> routes ne sont pas ajoutées à cette liste, l'appel renvoie `403` : la section
> se **masque alors silencieusement** plutôt que d'afficher une porte fermée.
> Rien à changer côté front une fois l'exemption posée.

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

- Exempter `/stripe/subscription` et `/stripe/portal` du blocage « suspendu »
  côté back-end (sans quoi la section facturation reste invisible).
- Section « Sanctions » dans `/debug` (toujours en attente).
- Vue staff des infractions (filtres `subject_type` / `subject_id`).
