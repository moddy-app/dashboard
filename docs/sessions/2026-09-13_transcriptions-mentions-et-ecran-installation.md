# 2026-09-13 — Transcriptions (réponses, mentions, clic droit, mobile) et écran d'installation

## Objectif

Cinq demandes, toutes issues de l'usage réel du lecteur d'archives et de l'écran
de bienvenue après installation :

1. ne plus afficher les **réponses** comme des événements système, et exploiter
   les deux clés additives du corps stocké (`pr`, `tg`) décrites dans la PR
   [moddy-app/moddy#401](https://github.com/moddy-app/moddy/pull/401) ;
2. **retravailler l'écran de remerciement** après ajout du bot : non responsive,
   il faisait attendre une confirmation Discord sans intérêt pour l'utilisateur,
   et il était laid ;
3. répondre à : **faut-il être connecté** pour lire une transcription ?
4. **transcription sur téléphone** : la conversation n'occupait que la moitié de
   l'écran ;
5. **mentions** (`<@id>`, rôles, `@everyone`…) rendues correctement, et **clic
   droit** pour copier les identifiants.

Deux demandes se sont ajoutées en cours de route : le **chargement automatique**
des messages précédents au défilement (à la place du bouton « charger les N blocs
précédents »), la suppression de la **barre au logo Moddy** sur la page d'archive,
et une **règle de style** à inscrire dans `CLAUDE.md` (jamais de texte tout en
majuscules).

## Réponse à la question 3 — l'accès sans connexion

**Non, ce n'est pas possible depuis ce dépôt, et ce n'est pas un oubli du
frontend.** `docs/API_ENDPOINTS.md` § `GET /transcripts/{key}` :

> **Autorisation** : l'auteur du ticket (`owner_id`), ou l'équipe du serveur —
> équipe Moddy, administrateur du serveur (session), ou membre dont un rôle est
> administrateur Discord ou porte une permission de tickets dans la config. Tout
> le reste est un **404**.

L'autorisation est calculée **par lecteur**, à partir de la session. Sans session,
le backend ne peut pas distinguer l'auteur du ticket d'un inconnu, et répondrait
404 à tout le monde. Rendre la route publique reviendrait à faire de la `key` un
jeton au porteur : toute personne à qui le lien fuite (un salon public, une
capture d'écran) lirait la conversation, y compris le fil privé de l'équipe.

C'est donc une décision **backend** (`moddy-app/moddy`), hors du périmètre de ce
dépôt. `TranscriptPage` continue de rediriger vers la connexion **en conservant
l'URL courante**, pour revenir sur l'archive et non sur l'accueil.

## Tâches accomplies

### 1. Une réponse n'est pas un événement système

Le regroupement testait `message.system_type` pour décider « ligne système ou
message ». Or ce champ dit seulement « type Discord non-défaut » : une réponse
(`reply`) et les invocations de commande en portent un tout en étant des messages
écrits par quelqu'un. Elles finissaient donc en `Marker` « événement système
(reply) », **sans auteur, sans texte, sans pièces jointes et sans citation**.

`isSystemEvent()` (`src/lib/transcripts.ts`) porte désormais seule cette
distinction, via une liste fermée de types qui restent des messages
(`default`, `reply`, `chat_input_command`, `context_menu_command`).

### 2. Les clés `pr` et `tg` du schéma v1

| Clé stockée | Type front | Usage |
|---|---|---|
| `pr` | `reference_preview: TranscriptReferencePreview \| null` | aperçu autonome du message référencé — réponse **et** `pin_add` |
| `tg` | `system_target: string \| null` | la personne concernée par `recipient_add` / `recipient_remove` |

Trois points portés par le code :

- `{"deleted": true}` est une **réponse**, pas une absence : le message d'origine
  a existé, il n'existait plus à l'export. Rendu en « le message cité a été
  supprimé ».
- L'**absence** de `pr` veut dire que Discord n'a pas su résoudre la référence :
  on retombe sur « le message cité ne fait pas partie de cette archive ».
- Les noms **courts et développés** sont lus (`pr` / `reference_preview`,
  `tg` / `system_target`). Le corps stocké utilise les clés courtes, mais
  l'API dashboard décode et renomme une partie des champs ; deviner laquelle des
  deux formes arrivera coûterait un aperçu silencieusement vide, la double
  lecture coûte une ligne.

`ReplyPreview` suit désormais trois sources par ordre de richesse : le message
monté dans l'archive (citation **cliquable**, on y saute), puis `pr` (citation
statique — la cible n'est pas montée), puis le message d'indisponibilité.
`SystemRow` affiche la cible d'un `recipient_add` via une clé i18n dédiée
(`recipient_add_target`) — « X a ajouté Y » et « X a ajouté quelqu'un » sont deux
phrases, pas une phrase à trou — et cite le message épinglé sous un `pin_add`.

### 3. Mentions Discord

`DiscordMarkup` rend maintenant `<@id>`, `<@&id>`, `<#id>`, `@everyone`, `@here`,
`</commande:id>` et `<t:…>`. Les motifs sont **ajoutés en fin** de l'alternation :
aucune mention ne commence là où une URL commence, l'ordre est donc sans
incidence, et les 14 groupes de capture existants ne sont pas renumérotés.

La résolution suit une règle simple : **un utilisateur est résolu, un rôle et un
salon ne le sont pas.**

- **Utilisateur** — les auteurs de l'archive d'abord (instantané, gratuit), sinon
  `useUserProfile` : `GET /users/{id}/profile`, avec repli sur `GET /users/{id}`
  qui est **public** (donc lisible même par un compte suspendu), cache au niveau
  du module — un id mentionné cent fois n'est résolu qu'une fois par session.
- **Rôle / salon** — aucun endpoint ne les résout hors du contexte d'un serveur
  qu'on administre, et le lecteur d'une archive n'administre pas forcément ce
  serveur. Leur identifiant s'affiche **tel quel** : un nom inventé serait pire.

Tant que la résolution n'a pas abouti (chargement, échec, compte supprimé),
l'identifiant reste affiché — c'est la donnée, et elle est vraie.

### 4. Menus contextuels (clic droit)

Une archive s'ouvre **pour enquêter**, et tout y est rendu sous forme lisible :
l'identifiant, seule donnée stable, n'apparaissait nulle part. Le clic droit est
l'endroit où Discord lui-même le met.

- **Sur un message** : copier le texte, l'identifiant du message, celui de
  l'auteur, du salon, du serveur, et « ouvrir dans Discord » (seulement si
  `channel_id` est connu — `null` sur une archive dont le salon a été supprimé,
  et une URL construite sur un trou mène à une page d'erreur).
- **Sur une pastille de mention** : copier l'identifiant. Pas de menu sur
  `@everyone` / `@here`, qui n'ont rien à copier.
- **Sur un participant** de la colonne de détails : copier son identifiant.

### 5. Chargement automatique en remontant

Le bouton « charger les N blocs précédents » est remplacé par une **sentinelle**
en haut du fil : quand elle entre à l'écran, la tranche suivante se monte, avec un
`Spinner` pendant ce temps.

La visibilité est lue sur `useMessageScrollerVisibility()` — l'échappatoire
prévue par le scroller — plutôt que par un `IntersectionObserver` maison : le
scroller sait déjà ce qui est à l'écran, et c'est lui qui conserve la position
quand des blocs s'insèrent au-dessus (`preserveScrollOnPrepend`).

⚠️ Deux pièges évités : `onReach` est **mémoïsé** (une fonction recréée à chaque
rendu ferait boucler l'effet), et le **nombre restant** fait partie des
dépendances — sans lui, une tranche de blocs trop courts pour repousser la
sentinelle hors de l'écran arrêterait définitivement le chargement.

### 6. Transcription sur téléphone

La conversation n'occupait que la moitié de l'écran parce que tout le reste lui
prenait sa hauteur. Corrections cumulées :

- **la barre au logo Moddy est supprimée** — elle ne portait aucune navigation
  que le bouton retour de la vue n'offre déjà ;
- marges de page resserrées (`px-3 py-3` sous `sm`) ;
- titre et méta compactés : `text-lg`, une ligne tronquée au lieu d'un bloc qui
  passe à la ligne ;
- la recherche **partage la rangée des onglets** au lieu de prendre la sienne ;
- le fil passe **pleine largeur** sous `sm` (`-mx-3`, bordures horizontales et
  coins arrondis en moins) : les marges reprenaient une bande de chaque côté d'un
  écran qui n'en a pas à donner.

### 7. Écran de remerciement après installation

Réécrit. Trois décisions :

- **Il ne fait plus attendre.** `confirmed` ne dit que si la passerelle Discord a
  livré l'événement au bot — un détail interne, de l'ordre de la seconde,
  invisible pour la personne. La pastille « Finalisation… », sa roue de
  chargement et la relecture de `/install/latest` ~3 s plus tard sont retirées
  (du composant **et** du hook) : elles faisaient douter d'un succès qui était
  acquis dès le retour de l'écran d'autorisation. Seul `manageable` garde une
  conséquence visible — le bouton « Configurer ».
- **Il est responsive** : `Dialog` au-dessus de `sm`, `Drawer` en dessous — la
  convention déjà retenue pour la boîte de réception. Une modale centrée sur un
  téléphone poussait ses boutons hors de l'écran.
- **Il propose une suite.** Arriver sur un dashboard vide après avoir ajouté un
  bot, c'est ne pas savoir par où commencer : l'écran nomme trois modules
  (Tickets, Logs, AltGuard) et y mène directement.

### 8. Règle de style : jamais de texte tout en majuscules

Ajoutée à `CLAUDE.md` (§ Styling), et appliquée : les **11 occurrences** de la
classe `uppercase` ont été retirées du site (sidebar, palette ⌘K, page staff, page
de debug, dashboard, lecteur d'archive). Un intitulé se distingue par sa taille,
sa graisse et sa couleur. Un texte capitalisé dans la **donnée** (initiales
d'avatar via `toUpperCase()`) n'est pas concerné : la règle vise la mise en forme.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/lib/discord-mentions.ts` | contexte, résolveurs et `copyId` — la partie **sans rendu** (un module qui exporte composants *et* valeurs casse le rafraîchissement à chaud de Vite) |
| `app/src/components/discord-mention.tsx` | `DiscordMentionProvider`, `MentionPill`, `UserMention` |
| `app/src/components/tickets/message-context-menu.tsx` | `MessageContextMenu`, `UserContextMenu` |
| `app/src/components/ui/spinner.tsx` | composant shadcn ajouté via le CLI |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `app/src/types/transcripts.ts` | `TranscriptReferencePreview`, `reference_preview`, `system_target` |
| `app/src/lib/transcripts.ts` | `normalizeReferencePreview()`, `isSystemEvent()`, normalisation de `pr`/`tg` |
| `app/src/components/discord-markup.tsx` | mentions et horodatages, contexte de rendu passé de haut en bas |
| `app/src/components/tickets/transcript-view.tsx` | provider de mentions, `ReplyPreview` à trois sources, `SystemRow` enrichi, `LoadEarlier`, menus contextuels, mise en page mobile |
| `app/src/pages/TranscriptPage.tsx` | barre au logo supprimée, marges mobiles |
| `app/src/components/install/install-welcome-dialog.tsx` | réécrit (responsive, sans attente, avec démarrage rapide) |
| `app/src/hooks/useInstallWelcome.ts` | suppression de `isChecking` et de la relecture de confirmation |
| `app/src/pages/DashboardPage.tsx` | prop `isChecking` retirée ; `uppercase` retiré |
| `app/src/components/{nav-main,command-menu}.tsx`, `app/src/pages/{StaffPage,DebugPage}.tsx` | `uppercase` retiré |
| `app/src/locales/{en,fr}/translation.json` | `mentions.*`, `transcript.contextMenu.*`, `replyDeleted`, `unknownAuthor`, `recipient_*_target`, `loadingEarlier` ; suppression de `loadEarlier*`, `loadAll`, `install.welcome.{confirmed,pending,pendingHint}` |
| `CLAUDE.md` | règle des majuscules, documentation des transcriptions et de l'écran d'installation |

## Notes de correction

Le CLI shadcn a généré `spinner.tsx` avec `import { cn } from "cn"` (le paquet
npm homonyme présent dans les dépendances) au lieu de l'alias du projet
`@/lib/utils`, et un typage `React.ComponentProps<"svg">` qui entre en conflit
avec le `strokeWidth: number` de `HugeiconsIcon`. Les deux ont été corrigés à la
relecture, comme le prescrit l'étape 7 du skill shadcn.

## Points à trancher (hors périmètre de cette session)

1. **`iconLibrary` incohérent.** `components.json` déclare `hugeicons` — que les
   composants `ui/` utilisent bien — mais les 99 fichiers applicatifs importent
   `lucide-react`, que `CLAUDE.md` documente également. Le code ajouté ici suit
   la convention majoritaire (**lucide** hors de `ui/`). Une bascule complète est
   un chantier à part.
2. **Vocabulaire de `InstallSource` divergent.** `app/src/types/stats.ts` définit
   `topgg | discovery | profile | ads | command | direct`, alors que
   `docs/API_ENDPOINTS.md` (§ `GET /install`) donne
   `topgg | discord | ads | command | direct | outreach`. Conséquence : les liens
   marqués `discovery` ou `profile` tombent côté backend sous `other` et ne sont
   plus comparables, tandis que `discord` et `outreach` sont inatteignables depuis
   le dashboard. À arbitrer (quel document fait foi) avant de toucher à l'énumération —
   la changer déplace des mesures d'acquisition déjà collectées.

## Prochaines étapes suggérées

- Vérifier sur une archive réelle que le backend sert bien `pr` / `tg` (et sous
  quel nom) : la double lecture couvre les deux cas, mais un test grandeur nature
  confirmerait lequel arrive.
- Étendre le clic droit aux autres surfaces qui affichent des identifiants
  (liste des tickets, cases).
- Résoudre les mentions de **salons et de rôles** le jour où la vue est ouverte
  depuis le châssis d'un serveur : `GuildContext` porte déjà les deux listes.
