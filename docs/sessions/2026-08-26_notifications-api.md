# Notifications — branchement sur l'API

**Date** : 2026-08-26
**Objectif** : rendre fonctionnel le système de notifications du dashboard, jusqu'ici alimenté par un tableau de données factices, en l'alignant sur le guide d'intégration backend du bot (« Notifications — backend implementation guide »).

---

## 1. Point de départ

Le tiroir de notifications existait mais était une maquette :

- `app/src/types/notification.ts` — un modèle inventé (`criticality`, `sender`, `expiresAt`, `actions[]`) sans rapport avec le système réel ;
- `app/src/data/notifications.ts` — cinq notifications écrites en dur (« Maintenance programmée », « TrollMaster#9876 »…) ;
- `DashboardPage` tenait l'état en `useState`, le « lu » ne survivait pas à un rechargement.

Le système réel est **centralisé et partagé avec le bot** : quatre tables PostgreSQL (`notification_contents`, `notifications`, `notification_deliveries`, `notification_reports`) dont le bot est propriétaire. Le dashboard n'y écrit rien — il lit.

## 2. Tâches accomplies

1. Modèle de données aligné sur le contrat réel (les huit clés du payload uniforme, `kind` / `author` / `platform` / `status`, l'origine, la livraison).
2. Implémentation de l'algorithme de substitution des placeholders, **au caractère près** comme le bot.
3. Rendu du contenu : émojis custom → URL CDN, `accent_color` entier → hex, syntaxe Discord dégradée en texte, markdown rendu par `DiscordMarkup`.
4. Service de lecture avec pagination keyset et normalisation tolérante (contenu résolu **ou** gabarit brut).
5. État de lecture local (`localStorage`), faute d'accusé de réception côté API.
6. Réécriture du tiroir : origine, corps, sections, liens, pied, état de livraison Discord, chargement paginé, erreurs, squelettes.
7. Pastille de non-lues dans le menu utilisateur.
8. Suppression des données factices et de l'ancien modèle.
9. i18n complète (en + fr), registre des services inclus.

## 3. Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/types/notifications.ts` | Types du système : gabarit, contenu résolu, origine, livraison, page |
| `app/src/lib/notifications.ts` | Fonctions **pures** de rendu : `substitute`, `stripCustomEmojis`, `customEmojiUrl`, `accentColorToHex`, `isSafeNotificationUrl`, `renderTemplate`, `notificationOrigin`, `degradeDiscordSyntax`, `isReportable` |
| `app/src/lib/notification-read-state.ts` | Lu/non-lu côté navigateur (`moddy_notifications_read`) |
| `app/src/services/notifications.ts` | `GET /notifications` + normalisation des deux formes de réponse |
| `app/src/hooks/useNotifications.ts` | Chargement, pagination, rafraîchissement, marquage |

## 4. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/components/notification-drawer.tsx` | Réécrit sur le nouveau modèle |
| `app/src/pages/DashboardPage.tsx` | `useNotifications()` remplace l'état local et les données d'exemple |
| `app/src/components/app-sidebar.tsx` | Passe `unreadNotifications` à `NavUser` |
| `app/src/components/nav-user.tsx` | Pastille de non-lues sur l'entrée « Notifications » |
| `app/src/locales/{en,fr}/translation.json` | Bloc `notifications` : origine, mentions, livraison, registre des services ; `criticality` retiré |
| `CLAUDE.md` | Section « Notifications » + inventaire des fichiers |

## 5. Fichiers supprimés

- `app/src/data/notifications.ts` (données factices)
- `app/src/types/notification.ts` (modèle inventé — remplacé par `types/notifications.ts`, au pluriel)

## 6. Documentation technique

### 6.1 Le contenu stocké est un gabarit

C'est le fait qui explique tout le reste. `notification_contents.payload` porte encore
`{user}`, `{server}`, `{reason}` : dix mille membres recevant le même message de
bienvenue partagent **une** ligne de contenu, et chaque `notifications.variables`
dit ce qui a été substitué pour une personne. Le rendu est à la charge de la
surface qui affiche.

L'API *devrait* servir du contenu déjà résolu. Si elle laisse passer le `payload`
brut (c'est ce que renvoie la requête de lecture du guide, §8.2),
`normalizeContent()` applique l'algorithme lui-même : un écran plein
d'`{accolades}` n'est jamais acceptable.

### 6.2 La substitution, règle par règle

`substitute()` doit correspondre **au caractère près** à celle du bot — sinon un
membre du staff comparant le DM Discord et la carte du dashboard trouve deux
messages différents.

- Motif `\{([a-zA-Z0-9_]+)\}` : ni tiret, ni espace, ni point.
- Clé **absente** → le placeholder reste **visible**, accolades comprises. C'est
  ainsi qu'un gabarit cassé se remarque ; le blanchir cacherait le bug.
- Valeur `null` → chaîne vide.
- Sémantique de `str()` en Python (`True`, pas `true`) : `variables` est du JSONB,
  le jour où un appelant passe un booléen, un `String(v)` naïf diverge en silence.
- Aucune récursion, et jamais un moteur de template qui jette sur une accolade
  orpheline — ce texte est arbitraire.

Appliquée à `title`, `body`, chaque section, chaque lien et `footer`. **Jamais** à
`icon`, `accent_color` ni `template_id`.

Les 29 vecteurs de test du guide (§18 : substitution, émojis, couleur, rendu
complet) ont été vérifiés un par un contre cette implémentation — tous passent.
Le projet n'a pas de lanceur de tests (pas de vitest), donc ils n'ont pas été
committés en suite : ce serait la première chose à ajouter le jour où un runner
existe, `src/lib/notifications.ts` étant entièrement pur.

### 6.3 Le texte n'est pas de confiance

Le corps d'un message de bienvenue ou d'une raison de sanction a été **tapé par
un admin de serveur**. Deux conséquences dans le code :

- rendu par `DiscordMarkup` (parseur contrôlé, déjà utilisé pour les bios),
  jamais par `dangerouslySetInnerHTML` ;
- les `links[].url` sont écartées si elles ne sont pas `https://` **ou** si elles
  portent encore un placeholder (`https://…/{guild_id}` d'un gabarit cassé), et
  rendues avec `rel="noopener noreferrer"`.

### 6.4 La syntaxe propre à Discord dégrade

`<@123>`, `<@&123>`, `<#123>`, `<t:1700000000:R>` ne veulent rien dire hors du
client Discord. `degradeDiscordSyntax()` les remplace par du texte :

- les horodatages passent par `formatDiscordTimestamps()` (déjà écrit pour
  l'aperçu du module Welcome DM — fonction pure, `now` en paramètre) ;
- **une seule** mention est résolue : celle du lecteur. C'est la seule identité
  disponible sans requête, et de très loin la plus fréquente (un message de
  bienvenue s'adresse à la personne qui le lit). Le reste tombe sur un libellé
  générique (« @utilisateur », « #salon »), traduit.

### 6.5 L'origine, comme dans Discord

Trois cas, dans cet ordre (§6.4 du guide) :

| État de la ligne | Ce qui s'affiche |
|---|---|
| `source_guild_id` présent | icône + nom du serveur + coche de vérification, lien vers `discord.com/channels/<id>` |
| pas de serveur, `source_service` présent | le libellé du service |
| `kind = 'official'` | **rien** — Moddy institution n'a pas de tiers à nommer |

Le registre des services est **ouvert** : un id inconnu se dégrade en « Moddy »,
jamais en clé i18n nue ni en erreur. Même règle pour `kind`, `author` et
`status` — le bot livre de nouveaux expéditeurs sans coordonner un déploiement.

### 6.6 `platforms` est une intention, la livraison est un fait

Le bot écrit une ligne `pending` par plateforme visée puis ne touche plus que
celle de Discord. Un `discord_status` à `failed` ou `skipped` est **affiché** :
« Moddy n'a pas pu vous envoyer ce message sur Discord ». C'est exactement ce qui
justifie une boîte de réception sur le dashboard — un membre qui a fermé ses DM
lit ici ce qu'il n'a pas reçu là-bas.

### 6.7 Lu / non-lu : local, et assumé comme tel

Le guide interdit d'ajouter une colonne aux quatre tables, et il n'existe aucun
endpoint d'accusé de lecture. L'état vit donc dans `localStorage`
(`moddy_notifications_read`) :

```jsonc
{ "readBefore": "2026-08-26T18:00:00.000Z", "ids": ["uuid", "…"] }
```

« Tout marquer comme lu » pose une **borne temporelle** plutôt que d'énumérer les
ids : les pages pas encore chargées sont couvertes elles aussi. Les ids marqués
un par un sont plafonnés à 300 (`readBefore` couvre le reste). Toute lecture et
toute écriture sont enveloppées : en navigation privée ou quota plein, la boîte
reste lisible, simplement sans état de lecture.

C'est un confort d'affichage, pas une donnée de référence — il ne suit pas
l'utilisateur d'un appareil à l'autre, et c'est acceptable.

### 6.8 Pagination

Keyset (`?limit=25&before=<created_at>,<uuid>`), jamais d'`OFFSET` :
l'index `(recipient_id, created_at DESC)` rend la requête constante à n'importe
quelle profondeur. Le hook déduplique à la concaténation (une notification
arrivée entre deux pages décale le curseur et pourrait se présenter deux fois) et
ne garde **qu'une requête en vol** — deux réponses concurrentes ne se marchent
pas dessus.

### 6.9 La locale du chrome vient du message

`notifications.locale` porte la langue dans laquelle le message a été **rendu**.
L'habillage (libellé du service, note de livraison) se localise depuis cette
colonne, pas depuis la langue du lecteur : rendre l'habillage en anglais autour
d'un corps français est précisément l'erreur que cette colonne existe pour
éviter. La date relative, elle, reste dans la langue de l'interface — c'est un
repère de lecture, pas une partie du message.

### 6.10 Pas de bouton « signaler »

`reportable` est **gelé à l'envoi** et ne se recalcule ni ne s'élargit. Mais
déposer un signalement ne se réduit pas à un `INSERT` : ça publie aussi le
panneau de revue dans Discord et le journalise, deux choses côté bot. Le type de
tâche correspondant n'existe pas encore. Tant qu'il n'existe pas, `reportable`
est une information qu'on affiche, pas une action qu'on offre — un bouton mort
serait pire que pas de bouton.

## 7. Ce que le back-end doit exposer

Le dashboard appelle un seul endpoint, dans la forme suggérée par le guide (§12) :

```
GET /notifications?limit=25&before=<created_at>,<uuid>
→ { "items": [ … ], "next": { "before": "<created_at>,<uuid>" } }
```

Le service accepte deux formes de réponse, pour ne pas bloquer sur l'ordre
d'arrivée des deux côtés :

1. **La forme du guide** — `content` déjà résolu, `source` hydraté
   (`guild_name`, `verified`…), `delivery` indexé par plateforme. C'est celle à
   viser : seul le back-end peut nommer un serveur dont l'utilisateur n'est pas
   membre.
2. **La forme brute** — les colonnes de la requête de lecture (§8.2) :
   `payload`, `variables`, `source_service`, `source_guild_id`,
   `discord_status`. Le dashboard rend alors lui-même.

Dans les deux cas : snowflakes en **chaînes** (le parseur de `lib/auth.ts` s'en
charge déjà à la lecture), timestamps ISO-8601 UTC, et `404` plutôt que `403`
pour une notification que la session ne peut pas lire — sinon l'endpoint sert à
savoir si un uuid existe.

## 8. Technologies utilisées

React 19, TypeScript strict, react-i18next, Tailwind CSS + shadcn/ui
(Dialog / Drawer / Avatar / Badge / Skeleton / Tooltip), `Intl.RelativeTimeFormat`.

## 9. Décisions prises

- **Pas de suite de tests committée** : le projet n'a pas de lanceur. Les vecteurs
  du guide ont été vérifiés hors dépôt (tous verts) ; les fonctions sont pures et
  prêtes à être testées le jour où un runner est ajouté.
- **La vue « outbox » d'un serveur n'est pas implémentée.** Elle est légitime
  (ce sont les mots du serveur, §8.3) mais c'est un écran à part entière, pas le
  tiroir ; l'écrire aurait ajouté du code sans surface pour l'afficher.
- **`criticality` disparaît** : le modèle réel n'a pas de niveau de gravité.
  `accent_color` le remplace — et il vient de la ligne, pas d'un choix du
  dashboard.
- **`formatDiscordTimestamps` est importée depuis `lib/welcome-dm.ts`** plutôt
  que recopiée. C'est une fonction pure et générique ; la dupliquer aurait créé
  deux rendus d'horodatage à maintenir.

## 10. Problèmes rencontrés

- **`ErrorState` exige un message**, pas un booléen : le hook expose désormais
  `error: string | null` (non nul seulement quand rien n'a pu être affiché — un
  échec de page 2 ne doit pas effacer la page 1).
- **Regex globale et `lastIndex`** : `PLACEHOLDER.test(url)` sur une `RegExp`
  globale déplace son `lastIndex` et fausse l'appel suivant. Une seconde regex
  non globale sert aux tests d'existence.
- **Aucune classe `.discord-markup` n'existe** dans le projet : la mise en forme
  du markdown se fait par variantes Tailwind, alignées sur celles de l'aperçu
  Welcome DM pour que les deux écrans rendent pareil.

## 11. Prochaines étapes suggérées

1. **Confirmer la forme de `GET /notifications`** avec le back-end et, une fois
   figée, retirer la branche de normalisation devenue inutile.
2. **Vue « outbox » serveur** (`GET /guilds/:id/notifications`, Manage Server) —
   « ce que Moddy a envoyé en notre nom ».
3. **Bouton de signalement**, le jour où la tâche `notification_report` existe
   côté bot.
4. **Suite de tests** (vitest) sur `src/lib/notifications.ts`, avec les vecteurs
   du guide §18.
5. **Surface staff** : hydratation complète d'une notification par uuid,
   signalements ouverts, état d'une campagne (`batch_id`) — en gardant
   `actor_id` et les motifs de signalement hors des surfaces non-staff.
