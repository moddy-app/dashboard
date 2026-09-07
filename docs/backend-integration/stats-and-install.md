# Guide d'intégration Dashboard — Statistiques & installation

> Doc **destinée à ce dépôt** (dashboard `moddy.app`). Deux sujets :
> l'**écran de remerciement** après une installation, et le **panneau
> statistiques du staff**.
>
> Tout ce dont le dashboard a besoin est ici : il parle à l'API HTTP, jamais aux
> tables. Côté dépôt backend (`moddy-app/website-backend`),
> `docs/API_ENDPOINTS.md` est la référence exhaustive des payloads et
> `docs/STATS.md` explique **pourquoi** les données ont cette forme — à lire
> seulement si un comportement surprend.

## 0. Conventions

| Sujet | Détail |
|---|---|
| **Base URL** | `https://api.moddy.app` |
| **Auth** | Cookie `session_token` (auto), requêtes **avec credentials** |
| **IDs Discord** | toujours des **strings** (un snowflake dépasse `Number.MAX_SAFE_INTEGER`) |
| **Dates** | `day` / `cohort` en `YYYY-MM-DD`, timestamps en ISO 8601 **UTC** |
| **Fuseau** | tout est en UTC. Convertir à l'affichage si tu veux, mais **jamais** avant de regrouper |
| **Pagination** | `limit` + `offset`, pas de total renvoyé |
| **Erreurs** | `422` = paramètre refusé (message lisible dans `error`), `403` = pas staff |

---

# Partie 1 — L'installation

## 1.1 Fabriquer les liens

Le lien d'installation est `https://api.moddy.app/install`. Une seule
autorisation Discord ajoute le bot **et** connecte la personne au dashboard :
elle revient donc déjà authentifiée, pas besoin de lui redemander de se
connecter.

Un paramètre compte, `source`, et il a un **vocabulaire fermé** :

| `source` | Quand |
|---|---|
| `topgg` | top.gg et autres listings |
| `discovery` | découverte Discord / App Directory |
| `profile` | profil du bot dans Discord |
| `ads` | publicité payante |
| `command` | bouton « ajouter Moddy » depuis une commande du bot |
| `direct` | site, documentation, lien partagé — c'est aussi le défaut |

`GET /install/sources` rend cette liste si tu veux générer les liens
dynamiquement plutôt que de les coder en dur.

**N'invente pas de valeur** : `source` est une dimension des statistiques, donc
chaque valeur distincte crée une ligne par jour. Une valeur inconnue n'est pas
rejetée (elle tombe sur `other`), mais elle ne sera pas comparable au reste.

### Les UTM (le détail d'une campagne)

Quatre paramètres optionnels, **libres**, à côté de `source` :

| Paramètre | Répond à | Exemple |
|---|---|---|
| `utm_medium` | par quel type de canal ? | `discord-ad`, `youtube`, `newsletter` |
| `utm_campaign` | quelle opération ? | `noel-2026`, `lancement-tickets` |
| `utm_content` | quelle variante ? (A/B) | `banniere-bleue`, `video-30s` |
| `utm_term` | quel mot-clé ? (recherche payante) | `bot+moderation+discord` |

```
https://api.moddy.app/install?source=ads&utm_medium=discord-ad&utm_campaign=noel-2026&utm_content=visuel-bleu
```

Minuscules et tirets, pas d'accents ni d'espaces, et sois **constant** :
`youtube` et `Youtube` seront comptés séparément, or toute la valeur des UTM
vient de la comparabilité. Rien de secret dedans, c'est dans l'URL. Tronqué à
200 caractères par paramètre.

### Autres paramètres

| Param | Rôle |
|---|---|
| `guild_id` | présélectionne un serveur sur l'écran Discord |
| `redirect` | où revenir après l'installation (allowlist `*.moddy.app`, défaut : le dashboard) |

## 1.2 Détecter le retour

Après l'autorisation, l'utilisateur atterrit sur le dashboard avec la session
posée et un paramètre :

```
https://dashboard.moddy.app/?installed=123456789012345678
```

C'est le signal de l'écran « Merci d'avoir ajouté Moddy à <serveur> », avec un
bouton « Configurer » vers `/guilds/<installed>`.

**Le nom et l'icône du serveur ne sont pas dans la réponse** : la base ne stocke
que des ids. Ils sont dans `GET /auth/me` → `guilds[]`, où le serveur qui vient
d'être ajouté a été inséré exprès (voir §1.4). Fais la correspondance par id.

