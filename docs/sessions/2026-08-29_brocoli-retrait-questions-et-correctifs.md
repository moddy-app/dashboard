# 2026-08-29 — Brocoli : retrait des questions structurées, correctifs d'UI

## Objectif

Retirer le formulaire de question livré la veille — le backend a annulé les
questions structurées — et corriger deux défauts remontés à l'usage :
l'en-tête du dashboard qui disparaît en écrivant sur mobile, et les étapes
d'outil qui gardent leur roue de chargement une fois terminées.

## 1. Retrait du formulaire de question

Le backend a annulé les questions structurées quelques heures après les avoir
livrées : plus d'événement `user_question`, plus de statut
`run_end: awaiting_answer`, plus de `POST /ai/conversations/{id}/questions/{qid}/answer`,
plus de rôle `question` dans le transcript, plus d'outil `ask_user`. Le contrat
revient à **sept événements** et **quatre statuts** de `run_end`.

Le formulaire avait été implémenté la veille (commit `bdf9164`, décrit dans
`2026-08-29_brocoli-formulaire-de-question.md`). Il est retiré par un revert de
ce commit, avec trois exceptions rétablies à la main :

- les libellés d'outils `describe_module_config` et `list_module_catalogue`
  **restent** (seul `ask_user` disparaît de `TOOL_META`) ;
- le fichier de session de la #72 est conservé, coiffé d'un avertissement disant
  que son contenu a été retiré : c'est la trace de la décision et de son
  revirement, pas une description du dépôt ;
- `useCountdown` retourne dans `brocoli-action.tsx`. Son extraction vers
  `src/hooks/` n'existait que pour le partager avec le panneau de question ;
  seule la confirmation s'en sert désormais, un fichier pour un seul appelant
  n'a plus de raison d'être.

Ce qui **reste** et qu'il ne faut pas confondre avec ce retrait :
`awaiting_confirmation` et son écran de confirmation. Brocoli ne demande jamais
en texte la permission d'appliquer une modification — l'interface s'en charge ;
il ne demande en texte que *ce qu'il doit faire*. Une question à laquelle il lui
manque une réponse est désormais posée **dans son texte**, le tour se termine en
`completed`, et la personne répond par un message ordinaire : rien de
particulier à afficher.

Le repli d'affichage tant que `title` est `null` était déjà en place
(`brocoli-history.tsx`, `brocoli.history.untitled`), tout comme le rendu des
mentions `#salon` / `@rôle` (`brocoli-mentions.ts` + `mention-chip.tsx`) et le
markdown restreint rendu en nœuds React.

## 2. Libellés d'outils

`bdf9164` avait ajouté trois entrées à `TOOL_META` : seule `ask_user` est
retirée, les deux autres restent — le backend continue de les appeler. Sans
entrée, `toolLabelKey()` retomberait sur `brocoli.tools.default`
(« Travaille… »), ce qui n'est pas faux mais perd l'information.

| Outil | Icône | FR | EN |
|---|---|---|---|
| `describe_module_config` | `FileTextIcon` | Relit la configuration en clair | Re-reading the configuration in plain words |
| `list_module_catalogue` | `LibraryIcon` | Fait le tour de ce qu'il sait configurer | Going through what it can configure |

## 3. La roue de chargement éternelle sur une étape terminée

Deux causes, corrigées ensemble dans `useBrocoli.handleEvent()`.

**a. L'appariement `tool_result` → étape était strict.** L'étape n'était
retrouvée que par égalité de `call_id`. Un `tool_result` sans `call_id`
exploitable — absent, ou différent de celui porté par le `tool_call` — ne
trouvait rien, et l'étape restait sur `running` jusqu'à la fin des temps.
Ajout de deux replis : la **dernière étape encore en cours du même `name`**,
puis la dernière encore en cours tout court. `findLastIndex` n'existe pas dans
la `lib` du projet (ES2022) — la recherche est écrite en boucle arrière.

**b. `run_end` ne scellait que les bulles de texte.** Après une fin de tour plus
rien ne tourne, par construction : une étape encore `running` a perdu son
résultat en route. Elle passe désormais en **`done`**, quatrième état ajouté à
`BrocoliItem` — et non en `ok` : l'étape est *terminée*, son verdict reste
inconnu, et seul `tool_result.ok` peut affirmer l'un ou l'autre. Le rendu suit
sans modification (`brocoli-tool-step.tsx` n'affiche sa coche que sur `ok` et
son avertissement que sur `failed`), l'étape rend donc son icône d'outil sans
verdict.

## 4. L'en-tête du dashboard qui disparaît en écrivant sur mobile

