# Guide d'intégration — statistiques et lien d'installation

**Date** : 2026-09-07
**Objectif** : déposer dans ce dépôt le guide d'intégration des deux nouveautés
backend livrées le même jour — le **lien d'installation** (avec son écran de
remerciement) et le **panneau statistiques du staff**. Aucune ligne de code
applicatif n'a été touchée : c'est un dépôt de documentation, préalable à
l'implémentation.

---

## 1. Contexte

Le bot collecte désormais ses statistiques dans cinq tables PostgreSQL
(compteurs, jauges, événements bruts, cycle de vie des serveurs, acquisition).
Le backend (`moddy-app/website-backend`, PR #82) y a branché :

- un **lien d'installation** `GET /install` : une seule autorisation Discord
  ajoute le bot, connecte la personne au dashboard et enregistre d'où elle vient
  (top.gg, profil du bot, publicité…) ;
- **13 endpoints staff** sous `/staff/stats` qui rendent tout le système sous une
  forme directement affichable.

Le dashboard a donc deux écrans à construire, et aucun des deux n'est évident à
faire correctement sans le contrat : lire une jauge comme un compteur produit un
graphique faux mais crédible, ce qui est le pire cas.

Comme lors de la session « Notifications — branchement sur l'API », c'est bien
le **guide dashboard** qui a été retenu, pas le contrat backend : ce dépôt parle
à l'API HTTP, qui rend déjà tout calculé.

## 2. Tâches accomplies

- Ajout du guide d'intégration dans `docs/backend-integration/`, à côté de
  `frontend-integration.md`, `api.md` et `security.md`.
- Adaptation de l'en-tête : les renvois vers `API_ENDPOINTS.md` et `STATS.md`
  pointent explicitement vers le dépôt backend, pour qu'on ne les cherche pas
  ici.
- Mise à jour de `docs/API_ENDPOINTS.md` avec les nouveaux endpoints : section
  **Installation** (3 endpoints) et les **12 endpoints staff** de statistiques,
  plus les changements du callback OAuth2 (`guild_id`, `error`, redirection
  `?installed=`) et les scopes réellement demandés par `/auth/login`.

## 3. Fichiers créés

| Chemin | Rôle |
|---|---|
| `docs/backend-integration/stats-and-install.md` | Le guide (deux parties : installation, panneau stats) |
| `docs/sessions/2026-09-07_guide-stats-et-installation.md` | Ce résumé |

## 3 bis. Fichier modifié

`docs/API_ENDPOINTS.md` — +336 lignes : la section **Installation**
(`GET /install`, `/install/latest`, `/install/sources`), les **12 endpoints
staff** de statistiques, et la mise à jour de la section Auth (le callback
accepte désormais `guild_id`, `state` et `error`, et redirige avec
`?installed=<guild_id>` après une installation).

Le report a été fait par patch depuis le dépôt backend plutôt que par copie du
fichier entier : la copie de ce dépôt est **en avance** sur celle du backend
concernant Brocoli (elle documente
`POST /ai/conversations/{id}/questions/{qid}/answer` et l'outil `ask_user`, que
la copie backend ne connaît pas encore). Une copie brute aurait supprimé ce
contenu. Les deux fichiers ont donc divergé — à réconcilier un jour, dans le
sens dashboard → backend pour la partie Brocoli.

Aucune dépendance ajoutée, aucun code applicatif touché.

## 4. Ce que le guide contient

### Partie 1 — L'installation

- **Fabriquer les liens** : `https://api.moddy.app/install?source=…`, avec le
  vocabulaire **fermé** des sources (`topgg`, `discovery`, `profile`, `ads`,
  `command`, `direct`) et les quatre paramètres UTM libres, expliqués depuis
  zéro.
- **Détecter le retour** : le dashboard reçoit `?installed=<guild_id>` et la
  session est déjà posée. Le nom et l'icône du serveur ne sont pas dans la
  réponse (la base ne stocke que des ids) — ils sont dans `GET /auth/me`, où le
  serveur fraîchement installé a été inséré exprès par le backend.
- **Le repli** `GET /install/latest` quand ce paramètre est perdu.
- **Les cas limites**, sous forme de tableau.

### Partie 2 — Le panneau staff

- **Partir du catalogue** (`GET /staff/stats/catalog`) pour générer les écrans
  plutôt que de coder chaque métrique.
- **Quatre règles de lecture** : ne jamais sommer une jauge, pointiller la
  journée en cours, ne pas tracer zéro pour une jauge éparse, garder les
  snowflakes en chaînes.
- Le détail de chaque endpoint, la lecture de l'écran acquisition, le bandeau
  santé, et neuf pièges concrets.

## 5. Documentation technique — ce qui structure l'implémentation à venir

Trois éléments du contrat ont des conséquences directes sur le code React :

**Le catalogue est un contrat, pas de la documentation.** Chaque métrique porte
`type`, `additive`, `dims`, `unit`, `sparse`, `approximate`. Un composant
générique de graphique piloté par ces champs évite d'écrire un écran par
métrique — et évite surtout de dupliquer la règle « ne pas sommer une jauge »
dans chaque écran, où elle finirait par être oubliée à un endroit.

**La journée en cours est incomplète.** Chaque réponse porte `partial_day`. Sans
traitement visuel (pointillé, libellé « en cours »), le dashboard donnera chaque
matin l'impression d'un effondrement du trafic.

**Deux conventions numériques à ne pas confondre.** `share` et `rate` sont des
fractions (0→1) ; `conversion_pct` et `retention_pct` sont déjà en pourcentage.
Toutes les durées (`lifetime_seconds`, `guild_age_seconds`, les champs de
`churn`) sont en **secondes**.

## 6. Notes et décisions

- **Emplacement** : `docs/backend-integration/` plutôt que la racine de `docs/`,
  puisque c'est exactement la nature du document — un contrat d'intégration avec
  l'API.
- **Nom** : `stats-and-install.md` plutôt que le nom du fichier source
  (`DASHBOARD_STATS_INTEGRATION.md`), pour rester cohérent avec les fichiers
  voisins (`api.md`, `security.md`).
- **Copie plutôt que lien** : le guide vit aussi dans le dépôt backend, à côté
  du code qu'il décrit. La duplication est assumée — l'alternative serait un lien
  vers un dépôt privé, illisible depuis ce dépôt-ci. À resynchroniser si les
  endpoints bougent.

## 7. Prochaines étapes

1. **Écran de remerciement** : lire `?installed=` au chargement, résoudre le nom
   du serveur via `/auth/me`, nettoyer l'URL (`history.replaceState`), gérer
   `?auth_error=access_denied` par un message neutre.
2. **Service `services/stats.ts`** : un client typé sur les 13 endpoints, avec
   les types du catalogue générés à la main (`MetricType`, `SeriesPoint`…).
3. **Composant de graphique piloté par le catalogue** : c'est lui qui applique
   `additive`, `partial_day` et `filled`, une seule fois pour tous les écrans.
4. **Page acquisition** : le tableau par source, avec `conversion_pct` et
   `retention_pct` côte à côte — c'est cette comparaison qui fait l'intérêt de
   l'écran.
5. **Bandeau santé** : afficher `alerts` si `ok: false`, ignorer sinon.
