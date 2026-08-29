# 2026-08-29 — Brocoli : formulaire de question (`user_question`)

## Objectif

Intégrer les changements de la session backend du 29/08 sur Brocoli. Une seule
chose obligatoire — **le formulaire de question** — et quelques ajustements.
Rien de cassant : tout ce qui existait continue de marcher à l'identique.

## Le point central

**Brocoli ne pose plus aucune question en texte.** Quand il lui manque une
information, il émet `user_question`, puis `run_end` avec un cinquième statut :
`awaiting_answer`. Sans traitement de cet événement, **la conversation se bloque
sans rien afficher** — le tour est fini, aucun texte n'est arrivé, et
l'utilisateur regarde un écran muet. C'est le seul mode d'échec silencieux de
l'intégration, et c'est lui qui dicte presque toutes les décisions ci-dessous.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `src/components/brocoli/brocoli-question.tsx` | Panneau épinglé (formulaire) + trace dans le fil |
| `src/hooks/useCountdown.ts` | Compte à rebours, extrait de `brocoli-action.tsx` et partagé |

## Fichiers modifiés

- `src/types/ai.ts` — `awaiting_answer`, rôle `question` du transcript, types de
  question / réponse, huitième événement SSE, item `question`, `BrocoliRunState`.
- `src/lib/brocoli.ts` — normalisation d'une question, `isQuestionOpen()`,
  **regroupement des lignes `question` du transcript**, trois libellés d'outils.
- `src/services/ai.ts` — `answerQuestion()`, rôle `question` accepté à la relecture.
- `src/hooks/useBrocoli.ts` — événement `user_question`, `awaiting_answer`,
  `answer()`, `markQuestionExpired()`, `answering`.
- `src/pages/BrocoliPage.tsx` — panneau de question épinglé au-dessus de la saisie.
- `src/components/brocoli/brocoli-transcript.tsx` — trace d'une question dans le fil.
- `src/components/brocoli/brocoli-composer.tsx` — troisième verrou de la saisie.
- `src/components/brocoli/brocoli-action.tsx` — utilise `useCountdown` partagé.
- `src/locales/{en,fr}/translation.json` — `brocoli.question.*`,
  `brocoli.composer.awaitingAnswer`, trois outils.

## Décisions

- **`recommended` est présélectionné, pas signalé.** C'est une valeur par
  défaut : Brocoli a lu le serveur avant de demander, et dans la plupart des cas
  il n'y a qu'à valider. Un sélecteur vide alors que `recommended` est renseigné
  ferait perdre le bénéfice de toute la fonctionnalité. `null` → on ne fabrique
  **rien** à sa place. `recommended_label` ne sert que quand l'identifiant est
  introuvable dans les listes du serveur : l'entrée reste alors sélectionnable
  sous son nom lisible plutôt que de retomber sur le placeholder.
- **Un widget natif par `answer_type`** — les vrais sélecteurs de salon et de
  rôle, alimentés par `GuildContext`. Un champ texte de repli annulerait tout
  l'intérêt : la fonctionnalité existe pour éviter de faire recopier un
  snowflake à la main. `multi_select` change le widget (pastilles + ajout, cases
  à cocher), pas la sémantique.
- **`header === ''` → aucune puce.** Le backend le laisse vide *exprès* : une
  puce en français sur une conversation en anglais est pire que pas de puce. On
  ne met surtout pas « Salon » en dur à la place.
- **Le chrome est le seul texte à nous** (« Ignorer », « Envoyer »,
  « Recommandé », le compte à rebours) et il est localisé ; tout ce qui vient de
  l'API est déjà dans la langue de la conversation et n'est jamais reformulé.
- **Le formulaire s'affiche dans les trois modes, `auto` compris.** Le mode ne
  change rien aux questions : le masquer en `auto` laisserait la conversation
  bloquée sans rien afficher.
- **Un bouton « Ignorer »** (`{cancelled: true}`). Sans lui, la seule sortie
  d'une question mal posée est d'y répondre n'importe quoi — et Brocoli
  construirait sa configuration sur cette réponse.
- **`label` / `labels` sont renvoyés** : Brocoli les emploie dans sa phrase
  suivante au lieu de relire les salons. Un champ sans nom lisible (texte libre,
  identifiant inconnu) part sans label plutôt qu'avec un nom inventé.
- **Champ vide = `skipped: true`**, jamais une chaîne vide que Brocoli prendrait
  pour un choix.