`DashboardPage` bornait son châssis à `h-screen`, c'est-à-dire `100vh` : le
viewport **de mise en page**, qui ne bouge pas quand le clavier logiciel
s'ouvre. Le châssis restait donc plus haut que la zone réellement visible, le
navigateur faisait défiler la page pour amener la saisie au-dessus du clavier,
et l'en-tête — fil d'Ariane et bouton de sidebar — sortait par le haut. Le
`sticky top-0` de l'en-tête n'y peut rien : il est collé à un conteneur qui, lui,
ne défile pas.

Nouveau hook `src/hooks/useViewportHeight.ts` : il publie
`window.visualViewport.height` dans `--app-height` sur `<html>` et suit ses
`resize` / `scroll`. Le châssis vaut `h-[var(--app-height,100dvh)]` — `100dvh`
en repli tant que la mesure n'est pas posée, et sur un navigateur sans
`visualViewport`. Le document occupe alors exactement la zone visible : il n'y a
plus rien à faire défiler, donc plus rien à pousser hors de l'écran.

Le recalage `window.scrollTo(0, 0)` n'a lieu que si le viewport visuel est
décalé **et** non zoomé (`scale <= 1`) : sur une page pincée pour zoomer, le
décalage est voulu et le corriger arracherait la page sous les doigts.

Le pied de `BrocoliPage` passe par ailleurs de `pt-8 pb-4` à
`pt-4 pb-3 sm:pt-8 sm:pb-4` : sur petit écran, ces 3 rem se prenaient
directement sur le fil.

## 5. Textes par défaut des tickets

Le backend rappelle que plusieurs champs sont facultatifs **parce que le bot les
remplit** : message d'accueil et de fermeture d'un ticket, titre, description et
placeholder d'un panneau. Ces défauts sont déjà traduits dans la langue du
serveur et s'améliorent d'une version à l'autre ; un texte écrit à leur place est
figé dans une seule langue.

Le dashboard affichait déjà le **vrai** texte du bot en placeholder (jamais en
valeur — l'écrire en valeur le figerait à la première sauvegarde), mais rien ne
disait *pourquoi* on peut laisser vide. Une phrase partagée
(`modules.tickets.leaveEmptyForDefault`) est désormais ajoutée à la description
des cinq champs concernés, dans `category-dialog.tsx` et `panel-card.tsx`.

## Fichiers modifiés

### Retrait du formulaire de question (revert de `bdf9164`)

- `app/src/components/brocoli/brocoli-question.tsx` — **supprimé**
- `app/src/hooks/useCountdown.ts` — **supprimé** (`useCountdown` réintégré à `brocoli-action.tsx`)
- `app/src/components/brocoli/{brocoli-action,brocoli-composer,brocoli-transcript}.tsx`
- `app/src/{types/ai.ts,services/ai.ts,hooks/useBrocoli.ts,lib/brocoli.ts,pages/BrocoliPage.tsx}`
- `app/src/locales/{en,fr}/translation.json` — arbre `brocoli.question.*` retiré
- `docs/sessions/2026-08-29_brocoli-formulaire-de-question.md` — avertissement en tête

### Le reste

- `app/src/hooks/useViewportHeight.ts` — **créé**
- `app/src/hooks/useBrocoli.ts` — appariement `tool_result`, scellement à `run_end`
- `app/src/types/ai.ts` — état `done` sur l'item `tool`
- `app/src/lib/brocoli.ts` — deux entrées de `TOOL_META`
- `app/src/locales/{en,fr}/translation.json` — deux libellés d'outils
- `app/src/pages/DashboardPage.tsx` — `h-[var(--app-height,100dvh)]` + hook
- `app/src/pages/BrocoliPage.tsx` — pied resserré sur petit écran
- `app/src/components/tickets/{category-dialog,panel-card}.tsx` — mention « laissez vide »
- `app/src/locales/{en,fr}/translation.json` — `modules.tickets.leaveEmptyForDefault`
- `CLAUDE.md` — section Brocoli réécrite (contrat à quatre statuts, pas de questions structurées) + hauteur du châssis mobile + route

## Vérifications

- `npx tsc -b` propre.
- `npm run build` passe.
- `eslint` sur les fichiers touchés : aucune erreur ajoutée (la seule remontée,
  `set-state-in-effect` dans `DashboardPage.tsx:75`, est préexistante et sans
  rapport avec ce travail).
- **Non vérifié à l'écran** : le comportement du clavier logiciel ne se simule
  pas en Chromium headless (`visualViewport` ne se réduit pas), et la page
  Brocoli demande un backend. Le correctif de hauteur repose sur le
  raisonnement ci-dessus, à confirmer sur un appareil réel.

## Prochaines étapes

- Confirmer le correctif de hauteur sur iOS Safari et Chrome Android.
- Libellés des champs du diff (`reaction_count`, `channel_id`… restent bruts) —
  toujours à trancher entre `GET /guilds/{id}/modules/schemas` et une table
  écrite dans les locales.
- Passer les mêmes champs en revue sur les autres modules qui laissent le bot
  écrire (texte d'annonce par défaut, boutons de panneau).
