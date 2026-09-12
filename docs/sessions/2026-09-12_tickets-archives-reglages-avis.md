# 2026-09-12 — Tickets : réglages, archives de conversation et avis

## Objectif

Brancher les trois pans du module Tickets livrés côté backend par
[website-backend#88](https://github.com/moddy-app/website-backend/pull/88) :

1. les **réglages du module** (`settings`), qui n'ont pas d'endpoint dédié ;
2. les **archives de conversation** (listing + lecteur complet sur un lien
   public `dashboard.moddy.app/transcripts/<uuid>`) ;
3. les **avis** laissés par les auteurs de tickets (liste + agrégats).

Plus la dixième permission de catégorie, `stats`.

## Tâches accomplies

- Permission `stats` ajoutée à l'énumération et à l'éditeur de permissions.
- Réglages (`log_channel_id`, `transcripts_enabled`, `transcript_retention_days`,
  `closure_detection_enabled`, `rating_enabled`) lus, validés, écrits sous
  `settings`, avec confirmation explicite avant toute **baisse de rétention**.
- Onglet **Archives** : filtres (catégorie, numéro de ticket, auteur),
  pagination, explication d'un listing vide à partir des `settings` servis avec
  la liste.
- **Lecteur d'archive** complet (route hors du châssis), rendu Discord intégral :
  markdown, embeds riches, Components V2, médias, autocollants, réactions,
  réponses, messages système, spoilers.
- Onglet **Avis** : résumé du serveur (volume, moyenne, distribution, négatifs),
  tableau par agent, liste filtrable avec lien vers l'archive.
- Traductions EN + FR (≈170 clés par langue).

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/types/transcripts.ts` | Types des archives, des composants Discord et des avis |
| `app/src/lib/transcripts.ts` | Normalisation, regroupement des messages, recherche, erreurs |
| `app/src/components/tickets/settings-panel.tsx` | Formulaire des réglages du module |
| `app/src/components/tickets/transcript-list.tsx` | Listing des archives |
| `app/src/components/tickets/transcript-view.tsx` | Lecteur d'archive (fil + colonne de détails) |
| `app/src/components/tickets/discord-message.tsx` | Rendu d'un message Discord archivé |
| `app/src/components/tickets/ratings-panel.tsx` | Avis : résumé, par agent, liste |
| `app/src/pages/TranscriptPage.tsx` | Page `/transcripts/:key` |

## Fichiers modifiés

- `app/src/types/api.ts` — `stats`, `TicketsSettings`, défauts, bornes de rétention,
  `TicketsConfig.settings`.
- `app/src/lib/tickets.ts` — `normalizeTicketsSettings()`, `serializeTicketsConfig(panels, settings)`,
  `retentionShrinks()`, `settingsFieldKey()`, validation des réglages, mapping des
  422 sur `settings.*`.
- `app/src/services/tickets.ts` — `getTicketTranscripts()`, `getTranscript()`,
  `getTicketRatings()`, `getTicketRatingsSummary()`.
- `app/src/pages/modules/TicketsPage.tsx` — brouillon des réglages, cinq onglets,
  confirmation de rétention.
- `app/src/main.tsx` — route `/transcripts/:key`.
- `app/src/locales/{en,fr}/translation.json`, `CLAUDE.md`.

## Décisions techniques

### Les réglages passent par le `PUT` du module

Il n'existe aucun endpoint dédié : `settings` est une clé de la config, et
`PUT`/`PATCH` **remplacent tout l'objet**. Omettre `settings` les remettrait aux
défauts — archivage réactivé, rétention illimitée, journal perdu. Le formulaire
n'a donc pas de bouton propre : c'est la barre « enregistrer » de la page qui
écrit, une fois, l'objet entier.

Le bot accepte encore ces cinq clés **à plat à la racine** : on lit les deux
formes (`settings` gagne, comme le backend), on n'écrit que la forme groupée.

### Baisser la rétention supprime des conversations

`retentionShrinks(previous, next)` traite `0` comme « illimité » : `0 → 30`
resserre, `30 → 0` élargit. Quand ça resserre, un encart le dit dès la saisie et
la sauvegarde passe par un `AlertDialog` qui nomme la conséquence (le bot
efface, à sa prochaine purge quotidienne, tout ce qui est fermé depuis plus de
N jours ; les avis survivent, les conversations non). Irréversible, donc jamais
sans oui explicite.

### `/transcripts/:key` vit hors du châssis

Le bot donne ce lien à deux publics : le salon de journal (l'équipe) **et** le
DM de fermeture (l'auteur du ticket), qui n'administre peut-être aucun serveur.
La page est donc une route de premier niveau, avec une simple garde de session,
et pas un enfant de `HomePage` (sélecteur de serveur, sidebar, contexte guilde —
rien de tout ça n'a de sens ici).

Le `404` est volontairement indistinguable (clé inconnue, mal formée, lecteur
non autorisé) : l'écran dit « archive introuvable ou lien expiré », jamais
« accès refusé » — confirmer qu'une clé existe est déjà une fuite. Le `422` est
traité à part : l'archive existe, le lecteur y a droit, mais son corps n'est pas
rendable — message technique, pas de nouvel essai.

### Le thread de l'équipe n'est jamais fusionné

`staff_thread` n'arrive que si `viewer.is_staff`. Il vit dans son **propre
onglet**, jamais dans `messages`, et l'export texte suit la même règle — il ne
doit pas devenir une porte dérobée. Pour les autres lecteurs, seul
`staff_thread_withheld` donne un bandeau discret : le cacher ferait passer
l'archive pour incomplète.

### Rendu Discord : formes nommées, rien qui disparaît

`lib/transcripts.ts` est le **seul** endroit qui connaît les types numériques de
Discord (`10` = texte, `17` = conteneur…). Les composants en ressortent nommés,
et un type inconnu devient `unsupported` — une archive écrite par un bot plus
récent montre qu'il manquait quelque chose plutôt que d'afficher un message
vide. Même principe pour les URL de CDN, qui expirent : l'aperçu bascule sur une
fiche « lien expiré » qui garde le nom et la taille.

Un message sans texte (conteneur V2, embed seul) porte déjà son cadre : sa bulle
passe en `ghost`, sinon on obtenait un cadre dans un cadre.

### Tenir une très longue conversation

Jusqu'à 20 000 messages. Le fil ne monte qu'une fenêtre de blocs (dépliage vers
le haut, `MessageScroller` conserve la position, `content-visibility` fait le
reste), **sauf pendant une recherche** : elle porte sur toute la conversation,
donc tout est déplié — sinon un résultat serait hors du DOM et le saut ne
mènerait nulle part.

### Avis : l'appréciation, jamais `n/5`

La fenêtre du bot ne montre que cinq adjectifs, localisés dans cinq langues et
améliorés d'une version à l'autre : on rend `score_key` depuis nos traductions,
`score` ne sert qu'à trier. `rated_staff_id: null` est « personne en
particulier », une vraie réponse. `by_staff` arrive classé par volume et n'est
jamais re-trié par moyenne ; `low_sample` se signale sans classer ; une ligne
`ratings: 0, handled > 0` reste affichée, `handled` venant des archives.

## Contrôles

- `npx tsc --noEmit` ✅ · `npm run lint` (fichiers touchés) ✅ · `npm run build` ✅
- Contrôle visuel du lecteur et du formulaire de réglages en 1440 px, 1200 px et
  390 px (Playwright) : pas de défilement horizontal, colonne de détails repliée
  en accordéon sur mobile, recherche sur sa propre ligne.

## Notes de déploiement

- **Déployer le bot en premier** : les trois tables (`ticket_transcripts`,
  `ticket_transcript_authors`, `ticket_ratings`) lui appartiennent. Un backend en
  avance ne casse rien (les lectures renvoient « aucune archive »), mais rien ne
  s'affiche tant qu'il n'est pas passé.
- `zstandard` a été ajouté aux dépendances du backend : sans lui, une archive en
  `zstd` ressort en 422 explicite.

## Prochaines étapes suggérées

- Onglet archives côté **serveur** pour les notifications déjà exposées en
  service (`/guilds/{id}/notifications`).
- Filtre « agent » sur les archives (`staff_id`) avec sélecteur de membre plutôt
  qu'un identifiant à coller.
- Export `.html` ou `.json` de l'archive, en plus du `.txt`.