Nettoie le paramètre de l'URL une fois l'écran affiché
(`history.replaceState`), sinon un rafraîchissement le réaffiche indéfiniment.

## 1.3 Le repli : `GET /install/latest`

Si le paramètre a été perdu (rafraîchissement après nettoyage, redirection
intermédiaire, app mobile), demande la dernière installation lancée par le
compte connecté :

```js
const { install } = await fetch("/install/latest", { credentials: "include" })
  .then(r => r.json());

if (install) {
  // afficher l'écran de remerciement pour install.guild_id
}
```

```json
{
  "install": {
    "guild_id": "123456789012345678",
    "source": "topgg",
    "utm": {"campaign": "noel-2026"},
    "first_seen_at": "2026-09-07T17:00:00+00:00",
    "confirmed_at": null,
    "confirmed": false,
    "manageable": true
  }
}
```

| Champ | À quoi il sert |
|---|---|
| `confirmed` | le bot a **effectivement** rejoint (le bot le confirme lui-même) |
| `manageable` | le serveur est déjà dans la liste de la session → le bouton « Configurer » peut être actif |

`install` vaut `null` s'il n'y a rien dans les **30 dernières minutes**. C'est
volontaire : l'écran de remerciement ne doit pas ressurgir des semaines plus
tard sur une simple reconnexion.

## 1.4 Cas limites

| Situation | Ce que tu vois | Quoi faire |
|---|---|---|
| **`confirmed: false` juste après le retour** | normal — le bot pose `confirmed_at` quand la passerelle Discord lui livre l'événement, ça prend une seconde ou deux | Affiche l'écran quand même. Si tu veux être précis, re-interroge `/install/latest` une fois après ~3 s |
| **`manageable: false`** | rare : Discord n'a pas encore répercuté l'ajout | Affiche le remerciement, garde le bouton « Configurer » inactif, et propose `POST /auth/refresh-guilds` (ou attends le prochain chargement) |
| **`?auth_error=access_denied`** | la personne a cliqué « Annuler » sur l'écran Discord | Message neutre + bouton pour relancer. Ce n'est pas une erreur technique |
| **L'utilisateur installe un 2ᵉ serveur** | `?installed=` porte le nouveau | Rien de spécial, chaque installation écrase la précédente pour ce serveur-là |
| **Réinstallation d'un serveur déjà connu** | même chose | Côté stats c'est une **nouvelle** conversion, c'est voulu |

> Le serveur fraîchement installé est ajouté à la liste de la session par le
> backend, parce que la liste des serveurs du bot est mise en cache 5 minutes.
> Sans ça, le bouton « Configurer » tomberait sur un `403` juste après
> l'installation. Tu n'as rien à faire, mais c'est bon à savoir si tu compares
> `/auth/me` avec ce que Discord te dirait.

---

# Partie 2 — Le panneau statistiques (staff)

Tous les endpoints sont sous `/staff/stats`, tous en lecture seule, tous
réservés au staff (`403` sinon).

## 2.1 Commence par le catalogue

`GET /staff/stats/catalog` décrit **toutes** les métriques : c'est ce qui te
permet de construire les écrans sans coder chaque métrique à la main.

```json
{
  "metrics": [
    {"metric": "command.used", "type": "counter", "scopes": ["guild"],
     "bucket": "day", "label": "Commandes exécutées", "dims": ["command", "kind"],
     "unit": "count", "additive": true, "sparse": false, "approximate": false,
     "notes": ""}
  ],
  "types": {"counter": "…", "gauge": "…", "unique": "…"},
  "install_sources": ["topgg", "discovery", "profile", "ads", "command", "direct", "other"]
}
```

Ce que chaque champ te dit **concrètement** :

| Champ | Ce que le front en fait |
|---|---|
| `type` | `counter` → histogramme / courbe cumulable. `gauge` → courbe d'état. `unique` → courbe d'état, avec une mention « approximatif » |
| `additive` | si `false`, **n'affiche aucun total** sur la période. Sommer une jauge n'a aucun sens |
| `dims` | les seuls `by=` acceptés par `/breakdown`, et les seules clés utilisables dans `dims=`. Sert à générer les filtres |
| `scopes` | si `guild` n'y est pas, ne propose pas de sélecteur de serveur |
| `unit` | `micro_usd` → afficher en dollars (le backend te donne déjà les deux) |
| `sparse` | la courbe contiendra des points reconstruits (`filled: true`) |
| `approximate` | affiche « ~ » ou « environ » — c'est un HyperLogLog, ±0,8 % |

