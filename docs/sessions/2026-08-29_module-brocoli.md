# 2026-08-29 — Module Brocoli (assistant IA)

## Objectif

Intégrer **Brocoli**, l'assistant IA conversationnel du backend, au dashboard :
consommer le flux SSE, afficher les demandes de confirmation, gérer les trois
modes et traiter chaque code d'erreur. Route `/servers/:guildId/brocoli`.

## Le piège central : `EventSource` ne convient pas

Les deux endpoints de tour (`POST …/messages` et `POST …/decision`) sont des
`POST` avec corps JSON qui répondent en `text/event-stream`. `EventSource` ne
sait faire que des `GET` sans corps : le client SSE est donc écrit à la main sur
`fetch` + `ReadableStream` (`src/lib/ai-stream.ts`), avec **report du tampon
incomplet** (`splitSseChunks`) — un événement peut être coupé entre deux paquets
réseau, et sans ce report on perd des fragments au hasard.

Corollaire : **aucune reconnexion automatique**, et **aucun rejeu** d'un
`POST /messages` en échec — le message a peut-être été enregistré et le tour
lancé. Une coupure se répare par `GET /ai/conversations/{id}`.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `src/types/ai.ts` | Types de l'API, des 7 événements SSE et de la timeline affichée |
| `src/lib/ai-stream.ts` | Client SSE (`streamPost`, `AiStreamError`, `splitSseChunks`) |
| `src/lib/brocoli.ts` | Normalisation défensive, libellés d'outils, risque, valeurs de diff |
| `src/lib/brocoli-mentions.ts` | Mentions `#salon` / `@rôle` : listes, résolution, détection du jeton |
| `src/services/ai.ts` | Les 7 endpoints (`/ai/status`, conversations, messages, décision) |
| `src/hooks/useAiStatus.ts` | Statut + quota, cache de session partagé entre abonnés |
| `src/hooks/useBrocoli.ts` | Machine à états d'une conversation |
| `src/components/brocoli/brocoli-transcript.tsx` | Fil (`MessageScroller` + `Message` + `Bubble` + `Marker`) |
| `src/components/brocoli/brocoli-action.tsx` | Panneau de confirmation épinglé + trace dans le fil |
| `src/components/brocoli/brocoli-diff.tsx` | Tableau de diff |
| `src/components/brocoli/brocoli-composer.tsx` | Saisie + autocomplétion des mentions |
| `src/components/brocoli/brocoli-mode-select.tsx` | Sélecteur de mode |
| `src/components/brocoli/brocoli-tool-step.tsx` | Étape d'outil (`Marker` + `shimmer`) |
| `src/components/brocoli/brocoli-markdown.tsx` | Markdown restreint, rendu en nœuds React |
| `src/components/brocoli/mention-chip.tsx` | Pastille d'une mention reconnue |
| `src/components/brocoli/brocoli-history.tsx` | Historique des conversations du serveur |
| `src/pages/BrocoliPage.tsx` | La page |

## Fichiers modifiés

- `src/lib/auth.ts` — `API_BASE`, `parseApiJson()` et `redirectToLogin()` exportés
  et **partagés** avec le client SSE (les snowflakes du flux dépassent 2^53 et
  seraient arrondis par un `JSON.parse` nu). `api()` s'appuie désormais dessus.
- `src/main.tsx` — route `servers/:guildId/brocoli`.
- `src/components/app-sidebar.tsx`, `src/components/command-menu.tsx` — entrées
  **masquées** quand `GET /ai/status` répond `enabled: false`.
- `src/pages/DashboardPage.tsx` — fil d'Ariane.
- `src/locales/{en,fr}/translation.json` — arbre `brocoli.*` + `common.cancel` /
  `common.dismiss` + entrées du menu de commandes.
- `src/index.css` — **cinq utilitaires manquants** (voir plus bas).
- `src/components/ui/message-scroller.tsx` — **correction d'un bug** (voir plus bas).

## Deux bugs silencieux corrigés dans le socle shadcn