- **Panneau épinglé au-dessus de la saisie**, comme la confirmation, et pour la
  même raison : une question en attente bloque la conversation ; laissée dans le
  fil, elle défilerait hors de l'écran dès que Brocoli reprend la parole. Le fil
  n'en garde qu'une trace (`BrocoliQuestionRecord`). `key` sur le `question_id` :
  un nouveau formulaire est un nouveau montage, sans quoi React réutiliserait
  les valeurs présélectionnées du précédent.
- **Verrouillage dès le premier clic.** Le serveur est idempotent, mais un
  double clic ouvrirait deux flux SSE dont le second recevrait `409`.
- **Confirmation ≠ question.** Une confirmation demande la permission d'agir
  (Brocoli sait quoi faire → « Appliquer ») ; une question signale qu'il manque
  une information (→ un formulaire). Les deux ne coexistent pas ; si les deux
  traînaient, la question l'emporte.
- **Une réponse est un nouveau flux SSE**, consommé par le **même** gestionnaire
  d'événements — il peut d'ailleurs s'achever sur une `permission_request`, et
  c'est le cas attendu.

## Rechargement de page : les deux pièges

1. **Une question répondue laisse deux lignes** dans le transcript (`pending`,
   puis `answered` / `cancelled`) — les deux moments sont dans l'historique.
   `itemsFromTranscript()` les regroupe par `question_id` en gardant la **place**
   de la première (l'endroit du fil où elle a été posée) et l'**état** de la
   dernière. Sans ça, la même question s'afficherait deux fois.
2. **La ligne porte `expires_at`** (corrigé côté backend dans la même session,
   commit `f6ccfcf`) : on la compare à l'heure courante avant de reproposer le
   formulaire, sinon son envoi répondrait `409`.

## Dégradations défensives

- `answer_type` inconnu → `choice` s'il y a des options, `text` sinon. Ne
  **jamais** faire disparaître la question : sans widget, la conversation reste
  bloquée sans rien afficher.
- Statut de question inconnu → traité comme **réglé**, pas comme ouvert : une
  valeur nouvelle sera bien plus vraisemblablement un état terminal, et rouvrir
  un formulaire déjà réglé ne mènerait qu'à un `409`.
- Une charge sans `question_id` ni question exploitable est ignorée : mieux vaut
  ne rien afficher qu'un formulaire vide qu'aucun envoi ne pourrait satisfaire.

## Ajustements

- **`run_end`** a cinq statuts ; `awaiting_answer` est traité **explicitement**
  (un `default` qui rend la main à la saisie ferait sortir de l'attente sans
  afficher le formulaire).
- **Trois nouveaux outils libellés** : `ask_user`, `describe_module_config`,
  `list_module_catalogue`.
- **`useCountdown` extrait** de `brocoli-action.tsx` vers `src/hooks/` : deux
  surfaces portent désormais une échéance. Le hook garde une **horloge** en état
  et dérive le décompte — stocker les secondes obligerait à les recalculer dans
  un effet, donc à écrire un état pendant la synchronisation.
- **Codes d'erreur de `/answer`** : identiques à ceux de `/decision`, donc rien
  à ajouter — `409` (déjà répondue, expirée, tour en cours) et `transport`
  déclenchent une relecture de la conversation, jamais un rejeu.

## Ce qui n'a demandé aucun code

- **Les titres arrivent tout seuls** (générés en tâche de fond après le premier
  message). Le repli existait déjà (`brocoli.history.untitled`), aucune UI ne
  pose de titre deviné, et `title` resté `null` **n'est pas une erreur**.
- **`published_in_discord`** et **l'identité de l'interlocuteur** ne remontent
  pas au front : Brocoli le dit en texte.
- **Ce que Brocoli écrit a changé de forme** (plus de JSON ni de schéma, des
  `#salon` / `@rôle` avec les vrais noms) sans changer de contrat : le rendu
  markdown restreint et les pastilles de mention existants les prennent déjà en
  charge, et rien n'est jamais rendu en HTML brut.

## Vérifications

- `tsc -b`, `eslint` sur tout le code touché et `npm run build` : propres (les
  18 erreurs de lint du dépôt sont antérieures, aucune n'a été ajoutée).
- Rendu contrôlé par capture (clair et sombre) sur un banc d'essai temporaire
  monté sur des données fabriquées, sans réseau — supprimé depuis. Vérifié :
  recommandations bien présélectionnées (salon, rôle, option), absence de puce
  sur un `header` vide, et **payload d'envoi** conforme (`value`/`label`,
  `values`/`labels`, `skipped` sur un champ laissé vide).

## Reste à faire

- Les vues serveur de l'historique et les genres `support_*`, inchangés.
- Libellés des champs du diff (déjà noté à la session précédente).