Une métrique hors catalogue est un `422`. C'est intentionnel : le catalogue est
l'allowlist du backend, pas seulement de la documentation.

## 2.2 Les quatre règles de lecture

### 1. Ne somme jamais une jauge

`bot.guilds` sur 30 jours n'est pas 30 × le nombre de serveurs. Un compteur
répond à « combien de fois » (ça s'additionne), une jauge à « combien y en
a-t-il » (c'est un état). Fie-toi à `additive`.

### 2. La journée en cours est incomplète

Chaque réponse porte `partial_day` (ou `window.partial_day`). Le dernier point
d'une courbe est **toujours** partiel : les compteurs sont vidés toutes les
60 s, les jauges recalculées toutes les 6 h. Pointille ce segment, ou
étiquette-le « en cours ». Sinon, chaque matin, le dashboard donnera
l'impression d'un effondrement.

Corollaire : une jauge peut porter `day` = hier. Ce n'est pas un bug.

### 3. Un jour sans donnée vaut zéro… sauf pour une jauge éparse

Pour un compteur, l'axe des jours est **complet** et les jours sans activité
valent `0` — tu n'as rien à reconstruire.

Pour `guild.members` (`sparse: true`), la valeur n'est écrite que quand elle
change. Le backend reporte la dernière valeur connue et marque ces points :

```json
{"day": "2026-09-05", "value": 1240, "filled": true}
```

Affiche-les normalement (c'est bien la valeur du jour), mais ne les traite pas
comme des mesures : pas de marqueur de point, pas de « dernière mise à jour ».
`value: null` en début de courbe veut dire « aucune valeur connue » — laisse un
trou, ne trace **pas** zéro : un serveur n'a jamais zéro membre, et une courbe
qui plonge à zéro se lit comme un incident.

### 4. Les IDs sont des strings, les dimensions aussi

`guild_id`, `installer_id`, `owner_id` : toujours des strings. Et **toutes** les
valeurs de dimension sont des chaînes, y compris les booléens :
`{"ok": "true"}`, jamais `{"ok": true}` — le second est refusé en `422`, parce
qu'il ne matcherait jamais rien.

## 2.3 Les écrans

### Vue d'ensemble — `GET /staff/stats/overview?days=30`

De quoi remplir toute la page d'accueil en un appel : jauges globales avec leur
variation sur la fenêtre, ajouts/départs, usage et taux d'erreur, coût IA,
adoption des modules.

```json
{
  "window": {"from": "2026-08-09", "to": "2026-09-07", "days": 30, "partial_day": "2026-09-07"},
  "gauges": [{"metric": "bot.guilds", "label": "Serveurs", "value": 5210,
              "day": "2026-09-07", "previous": 4980, "delta": 230}],
  "guilds": {"joins": 312, "leaves": 88, "net": 224,
             "churn": {"left_count": 88, "avg_lifetime_seconds": 1209600,
                       "median_lifetime_seconds": 864000}},
  "usage": {"commands": 128400, "command_errors": 312, "error_rate": 0.0024},
  "ai": {"cost_micro_usd": 4120000, "cost_usd": 4.12},
  "modules": [{"module": "logs", "guilds": 1830, "day": "2026-09-07"}]
}
```

`delta` peut être `null` (aucune valeur connue avant la fenêtre) : affiche « — »,
pas « 0 ». Les durées de `churn` sont en **secondes**.

### Une courbe — `GET /staff/stats/series`

| Param | |
|---|---|
| `metric` | obligatoire, du catalogue |
| `days` | 1-400, défaut 30 |
| `scope` | `global` (défaut) ou `guild` |
| `scope_id` | **obligatoire** si `scope=guild` |
| `dims` | filtre JSON encodé : `dims={"command":"config"}` |

```js
const params = new URLSearchParams({
  metric: "command.used", scope: "guild", scope_id: guildId, days: "30",
  dims: JSON.stringify({ kind: "slash" }),
});
const series = await fetch(`/staff/stats/series?${params}`, { credentials: "include" })
  .then(r => r.json());
```

La réponse porte tout ce qu'il faut pour dessiner sans consulter le catalogue :
`type`, `unit`, `additive`, `approximate`, `partial_day`, `points`. Pour
`ai.cost`, un `total_usd` est ajouté.

### Une répartition — `GET /staff/stats/breakdown?metric=…&by=…`

Top commandes, erreurs par classe d'exception, notifications par plateforme.
`by` doit être une des `dims` de la métrique, sinon `422`.

```json
{"metric": "command.used", "dimension": "command", "total": 18,
 "items": [{"key": "config", "value": 12, "share": 0.6667}]}
```

`share` est une fraction (0→1), pas un pourcentage. `key: "unknown"` = les lignes
qui n'ont pas cette dimension.

### Les autres

| Endpoint | Ce que tu affiches |
|---|---|
| `GET /staff/stats/top-guilds?metric=&days=` | classement des serveurs. Tu n'as que des ids : résous les noms via `GET /staff/guilds/{id}` si besoin |
| `GET /staff/stats/guilds/lifecycle?days=` | courbe ajouts / départs / net, plus `cumulative_net` déjà calculé |
| `GET /staff/stats/guilds/retention` | cohortes mensuelles. `rate` est une fraction, `null` si la cohorte est vide |
| `GET /staff/stats/guilds/events` | journal brut, pour le détail derrière une courbe. Durées en secondes |
| `GET /staff/stats/acquisition?days=` | le tableau des sources (§2.4) |
| `GET /staff/stats/installs` | liste des installations avec leurs UTM complets |
| `GET /staff/stats/ai?days=&guild_id=` | coût, tokens, appels, par modèle et par jour |
| `GET /staff/stats/health` | bandeau d'alerte (§2.5) |

## 2.4 L'écran acquisition

C'est celui qui répond à « quel canal marche ». Trois colonnes, et il faut les
trois :

```json
{"source": "topgg", "clicks": 1840, "started": 210, "installed": 173,
 "conversion_pct": 82.4, "acquired_all_time": 980, "still_here": 612,
 "retention_pct": 62.4}
```

| Colonne | Sens |
|---|---|
| `clicks` | liens ouverts. **Indicatif** — compteur best-effort, `null` si indisponible : ne construis rien dessus, et signale-le dans l'UI |
| `started` | autorisation Discord accordée (l'installation a pu échouer ensuite) |
| `installed` | le bot a vraiment rejoint |
| `conversion_pct` | `installed / started`, sur la fenêtre. Déjà en pourcentage |
| `retention_pct` | serveurs encore présents / serveurs acquis, **sur toute l'histoire**, pas sur la fenêtre |

La lecture utile : une source qui convertit bien mais retient mal achète les
mauvais serveurs. Mets `conversion_pct` et `retention_pct` côte à côte, c'est
tout l'intérêt de l'écran.

Une source avec des clics et zéro installation apparaît quand même : c'est
précisément le signal qu'un lien est cassé.

Pour creuser une campagne : `GET /staff/stats/installs?source=ads&days=30`, qui
rend les `utm` complets de chaque installation.

## 2.5 Le bandeau santé — `GET /staff/stats/health`

```json
{"counters": {"last_bucket": "…", "rows": 128400}, "…": "…",
 "default_partitions": {"stats_counters_default": 0, "stats_events_default": 0},
 "alerts": [], "ok": true}
```

Affiche un bandeau **si et seulement si** `ok: false`, avec le contenu de
`alerts` (déjà rédigé en clair). Ça veut dire qu'une création de partition a été
ratée côté bot : les données restent lisibles mais ne seront plus purgeables.
Le reste de la réponse est de la fraîcheur, informatif.

Sur une base où le bot n'a jamais tourné, tout est vide plutôt qu'en erreur :
prévois un état vide propre (« aucune donnée collectée »), pas un écran cassé.

---

## 3. Pièges

1. **Sommer une jauge.** Le piège numéro un. `additive: false` est là pour ça.
2. **Traiter le dernier point comme complet.** Utilise `partial_day`.
3. **Tracer zéro pour une jauge éparse.** `value: null` = inconnu, laisse un trou.
4. **Envoyer `{"ok": true}` dans `dims`.** Les valeurs de dimension sont des
   chaînes : `{"ok": "true"}`.
5. **Parser un id en `Number`.** Un snowflake dépasse la précision d'un
   `Number` JS. Tout arrive en string, garde-le en string.
6. **Comparer `conversion_pct` et `retention_pct` sur la même période.** Le
   premier est sur la fenêtre, le second sur toute l'histoire.
7. **Fabriquer une `source` à soi** dans un lien d'installation. Vocabulaire
   fermé : ce qui en sort est agrégé sous `other`.
8. **Oublier de nettoyer `?installed=` de l'URL.** L'écran de remerciement
   reviendrait à chaque rafraîchissement.
9. **Croire qu'un `confirmed: false` est un échec.** C'est le délai de la
   passerelle Discord, de l'ordre de la seconde.