1. **`message-scroller.tsx` : `inset-s-1/2` n'existe pas** dans l'API Tailwind v4
   (l'utilitaire logique est `start-*`). La classe était ignorée sans erreur et
   le bouton « revenir en bas » se collait au **bord gauche** du fil. Corrigé en
   `start-1/2`, vérifié par capture (centré à 640 px sur un viewport de 1280).
2. **Quatre utilitaires référencés mais non définis** — `scroll-fade-b`,
   `scrollbar-thin`, `scrollbar-gutter-stable`, `scrollbar-thumb-transparent`.
   Une classe inconnue est ignorée *silencieusement* par Tailwind : le viewport
   gardait une barre pleine largeur et perdait son dégradé de bas. Définis dans
   `index.css`, plus un `shimmer` pour les textes « en cours ». `scroll-fade-b`
   n'applique son masque que sous `[data-scrollable~="end"]` : appliqué en
   permanence, il estomperait la dernière ligne d'une conversation lue au bout.

## Décisions d'interface

- **Le panneau de confirmation est épinglé au-dessus de la saisie**, pas dans le
  fil. Une confirmation en attente bloque la conversation : laissée dans le
  transcript, elle défilerait hors de l'écran dès que Brocoli continue à écrire.
  Le fil n'en garde qu'une **trace** compacte (`BrocoliActionRecord`).
- **Le risque se lit sur un `Badge` en variante stock** (`outline` → `secondary`
  → `destructive`), sans aplat, sans filet d'accent, sans majuscules : la
  hiérarchie du design system porte à elle seule les trois niveaux exigés par le
  guide. `critical` ajoute une bordure et un **geste délibéré** (saisie du mot
  « confirmer ») — ces actions restent confirmées même en mode `auto`.
- **`preview.valid === false` grise « Appliquer »** et affiche `preview.errors` :
  laisser cliquer produirait un échec incompréhensible.
- **`diff` absent → on le dit.** Certaines actions (facturation, sanctions) ne se
  prévisualisent pas : mieux vaut « pas de détail disponible » qu'un aperçu
  fabriqué à partir de `kind` sur une action irréversible.
- **Les valeurs du diff sont résolues, jamais devinées.** Un snowflake connu
  devient `#best-of` / `@Modérateur` (listes déjà chargées par `GuildContext`),
  un booléen devient « Activé » / « Désactivé ». Un identifiant **inconnu reste
  affiché tel quel**.
- **Le `path` du diff reste brut.** C'est le nom réel du réglage, celui de la
  page du module. Aucune source de libellés lisibles n'existe côté front
  aujourd'hui — voir « Reste à faire ».
- **Mentions `#salon` / `@rôle`** : autocomplétion dans la saisie, pastilles au
  rendu. On insère le **nom** (`#best-of`), pas `<#123>` : Brocoli lit du texte
  et résout lui-même avec `list_channels` / `list_roles`. Il n'existe **aucun
  endpoint de liste de membres**, donc `@` complète les rôles ; un pseudo écrit à
  la main reste résoluble par l'outil `lookup_member` du bot.
- **Le texte de Brocoli n'est jamais rendu en HTML brut** : markdown restreint
  parsé en nœuds React (`brocoli-markdown.tsx`), aucune injection possible même
  si le contenu cite des pseudos hostiles.
- **Avatar de Brocoli désactivé temporairement** (bloc conservé en commentaire
  dans `brocoli-transcript.tsx`, avec `ASSISTANT_INDENT` à repasser à `ps-10`
  quand il revient). L'avatar de l'utilisateur, lui, est conservé.

## Traitement des erreurs

Toutes arrivent **avant** le flux, en JSON. `403` et `404` **ferment** la
conversation (fin de conversation, pas erreur passagère) ; `409` est distingué
selon son message (tour en cours *vs* action déjà traitée/expirée) et se répare
en relisant l'état, jamais en réessayant en boucle ; `429` lit `Retry-After` ;
`503` renvoie sur un écran dédié. **Le message du backend fait foi** quand il en
porte un — sur un `429` il précise *quel* quota a sauté, le réécrire perdrait
cette information. Sur les refus arrivés avant le flux (`422`, `429`, `409`), le
texte est **restitué à la saisie** ; sur les autres il est déjà au transcript.

## Vérifications

- `tsc -b` et `eslint` propres sur tout le code ajouté (le dépôt avait déjà
  18 erreurs de lint préexistantes, aucune n'a été ajoutée).
- `npm run build` passe.
- Rendu vérifié par captures (clair et sombre, en français) sur un banc d'essai
  temporaire monté sur des données fabriquées, sans réseau — supprimé depuis.
  Styles calculés contrôlés : colonne de lecture à 816 px centrée, masque de
  fondu conditionnel actif, barre de défilement fine, gouttière stable.

## Reste à faire

- **Libellés des champs du diff.** `reaction_count`, `channel_id`… restent bruts.
  Deux sources possibles, à trancher : `GET /guilds/{id}/modules/schemas`
  (titres générés par Pydantic, donc en anglais et seulement utiles si les
  modèles du bot déclarent des `description`), ou une table de libellés écrite
  dans les locales, par module et par chemin. Rien n'a été inventé en attendant.
- Genres `support_user` / `support_staff` : le contrat HTTP est identique, seule
  la création de conversation change.
- Titre de conversation : `PATCH` est branché côté service, aucune UI ne l'utilise.
