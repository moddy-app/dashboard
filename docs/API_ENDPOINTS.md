# Moddy Backend — Reference complete des endpoints

Toutes les reponses sont en JSON. Les erreurs suivent le format `{"error": "message"}`.

---

## Auth

### `GET /auth/login`

Redirige vers la page d'autorisation Discord OAuth2.

**Auth :** aucune
**Scopes Discord demandes :** `identify email guilds`
**Reponse :** Redirect 302 vers `https://discord.com/oauth2/authorize?client_id=...&scope=identify+guilds&...`

---

### `GET /auth/discord/callback?code={code}`

Callback OAuth2 Discord. Echange le code, cree la session, redirige vers le dashboard.

**Auth :** aucune
**Query params :**

| Param | Type | Description |
|---|---|---|
| `code` | string | Code d'autorisation Discord |

**Flux interne :**
1. Echange le code contre un access_token via `POST /oauth2/token`
2. Recupere le profil Discord via `GET /users/@me`
3. Recupere les guilds via `GET /users/@me/guilds`
4. Filtre les guilds avec permission ADMINISTRATOR (0x8) ou owner
5. Croise avec les guilds du bot (via bot token + cache Redis `moddy:bot_guilds` TTL 5min)
6. Ne garde que les guilds ou l'utilisateur est admin ET le bot est present
7. Verifie le statut staff dans `staff_permissions`
8. Cree la session Redis (`session:{token}` → JSON, TTL 30j)
9. Set le cookie `session_token` (HttpOnly, Secure, SameSite=Lax, Domain=.moddy.app)

**Reponse :** Redirect 302 vers `https://dashboard.moddy.app`

---

### `POST /auth/logout`

Invalide la session et supprime le cookie.

**Auth :** session cookie
**Reponse :**

```json
// Status 200 (body vide, le cookie est supprime via Set-Cookie)
```

---

### `POST /auth/refresh`

Remet le TTL de la session a sa valeur initiale (30 jours).

**Auth :** session cookie
**Reponse :**

```json
{"status": "refreshed"}
```

**Erreur :** `401 {"error": "Session invalide"}`

---

### `POST /auth/refresh-guilds`

Rafraichit la liste des serveurs de l'utilisateur depuis l'API Discord. Utilise le `access_token` stocke en session, ou le `refresh_token` si le token est expire. Filtre par permission ADMINISTRATOR + presence du bot.

**Auth :** session cookie
**Reponse :**

```json
{
  "guilds": [
    {"id": 111222333444, "name": "Mon Serveur", "icon": "abc123"},
    {"id": 555666777888, "name": "Autre Serveur", "icon": null}
  ]
}
```

**Erreur :** `401 {"error": "Non authentifie"}` ou `401 {"error": "Session expiree"}`

---

### `GET /auth/me`

Retourne le profil complet de l'utilisateur connecte (donnees issues de la session Redis, capturees au moment du login Discord).

**Auth :** session cookie
**Reponse :**

```json
{
  "user_id": "123456789012345678",
  "username": "johndoe",
  "global_name": "John Doe",
  "discriminator": "0",
  "avatar": "a_d5efa99b3eeaa7dd43acca82f5692432",
  "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/a_d5efa99b3eeaa7dd43acca82f5692432.gif",
  "banner": null,
  "banner_url": null,
  "accent_color": 5793266,
  "avatar_decoration_data": null,
  "email": "john@example.com",
  "verified": true,
  "locale": "fr",
  "mfa_enabled": true,
  "premium_type": 2,
  "public_flags": 4194304,
  "flags": 4194308,
  "discord_badges": ["BUG_HUNTER_LEVEL_1", "ACTIVE_DEVELOPER"],
  "guilds": [
    {"id": 111222333444, "name": "Mon Serveur", "icon": "abc123"},
    {"id": 555666777888, "name": "Autre Serveur", "icon": null}
  ],
  "is_staff": true,
  "staff_roles": ["Manager", "Dev"]
}
```

**Champs :**

| Champ | Type | Description |
|---|---|---|
| `user_id` | string | Discord ID (Snowflake) |
| `username` | string | Nom d'utilisateur Discord (unique) |
| `global_name` | string\|null | Nom d'affichage (peut differer du username) |
| `discriminator` | string | Discriminateur (`"0"` sur les nouveaux comptes) |
| `avatar` | string\|null | Hash de l'avatar |
| `avatar_url` | string\|null | URL CDN complete (`.png` ou `.gif` si hash commence par `a_`) |
| `banner` | string\|null | Hash de la banniere de profil |
| `banner_url` | string\|null | URL CDN complete de la banniere |
| `accent_color` | int\|null | Couleur d'accent du profil (valeur RGB entiere) |
| `avatar_decoration_data` | object\|null | Decoration d'avatar (`asset`, `sku_id`) |
| `email` | string\|null | Email Discord (scope `email`) |
| `verified` | bool\|null | Email Discord verifie |
| `locale` | string\|null | Langue de l'interface (ex: `"fr"`, `"en-US"`) |
| `mfa_enabled` | bool\|null | 2FA activee sur le compte |
| `premium_type` | int\|null | Nitro : `0`=Aucun, `1`=Classic, `2`=Nitro, `3`=Basic |
| `public_flags` | int\|null | Bitmask flags publics |
| `flags` | int\|null | Bitmask tous les flags (publics + prives) |
| `discord_badges` | string[] | Noms lisibles des flags actifs (voir ci-dessous) |
| `guilds` | array | Serveurs ou l'utilisateur est admin ET le bot est present |
| `is_staff` | bool | Statut staff Moddy |
| `staff_roles` | string[] | Roles staff Moddy (vide si non-staff) |

**Valeurs possibles de `discord_badges` :**

| Valeur | Description |
|---|---|
| `DISCORD_STAFF` | Employe Discord |
| `PARTNERED_SERVER_OWNER` | Proprietaire de serveur partenaire |
| `HYPESQUAD_EVENTS` | Membre HypeSquad Events |
| `BUG_HUNTER_LEVEL_1` | Bug Hunter niveau 1 |
| `HYPESQUAD_HOUSE_BRAVERY` | Maison HypeSquad Bravery |
| `HYPESQUAD_HOUSE_BRILLIANCE` | Maison HypeSquad Brilliance |
| `HYPESQUAD_HOUSE_BALANCE` | Maison HypeSquad Balance |
| `EARLY_SUPPORTER` | Supporter precoce Nitro |
| `TEAM_PSEUDO_USER` | Compte equipe Discord |
| `BUG_HUNTER_LEVEL_2` | Bug Hunter niveau 2 (or) |
| `VERIFIED_BOT` | Bot verifie |
| `EARLY_VERIFIED_BOT_DEVELOPER` | Developpeur de bot verifie (early) |
| `DISCORD_CERTIFIED_MODERATOR` | Moderateur certifie Discord |
| `BOT_HTTP_INTERACTIONS` | Bot interactions HTTP uniquement |
| `ACTIVE_DEVELOPER` | Developpeur actif |

**Note :** Les donnees sont issues de la session Redis capturee au login. Pour rafraichir les guilds, utiliser `POST /auth/refresh-guilds`. Les donnees de profil (badges, email, etc.) sont mises a jour a la prochaine connexion.

---

## Guilds

### `GET /guilds`

Liste les serveurs accessibles par l'utilisateur connecte (ceux ou il a ADMINISTRATOR et ou le bot est present).

**Auth :** session cookie
**Reponse :** Combine les metadonnees Discord (nom, icone) avec la config DB (attributes, data).

```json
[
  {
    "guild_id": 123456789,
    "name": "Mon Serveur",
    "icon": "abc123def456",
    "attributes": {"PREMIUM": true},
    "data": {
      "modules": {
        "starboard": {"channel_id": 999, "reaction_count": 5, "emoji": "⭐"}
      }
    },
    "in_database": true
  }
]
```

---

### `GET /guilds/{guild_id}`

Detail d'un serveur. Combine les infos Discord (via bot token) avec la config DB.

**Auth :** guild_access (ADMINISTRATOR ou owner ou staff)
**Path params :**

| Param | Type | Description |
|---|---|---|
| `guild_id` | int | ID Discord du serveur |

**Cache :** Redis `discord:guild:{guild_id}:info` (TTL 5min)
**Reponse :**

```json
{
  "guild_id": 123456789,
  "name": "Mon Serveur",
  "icon": "abc123def456",
  "banner": "def456abc789",
  "splash": null,
  "description": "Un serveur communautaire",
  "owner_id": "987654321012345678",
  "premium_tier": 2,
  "premium_subscription_count": 14,
  "preferred_locale": "fr",
  "verification_level": 2,
  "vanity_url_code": "monserveur",
  "features": ["COMMUNITY", "INVITE_SPLASH", "VANITY_URL"],
  "member_count": 1500,
  "presence_count": 342,
  "system_channel_id": "111222333444555666",
  "attributes": {"PREMIUM": true, "BETA": true},
  "data": {
    "modules": {
      "starboard": {"channel_id": 999, "reaction_count": 5, "emoji": "⭐"},
      "welcome_channel": {"channel_id": 888, "message_template": "Bienvenue {user} !"}
    }
  },
  "in_database": true
}
```

**Erreurs :** `403` si pas acces, `404` si serveur introuvable dans Discord

---

### `GET /guilds/{guild_id}/channels`

Liste tous les salons d'un serveur depuis l'API Discord via le bot token.

**Auth :** guild_access
**Cache :** Redis `discord:guild:{guild_id}:channels` (TTL 2min)
**Reponse :** Array d'objets channel Discord (id, name, type, position, parent_id, permission_overwrites, etc.)

```json
[
  {"id": "999888777", "name": "general", "type": 0, "position": 0, "parent_id": "111222333"},
  {"id": "999888778", "name": "announcements", "type": 5, "position": 1, "parent_id": "111222333"}
]
```

---

### `GET /guilds/{guild_id}/roles`

Liste tous les roles d'un serveur depuis l'API Discord via le bot token.

**Auth :** guild_access
**Cache :** Redis `discord:guild:{guild_id}:roles` (TTL 2min)
**Reponse :** Array d'objets role Discord (id, name, color, position, permissions, mentionable, etc.)

```json
[
  {"id": "111222333", "name": "@everyone", "color": 0, "position": 0, "permissions": "104324673"},
  {"id": "444555666", "name": "Moderateur", "color": 3447003, "position": 5, "permissions": "1099511627775"}
]
```

---

### `GET /guilds/{guild_id}/emojis`

Liste tous les emojis personnalises d'un serveur.

**Auth :** guild_access
**Cache :** Redis `discord:guild:{guild_id}:emojis` (TTL 5min)
**Reponse :** Array d'objets emoji Discord

---

### `GET /guilds/{guild_id}/discord`

Recupere toutes les infos Discord d'un serveur en un seul appel (guild info, channels, roles).

**Auth :** guild_access
**Reponse :**

```json
{
  "guild": {"id": "123456789", "name": "Mon Serveur", "icon": "abc123", "member_count": 1500, "...": "..."},
  "channels": [{"id": "999888777", "name": "general", "type": 0, "...": "..."}],
  "roles": [{"id": "444555666", "name": "Moderateur", "color": 3447003, "...": "..."}]
}
```

---

### `GET /guilds/{guild_id}/premium`

Verifie si un serveur a un abonnement premium actif et quel utilisateur l'a lie.

**Auth :** guild_access

**Reponse (premium actif) :**
```json
{
  "guild_id": "123456789",
  "is_premium": true,
  "subscriber_id": "987654321098765432",
  "tier": "monthly",
  "expires_at": "2026-07-01T00:00:00+00:00",
  "linked_at": "2026-06-01T12:34:56+00:00"
}
```

**Reponse (pas de premium) :**
```json
{
  "guild_id": "123456789",
  "is_premium": false,
  "subscriber_id": null,
  "tier": null,
  "expires_at": null,
  "linked_at": null
}
```

**Logique :**
1. Lit `guilds.attributes` pour `PREMIUM`
2. Joint `subscription_servers` + `users` sur `server_id` pour trouver l'abonne dont l'abonnement est encore actif (`subscription_tier IS NOT NULL AND subscription_expires_at > NOW()`)
3. Si un subscriber actif est trouve, `is_premium = true` meme si l'attribut `PREMIUM` n'est pas encore positionne

---

### `PATCH /guilds/{guild_id}/settings`

Modifie la config du serveur (merge dans le champ JSONB `data`).

**Auth :** guild_access
**Body (JSON) :** objet a merger dans `guilds.data`

```json
{
  "some_setting": "value",
  "nested": {"key": true}
}
```

**Actions declenchees :**
1. `UPDATE guilds SET data = data || $2::jsonb WHERE guild_id = $1`
2. Invalide le cache : `DEL guild:{id}:config`
3. Notifie le bot : `PUBLISH moddy:bot {"type": "config_updated", "guild_id": 123}`

**Reponse :**

```json
{"guild_id": 123456789, "status": "updated"}
```

---

## Modules

### `GET /guilds/{guild_id}/modules`

Retourne toutes les configs modules du serveur.

**Auth :** guild_access
**Reponse :** objet avec chaque module_id comme cle

```json
{
  "starboard": {"channel_id": 999, "reaction_count": 5, "emoji": "⭐"},
  "welcome_channel": {"channel_id": 888, "message_template": "Bienvenue {user} !"},
  "auto_role": {"role_ids": [111, 222]}
}
```

Retourne `{}` si aucun module configure.

---

### `GET /guilds/{guild_id}/modules/{module_id}`

Config d'un module specifique.

**Auth :** guild_access
**Path params :**

| Param | Type | Description |
|---|---|---|
| `module_id` | string | ID du module (`starboard`, `welcome_channel`, etc.) |

**Reponse :**

```json
{"channel_id": 999, "reaction_count": 5, "emoji": "⭐"}
```

**Erreur :** `404 {"error": "Module introuvable"}`

---

### `PUT` / `PATCH /guilds/{guild_id}/modules/{module_id}`

Modifier la config d'un module. Remplace entierement la config du module. `PUT`
et `PATCH` sont equivalents ici.

**Auth :** guild_access
**Body (JSON) :** nouvelle config complete du module

```json
{
  "channel_id": 999,
  "reaction_count": 3,
  "emoji": "🌟",
  "update_panel": true
}
```

**Validation par schema (Module Registry) :** si le module a un `ModuleSpec`
enregistre (`app/modules/specs/<module_id>.py`), le body est valide contre son
schema Pydantic avant ecriture — un body invalide renvoie **422**. Les modules
sans spec sont stockes tels quels (passthrough legacy, aucune validation).

**Actions declenchees :**
1. Validation du body contre le schema du module (si enregistre)
2. `UPDATE guilds SET data = jsonb_set(data, '{modules,starboard}', $3::jsonb) WHERE guild_id = $1`
3. Invalide le cache : `DEL guild:{id}:config`
4. Notifie le bot (Pub/Sub) : `PUBLISH moddy:bot {"type": "module_updated", "guild_id": 123, "module_id": "starboard"}`
5. Execute le hook `on_save` du module (si defini) — ex: appliquer un slowmode Discord
6. Si `update_panel: true` dans le body → ajoute une tache critique (Redis Stream) : `XADD moddy:tasks * type update_panel guild_id 123 payload {...}`

**Reponse :** config mise a jour

```json
{"channel_id": 999, "reaction_count": 3, "emoji": "🌟"}
```

---

### `GET /guilds/{guild_id}/modules/schemas`

Schemas JSON de **tous** les modules pilotes par schema (registry complet). Le
dashboard s'en sert pour generer ses formulaires automatiquement.

**Auth :** guild_access
**Reponse :** `{ "<module_id>": <json_schema>, ... }`

---

### `GET /guilds/{guild_id}/modules/{module_id}/schema`

Schema JSON d'un seul module pilote par schema (genere via Pydantic
`model_json_schema()`). **404** si le module n'a pas de `ModuleSpec` enregistre.

**Auth :** guild_access

---

### `DELETE /guilds/{guild_id}/modules/{module_id}`

Desactive un module (supprime sa config).

**Auth :** guild_access
**Actions declenchees :**
1. `UPDATE guilds SET data = data #- '{modules,starboard}' WHERE guild_id = $1`
2. Invalide le cache
3. Notifie le bot : `PUBLISH moddy:bot {"type": "module_disabled", ...}`

**Reponse :**

```json
{"guild_id": 123456789, "module_id": "starboard", "status": "disabled"}
```

---

## Module — Adaptive Slowmode

Le module `adaptive_slowmode` ajuste automatiquement le délai d'envoi d'un salon Discord en fonction de son activité, dans les bornes `min_delay` / `max_delay` définies par le serveur. C'est le **module de référence du Module Registry** : sa validation (valeurs Discord valides) et son effet de bord (application immédiate du slowmode) sont déclarés via un `ModuleSpec` dans `app/modules/specs/adaptive_slowmode.py`. La sauvegarde de la config complète passe donc par le endpoint **générique** `PUT /guilds/{id}/modules/adaptive_slowmode`. Seules les sous-ressources « par salon » (`/channels/{id}`) gardent un routeur dédié.

**Application immédiate :** à la réception d'une config (`PUT` complet ou par salon), le backend applique tout de suite le **slowmode minimal** (`min_delay`) sur le ou les salons concernés via l'API Discord (`PATCH /channels/{id}` avec le token du bot). Cette opération est best-effort : si Discord refuse (permission `MANAGE_CHANNELS` manquante, salon introuvable...), la config reste persistée et la requête réussit quand même — l'échec est seulement loggué côté backend.

**Valeurs de delay valides (secondes) :** `0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600`

**Structure stockée en DB** (`guilds.data.modules.adaptive_slowmode`) :

```json
{
  "channels": {
    "123456789012345678": {
      "min_delay": 0,
      "max_delay": 30,
      "sensitivity": "high"
    },
    "987654321098765432": {
      "min_delay": 5,
      "max_delay": 300,
      "sensitivity": "low"
    }
  }
}
```

---

### `GET /guilds/{guild_id}/modules/adaptive_slowmode`

Config complète du module. Endpoint générique (voir `GET /guilds/{guild_id}/modules/{module_id}`).

**Auth :** guild_access
**Reponse :** config du module ou `404` si jamais configuré.

```json
{
  "channels": {
    "123456789012345678": {"min_delay": 0, "max_delay": 30, "sensitivity": "high"}
  }
}
```

---

### `PUT /guilds/{guild_id}/modules/adaptive_slowmode`

Sauvegarde complète de la config (remplace tout le module d'un coup). Sert via
le endpoint générique `PUT/PATCH /guilds/{id}/modules/{module_id}` : validation
contre le schéma du `ModuleSpec`, puis exécution du hook `on_save` qui applique
le slowmode minimal de chaque salon.

**Auth :** guild_access
**Body :**

```json
{
  "channels": {
    "123456789012345678": {
      "min_delay": 0,
      "max_delay": 30,
      "sensitivity": "high"
    },
    "987654321098765432": {
      "min_delay": 5,
      "max_delay": 300,
      "sensitivity": "low"
    }
  }
}
```

**Champs du body :**

| Champ | Type | Contrainte |
|---|---|---|
| `channels` | object | Au moins 1 entrée |
| clé | string | Snowflake Discord valide (numérique) |
| `min_delay` | int | Parmi les valeurs Discord valides (`0 ≤ x ≤ 21600`) |
| `max_delay` | int | Parmi les valeurs Discord valides, doit être `> min_delay` |
| `sensitivity` | string | `"low"` \| `"medium"` \| `"high"` |

**Actions déclenchées :**
1. `UPDATE guilds SET data = jsonb_set(data, '{modules,adaptive_slowmode}', $2::jsonb) WHERE guild_id = $1`
2. Invalide le cache : `DEL guild:{id}:config`
3. Notifie le bot (Pub/Sub) : `PUBLISH moddy:bot {"type": "module_updated", "guild_id": 123, "module_id": "adaptive_slowmode"}`

**Reponse :** config complète mise à jour

```json
{
  "channels": {
    "123456789012345678": {"min_delay": 0, "max_delay": 30, "sensitivity": "high"}
  }
}
```

**Erreurs :** `422` validation, `404` serveur introuvable

---

### `PUT /guilds/{guild_id}/modules/adaptive_slowmode/channels/{channel_id}`

Ajoute ou met à jour la config d'un seul salon.

**Auth :** guild_access
**Path params :**

| Param | Type | Description |
|---|---|---|
| `channel_id` | string | Snowflake Discord du salon (numérique) |

**Body :**

```json
{
  "min_delay": 0,
  "max_delay": 60,
  "sensitivity": "medium"
}
```

**Actions déclenchées :**
1. `UPDATE guilds SET data = jsonb_set(data, '{modules,adaptive_slowmode,channels,<channel_id>}', $3::jsonb, true)`
2. Invalide le cache + notifie le bot

**Reponse :** config complète du module après mise à jour

```json
{
  "channels": {
    "123456789012345678": {"min_delay": 0, "max_delay": 60, "sensitivity": "medium"}
  }
}
```

**Erreurs :** `400` channel_id invalide, `422` validation, `404` serveur introuvable

---

### `DELETE /guilds/{guild_id}/modules/adaptive_slowmode/channels/{channel_id}`

Supprime la config d'un seul salon.

**Auth :** guild_access
**Path params :**

| Param | Type | Description |
|---|---|---|
| `channel_id` | string | Snowflake Discord du salon (numérique) |

**Actions déclenchées :**
1. `UPDATE guilds SET data = data #- '{modules,adaptive_slowmode,channels,<channel_id>}'`
2. Invalide le cache + notifie le bot

**Reponse :**

```json
{"guild_id": "123456789", "channel_id": "123456789012345678", "status": "removed"}
```

**Erreur :** `400` channel_id invalide

---

### `DELETE /guilds/{guild_id}/modules/adaptive_slowmode`

Désactive le module entier. Endpoint générique (voir `DELETE /guilds/{guild_id}/modules/{module_id}`).

**Reponse :**

```json
{"guild_id": "123456789", "module_id": "adaptive_slowmode", "status": "disabled"}
```

---

## Module — Social Notifications

Le module `social_notifications` poste une notification Discord dès qu'un compte social suivi (YouTube, Twitch, Bluesky, RSS ; Instagram réservé) publie du nouveau contenu. La détection est faite par le service `moddy-feeds`, auquel **seul le bot** parle. Le backend **ne touche jamais** les streams `feeds:*` ni la table `social_subscriptions` en écriture : il **délègue** chaque écriture au bot via une tâche sur `moddy:tasks`, puis attend le résultat publié par le bot sur le Pub/Sub `moddy:dashboard` (corrélé par `request_id`). La lecture des abonnements se fait directement sur la table partagée. Détails complets : `docs/SOCIAL_NOTIFICATIONS.md`.

La **config globale** du module (`enabled`, `default_message`) passe par le endpoint générique des modules (`PUT /guilds/{id}/modules/social_notifications`). Les **abonnements** ci-dessous sont une sous-ressource dédiée.

### `GET /guilds/{guild_id}/modules/social_notifications/subscriptions`

Liste les abonnements de la guilde. Query optionnelle `?platform=youtube|twitch|bluesky|rss|instagram`. Lecture directe de la table `social_subscriptions`.

**Reponse :**

```json
[
  {
    "id": 12,
    "guild_id": "123456789",
    "platform": "youtube",
    "target_id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
    "identifier": "@mrbeast",
    "display_name": "MrBeast",
    "avatar_url": "https://...",
    "channel_id": "987654321",
    "message": null,
    "mention_role_ids": ["111", "222"],
    "poll_interval": 60,
    "enabled": true,
    "embed_color": null,
    "show_avatar": true,
    "show_media": true,
    "created_by": "555",
    "created_at": "2026-06-14T10:00:00Z",
    "updated_at": "2026-06-14T10:00:00Z"
  }
]
```

### `POST /guilds/{guild_id}/modules/social_notifications/subscriptions`

Crée (ou ré-active) un abonnement. Émet une tâche `social_subscribe` au bot, qui résout la cible via le service, calcule le `poll_interval` selon le premium de la guilde, écrit la table et émet la commande Redis. La réponse est le résultat **résolu** par le bot.

**Corps :**

```json
{
  "platform": "youtube",
  "identifier": "@mrbeast",
  "channel_id": 987654321,
  "message": "## <:youtube:…> Nouvelle vidéo !\n{author} a posté {title}\n{url}",
  "mention_role_ids": [111, 222],
  "embed_color": 16711680,
  "show_avatar": true,
  "show_media": true
}
```

- `message` ≤ 1500 car. Corps complet de la notification (heading Markdown inclus). `NULL` ⇒ le bot utilise le template par défaut de la plateforme. Placeholders : `{author}` `{title}` `{url}` (alias `{link}`) `{platform}` `{timestamp}` (unix epoch, ex. `<t:{timestamp}:R>`). Disponibilité des placeholders varie par plateforme — voir `docs/SOCIAL_NOTIFICATIONS.md`.
- `embed_color` : entier 24-bit (`#FF0000` → `16711680`). `NULL` = couleur de marque de la plateforme.
- `show_avatar` / `show_media` : exposer uniquement pour les plateformes qui les supportent.
- `channel_id` / `mention_role_ids` sont des snowflakes Discord.

**Reponse (succès) :**

```json
{
  "type": "social_subscribe_result", "request_id": "…", "guild_id": 123,
  "ok": true, "platform": "youtube", "target_id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "display_name": "MrBeast", "avatar_url": "https://..."
}
```

### `PATCH /guilds/{guild_id}/modules/social_notifications/subscriptions/{platform}/{target_id}`

Modifie salon / rôles / message / pause d'un abonnement (DB only — la cible reste souscrite côté service). Émet une tâche `social_update`. Tous les champs sont optionnels ; seuls ceux fournis sont transmis.

**Corps :**

```json
{ "channel_id": 987654321, "message": "…", "mention_role_ids": [333], "enabled": false,
  "embed_color": null, "show_avatar": true, "show_media": false }
```

`enabled=false` met en pause (le dispatch ignore la ligne) sans désabonner la cible. `embed_color: null` réinitialise à la couleur de marque de la plateforme.

### `DELETE /guilds/{guild_id}/modules/social_notifications/subscriptions/{platform}/{target_id}`

Supprime un abonnement. Émet une tâche `social_remove` ; le bot supprime la ligne puis réconcilie la cible côté service (unsubscribe total si plus aucune guilde ne la suit, sinon recalcul du `poll_interval`).

### Codes d'erreur (abonnements)

La réponse du bot `{"ok": false, "error": "<code>"}` est mappée :

| Cas | HTTP | Détail |
|---|---|---|
| `guild_not_found` | `404` | — |
| `module_unavailable`, `twitch_not_configured`, `twitch_auth_failed`, `fetch_failed`, `bad_status`, `internal_error` | `502` | — |
| `limit_reached_free` | `422` | `{"error":"limit_reached_free","limit":1}` — quota 1 compte/plateforme dépassé |
| `limit_reached_premium` | `422` | `{"error":"limit_reached_premium","limit":5}` — quota 5 comptes/plateforme dépassé |
| autres (`unknown_platform`, `platform_disabled`, `channel_not_found`, `user_not_found`, `handle_not_found`, `unsafe_url`, `no_entries`, `missing_identifier`, `not_supported`, …) | `422` | — |
| Bot ne répond pas dans le délai | `504` | `bot_timeout` |

---

## Cases (moderation)

Schéma unifié `cases`/`case_sanctions`/`case_events`/`case_appeals`, partagé avec
le bot. **Lecture** en SQL direct ; **écriture** directe en base pour les cases
globales/réseau (référence unique, event `sanction_added`, recalcul de statut
réimplémentés). Les cases `guild` sont éditables (raison/statut/notes en direct DB)
mais leurs **sanctions** sont déléguées au bot via `moddy:tasks`. Détails :
`docs/MODERATION_CASES.md` (§4.2). **Note :** `case_type = platform` et
`sanction_action = kick` sont retirés du flux actif (lecture d'historique seulement).

### `GET /cases/meta`

Métadonnées pour construire les formulaires côté dashboard (source unique alignée
sur le bot). **Auth : utilisateur connecté.**

**Réponse :**
- `case_type_actions` : map `case_type → [actions autorisées]` (`global` → `warn`,
  `restrict`, `ban` ; `network` → `warn`, `mute`, `ban` ; etc.)
- `temporary_actions` : actions acceptant un `expires_at` (`ban`, `mute`, `restrict`)
- `writable_case_types` : types dont les sanctions s'écrivent en direct DB (`global`, `network`)
- `legacy` : valeurs encore dans les ENUM Postgres mais retirées du flux actif
  (`case_type: ["platform"]`, `sanction_action: ["kick"]`) — à afficher en lecture
  seule pour l'historique, à **exclure** des pickers de création/édition
- `enums` : toutes les valeurs d'enum, historique inclus (`case_type`, `subject_type`,
  `scope_type`, `sanction_action`, `sanction_status`, `case_status`, `event_type`,
  `appeal_route`, `appeal_status`)

> Le front doit construire ses pickers à partir de cet endpoint plutôt que de coder
> les listes en dur : ainsi backend, bot et dashboard restent alignés.

---

### `GET /cases`

Recherche filtrée + paginée. **Auth : utilisateur connecté.**

- **Staff** : voit toutes les cases, filtres libres.
- **Utilisateur normal** : périmètre restreint automatiquement aux cases qui le
  concernent (sujet = lui) et à celles des serveurs qu'il administre. Les filtres
  s'appliquent à l'intérieur de ce périmètre.

**Query params (tous optionnels) :**

| Param | Type | Description |
|---|---|---|
| `subject_type` | enum | `discord_user` / `discord_guild` / `moddy_user` / `external` |
| `subject_id` | string | ID (TEXT) du sujet visé |
| `scope_type` | enum | `discord_guild` / `network` / `platform` / `external_service` |
| `scope_id` | string | ID du scope (ex: guild_id) |
| `type` | enum | `global` / `network` / `guild` / `platform` / `external` |
| `status` | enum | `open` / `closed` |
| `action` | enum | `warn`/`mute`/`ban`/`kick`/`restrict`/`revoke_access` (au moins une sanction avec cette action) |
| `issuer_type` | string | Type d'émetteur |
| `issuer_id` | string | ID de l'émetteur |
| `group_id` | uuid | Affaire liée (plusieurs cases) |
| `since` / `until` | datetime ISO | Bornes sur `created_at` |
| `q` | string, 1–200 | Recherche texte libre (insensible à la casse) sur la `reference` publique OU un sous-texte de `reason` |
| `limit` | int | 1–100, défaut 50 |
| `offset` | int | Défaut 0 |

Exemples : `?scope_type=discord_guild&scope_id=123` (cases d'un serveur),
`?subject_type=discord_user&subject_id=456` (cases d'un membre), `?type=global`,
`?q=A7F2K9` (retrouve la case par sa référence publique), `?q=spam` (cases dont
la raison contient "spam").

**Réponse :** array de cases. Chaque case inclut `actions` (array des actions de
ses sanctions) et `has_active` (bool).

```json
[
  {
    "id": "3f9c...-uuid", "reference": "A7F2K9", "type": "global",
    "subject_type": "discord_user", "subject_id": "123456789",
    "issuer_type": "moddy_staff", "issuer_id": "987654321",
    "scope_type": "platform", "scope_id": null,
    "reason": "Spam massif", "status": "open", "status_locked": false,
    "group_id": null, "created_at": "2026-07-01T00:00:00+00:00",
    "updated_at": "2026-07-01T00:00:00+00:00",
    "actions": ["ban"], "has_active": true
  }
]
```

---

### `GET /cases/{identifier}`

Détail complet d'une case par sa **référence publique** (6 car.) ou son **UUID**.
Renvoie le dossier + `sanctions` + `events` (timeline) + `appeals`.

**Auth :** utilisateur connecté (staff, ou sujet du case, ou admin du serveur scopé).
Un utilisateur qui consulte uniquement SON propre case ne reçoit pas les
commentaires/notes ni les champs internes des appels. Case hors périmètre → **404**.

**Path params :**

| Param | Type | Description |
|---|---|---|
| `identifier` | string | Référence 6 car. (ex: `A7F2K9`) ou UUID |

---

### `GET /cases/{identifier}/evidence`

Preuves **affichables** d'une case (projection alignée sur le bot). **Auth :** même
visibilité que `GET /cases/{identifier}`.

Renvoie les `case_events` de `type='evidence'` portant soit une `payload.url`,
soit `payload.kind == "message_link"` (les events d'évidence internes — contexte
automod sans ces clés — sont exclus : ils restent dans la timeline via
`GET /cases/{id}`).

**Réponse :** array, deux formes selon `kind` :

- Pièce jointe classique (`image`/`video`/`evidence`) : `{ event_id, created_at,
  author_type, author_id, url, kind, media }`. `media=true` si l'URL finit par une
  extension média (`.png/.jpg/.jpeg/.gif/.webp/.mp4/.webm/.mov`) → à afficher en
  galerie ; sinon lien cliquable préfixé par `kind`.
- Lien de message (`kind: "message_link"`) — snapshot figé au moment de l'ajout,
  jamais mis à jour ensuite (le message a pu être édité/supprimé depuis) :
  `{ event_id, created_at, author_type, author_id, kind: "message_link", jump_url,
  channel_id, message_id, content, message_author_id, message_author_name,
  attachments: string[], message_created_at }`. `author_id`/`author_type` =
  modérateur qui a ajouté la preuve ; `message_author_id`/`message_author_name` =
  auteur du message cité. `content` peut être `""`. `message_created_at` = epoch
  seconds de création du message d'origine (≠ `created_at`, qui est l'ajout de la
  preuve). `attachments` = URLs CDN Discord brutes, peuvent expirer.

---

### `POST /cases`

Crée une case **globale ou réseau** + sa première sanction. **Auth : staff avec
permission de modération.**

**Body :** `{ case_type: "global"|"network", subject_type, subject_id, scope_type,
scope_id?, reason, action, expires_at?, note?, group_id? }`

**Validation `action` (alignée sur le bot, cf. `GET /cases/meta`) :**
- `action` doit appartenir à `case_type_actions[case_type]` (ex. `global` → seulement
  `warn`/`restrict`/`ban`) — sinon **422**.
- `expires_at` n'est accepté que pour `ban`/`mute`/`restrict` (actions temporisables) —
  sinon **422**.

**Réponse :** `201` — le case complet (dossier + `sanctions` + `events`).

---

### `PATCH /cases/{identifier}`

Modifie la `reason` et/ou le `status` d'une case (`global`, `network` **ou `guild`** —
l'édition n'a aucun effet Discord). Fixer un `status` **verrouille** la case
(`status_locked`, plus de recalcul auto). **Auth : staff mod.** Body :
`{ reason?, status? }`. Réponse : le case complet.

### `POST /cases/{identifier}/sanctions`

Ajoute une sanction (rouvre le case si nécessaire). **Auth : staff mod.**
Body : `{ action, expires_at?, note? }`. Même validation `action`×`type` que
`POST /cases` (selon le `type` de la case existante).
- Cases `global`/`network` : écriture directe, réponse `201` (case complet).
- Cases `guild` : **déléguée au bot** (il applique le ban/timeout + DM). Réponse `201`
  (case complet renvoyé par le bot). Erreurs : `504 bot_timeout` si le bot ne répond
  pas, `502` si l'action Discord échoue. Voir `docs/MODERATION_CASES.md` §4.2.

### `POST /cases/{identifier}/sanctions/{sanction_id}/revoke`

Révoque une sanction ; le statut du case est recalculé automatiquement.
**Auth : staff mod.** Body : `{ note? }`. Réponse : le case complet. Cases `guild` :
**déléguée au bot** (unban / retrait timeout), mêmes codes d'erreur que l'ajout.

### `POST /cases/{identifier}/notes`

Ajoute un commentaire à la timeline (interne, sans effet Discord ; `global`/`network`/`guild`).
**Auth : staff mod.** Body : `{ content }`.
Réponse `201` : le case complet.

---

## Logging

### `GET /guilds/{guild_id}/logging`

Config logging du serveur (stockee comme `guilds.data.modules.logging`).

**Auth :** guild_access
**Reponse :**

```json
{
  "guild_id": 123456789,
  "config": {
    "channel_id": 777888999,
    "events": ["message_delete", "member_join", "member_leave"]
  }
}
```

---

### `PATCH /guilds/{guild_id}/logging`

Modifier la config logging.

**Auth :** guild_access
**Body :** nouvelle config

```json
{
  "channel_id": 777888999,
  "events": ["message_delete", "member_join"]
}
```

**Actions :** met a jour `guilds.data.modules.logging`, invalide cache, notifie bot
**Reponse :**

```json
{
  "guild_id": 123456789,
  "config": {"channel_id": 777888999, "events": ["message_delete", "member_join"]}
}
```

---

## Stats

### `GET /guilds/{guild_id}/stats`

Stats de base d'un serveur.

**Auth :** guild_access
**Reponse :**

```json
{
  "guild_id": 123456789,
  "is_premium": true,
  "total_cases": 15,
  "open_cases": 3
}
```

---

## Banners

### `GET /banners/active`

Retourne la banniere actuellement active, ou `null` si aucune n'est active.

**Auth :** aucune
**Cache :** Redis `moddy:banner:active` TTL 60s (invalide a chaque activation/desactivation/modification/suppression)

**Reponse (banniere active) :**

```json
{
  "id": 3,
  "message": "Maintenance prevue le 28 mai de 02h a 04h UTC.",
  "type": "maintenance",
  "icon_svg": null,
  "color": null,
  "show_dashboard": true,
  "show_website": true,
  "is_active": true,
  "updated_at": "2026-05-27T10:00:00+00:00"
}
```

**Reponse (aucune banniere active) :** `null`

Le frontend doit cacher le bandeau si la reponse est `null` ou si le champ correspondant a sa surface (`show_dashboard` / `show_website`) est `false`.

**Types predéfinis (`type`) :**

| Valeur | Usage |
|---|---|
| `announcement` | Annonce generale |
| `incident` | Incident en cours |
| `maintenance` | Maintenance planifiee |
| `information` | Info neutre |
| `warning` | Avertissement |
| `resolved` | Incident resolu |

**Banniere custom (`type = null`) :** `icon_svg` contient le SVG brut, `color` contient la couleur hex `#RRGGBB`.

---

## Users (public)

### `GET /users/{user_id}`

Retourne les informations publiques d'un utilisateur Discord via le bot token. Endpoint public, sans authentification, concu pour la documentation et les intégrations tierces.

**Auth :** aucune
**Cache :** Redis `discord:user:{user_id}` TTL 5min
**Path params :**

| Param | Type | Description |
|---|---|---|
| `user_id` | int | ID Discord de l'utilisateur (Snowflake) |

**Reponse :**

```json
{
  "user_id": "123456789012345678",
  "username": "johndoe",
  "global_name": "John Doe",
  "discriminator": "0",
  "avatar": "a_d5efa99b3eeaa7dd43acca82f5692432",
  "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/a_d5efa99b3eeaa7dd43acca82f5692432.gif?size=256",
  "banner": null,
  "banner_url": null,
  "accent_color": 5793266,
  "avatar_decoration_data": {
    "asset": "a_abc123def456",
    "sku_id": "123456789",
    "asset_url": "https://cdn.discordapp.com/avatar-decoration-presets/a_abc123def456.png"
  },
  "public_flags": 4194304,
  "badges": ["ACTIVE_DEVELOPER"],
  "bot": false
}
```

**Champs :**

| Champ | Type | Description |
|---|---|---|
| `user_id` | string | Discord ID (Snowflake) |
| `username` | string | Nom d'utilisateur Discord (unique) |
| `global_name` | string\|null | Nom d'affichage |
| `discriminator` | string | Discriminateur (`"0"` sur les nouveaux comptes) |
| `avatar` | string\|null | Hash de l'avatar |
| `avatar_url` | string\|null | URL CDN (`.png` ou `.gif` si hash commence par `a_`), `?size=256` |
| `banner` | string\|null | Hash de la banniere de profil |
| `banner_url` | string\|null | URL CDN de la banniere |
| `accent_color` | int\|null | Couleur d'accent (valeur RGB entiere) |
| `avatar_decoration_data` | object\|null | Decoration d'avatar : `asset`, `sku_id`, `asset_url` (URL CDN calculee) |
| `public_flags` | int\|null | Bitmask des flags publics |
| `badges` | string[] | Noms lisibles des flags publics actifs (meme valeurs que `discord_badges` dans `/auth/me`) |
| `bot` | bool | `true` si compte bot |

**Erreurs :**

| Code | Description |
|---|---|
| `404` | Utilisateur introuvable sur Discord |
| `429` | Rate limit Discord atteint |
| `502` | Erreur API Discord |
| `503` | Bot token non configure |

---

### `GET /users/{user_id}/profile`

Profil enrichi d'un **autre** utilisateur : identité Discord publique + statut Moddy
(premium, staff). **Auth : utilisateur connecté.** Ne divulgue aucune donnée
sensible (email, client Stripe, cases privées).

**Réponse :** tous les champs de `GET /users/{user_id}` + :

| Champ | Type | Description |
|---|---|---|
| `display_name` | string | `global_name` sinon `username` |
| `is_premium` | bool | Abonnement actif OU attribut `PREMIUM` |
| `is_beta` | bool | Attribut `BETA` |
| `is_staff` | bool | Membre du staff Moddy |
| `staff_roles` | string[] | Rôles staff (vide si non-staff) |
| `in_database` | bool | L'utilisateur existe dans `users` |

---

### `GET /guilds/{guild_id}/profile`

Infos publiques d'un **autre** serveur : identité + statut premium. Contrairement à
`GET /guilds/{id}` (réservé aux serveurs de l'utilisateur), n'expose que les
métadonnées publiques. **Auth : utilisateur connecté.**

**Réponse :** `guild_id`, `name`, `icon`, `banner`, `splash`, `description`,
`member_count`, `presence_count`, `features`, `vanity_url_code`, `is_premium`,
`is_beta`, `in_database`.

---

## Redirections

### `GET /redirects/lookup?domain={domain}&path={path}`

Retourne une redirection si elle existe pour le couple domaine + path, `null` sinon.

**Auth :** aucune
**Query params :**

| Param | Type | Description |
|---|---|---|
| `domain` | string | Domaine sans protocole, ex : `moddy.app` |
| `path` | string | Chemin absolu prefixe par `/`, ex : `/privacy` |

**Reponse (redirection trouvee) :**

```json
{
  "id": 1,
  "domain": "moddy.app",
  "path": "/privacy",
  "description": "Privacy policy"
}
```

**Reponse (aucune redirection) :** `null`

Le site appelle cet endpoint avant d'afficher une 404 pour verifier si le chemin courant est une redirection connue.

---

## Health

### `GET /health`

**Auth :** aucune
**Reponse :**

```json
{"status": "healthy", "environment": "production"}
```

### `GET /`

**Auth :** aucune
**Reponse :**

```json
{"message": "Moddy Backend API", "version": "2.0.0", "status": "running"}
```

---

## Stripe

Les abonnements Stripe sont lies a l'**utilisateur** (pas au serveur directement — le lien user ↔ serveurs se fait via `subscription_servers`).

### Flux client Stripe (commun a checkout et portal)

Les deux endpoints (`/create-checkout` et `/portal`) appliquent le meme flux de resolution du client :

1. Lecture de `users.stripe_customer_id` dans la DB (par `user_id` Discord)
2. Si present : le client Stripe existant est reutilise
3. Si absent : creation d'un nouveau client Stripe avec l'email Discord + metadata `discord_id` (ex: `"discord_id": "1164597199594852395"`), puis sauvegarde de `stripe_customer_id` dans `users`

Ce mecanisme garantit qu'un seul client Stripe existe par utilisateur Discord.

---

### `POST /stripe/create-checkout`

Cree une session Stripe Checkout pour un abonnement premium utilisateur.

**Auth :** session cookie
**Body :**

```json
{
  "plan": "monthly",
  "return_url": "https://dashboard.moddy.app/premium"
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `plan` | string | non | `"monthly"` (defaut) ou `"yearly"` |
| `return_url` | string | non | URL de base pour les redirections post-paiement (defaut: `https://moddy.app/dashboard`) |

**Flux interne :**
1. Resolution du client Stripe (voir flux commun ci-dessus)
2. Creation de la session Checkout liee a ce client — l'email est pre-rempli depuis le compte Stripe, l'utilisateur ne peut pas le modifier
3. `success_url` = `{return_url}?premium=success`
4. `cancel_url` = `{return_url}?premium=cancel`

**Redirections post-paiement :**

| Query param | Valeur | Declenchement |
|---|---|---|
| `premium` | `success` | Paiement valide, abonnement actif |
| `premium` | `cancel` | Utilisateur a ferme la page Stripe sans payer |

**Reponse :**

```json
{"url": "https://checkout.stripe.com/c/pay/cs_test_xxx"}
```

Le frontend redirige l'utilisateur vers cette URL.

---

### `POST /webhooks/stripe`

Webhook Stripe principal. **Pas d'auth session** — authentifie via `Stripe-Signature`.

**Headers requis :** `Stripe-Signature: t=...,v1=...`
**Body :** raw JSON (ne pas parser avant la verification de signature)

**Comportement :**
- Verifie la signature → 400 si invalide
- Controle l'idempotence (Redis SET NX, TTL 7j) — double livraison ignoree silencieusement
- Retourne 200 immediatement, traite en arriere-plan (`BackgroundTasks`)

**Events traites :**

| Event | Action DB | Redis | Pub/Sub |
|---|---|---|---|
| `invoice.payment_succeeded` | `subscription_tier` + `subscription_expires_at` mis a jour | Ecrit `sub:user:{id}` avec TTL | `notify_subscription_started` ou `notify_subscription_renewed` |
| `customer.subscription.deleted` | `subscription_tier = NULL`, `subscription_expires_at = NOW()` | Supprime `sub:user:{id}` | `refresh` |
| `invoice.payment_failed` | Aucune modification | Aucune modification | `notify_payment_late` |

**Reponse :**

```json
{"received": true}
```

---

### `POST /stripe/webhook` *(legacy)*

Ancien endpoint conserve pour compatibilite. Ne traite plus les evenements — loggue uniquement.
Privilegier `POST /webhooks/stripe`.

---

### `GET /stripe/subscription`

Statut d'abonnement complet de l'utilisateur connecte.

**Auth :** session cookie

**Reponse :**

```json
{
  "user_id": "123456789012345678",
  "tier": "monthly",
  "expires_at": "2026-06-01T00:00:00+00:00",
  "is_active": true,
  "stripe_customer_id": "cus_UAf6a2WKTw6yCI",
  "servers": [
    {"server_id": "111222333444555666", "added_at": "2026-05-01T00:00:00+00:00"},
    {"server_id": "999888777666555444", "added_at": "2026-05-10T14:30:00+00:00"}
  ],
  "max_servers": 5
}
```

| Champ | Type | Description |
|---|---|---|
| `tier` | string\|null | `"monthly"`, `"yearly"`, `"free_trial"` ou `null` si pas d'abonnement |
| `expires_at` | ISO 8601\|null | Date d'expiration UTC ; `null` = pas d'expiration (lifetime) |
| `is_active` | bool | `tier != null AND (expires_at == null OR expires_at > now())` |
| `stripe_customer_id` | string\|null | ID client Stripe |
| `servers` | array | Serveurs lies a l'abonnement |
| `max_servers` | int | Limite maximale (actuellement 5) |

---

### `GET /stripe/subscription/servers`

Liste les serveurs lies a l'abonnement de l'utilisateur.

**Auth :** session cookie

**Reponse :**

```json
{
  "servers": [
    {"server_id": "111222333444555666", "added_at": "2026-05-01T00:00:00+00:00"}
  ],
  "count": 1,
  "max_servers": 5
}
```

---

### `POST /stripe/subscription/servers`

Lie un serveur a l'abonnement de l'utilisateur.

**Auth :** session cookie
**Conditions :**
- L'abonnement doit etre actif
- Le serveur doit etre dans la liste des guilds de session (admin + bot present)
- Limite de 5 serveurs par abonnement

**Body :**

```json
{"server_id": "111222333444555666"}
```

**Reponse (201-like) :**

```json
{"server_id": "111222333444555666", "added_at": "2026-05-26T12:00:00+00:00"}
```

**Erreurs :**

| Code | Description |
|---|---|
| `400` | `server_id` manquant ou invalide |
| `403` | Acces au serveur refuse ou bot absent |
| `403` | Abonnement inactif |
| `409` | Limite de 5 serveurs atteinte |
| `409` | Serveur deja lie |

**Actions :** INSERT dans `subscription_servers` + publie `refresh` sur `moddy:subscription:updates`

---

### `DELETE /stripe/subscription/servers/{server_id}`

Delie un serveur de l'abonnement.

**Auth :** session cookie
**Path params :**

| Param | Type | Description |
|---|---|---|
| `server_id` | string | ID Discord du serveur (snowflake) |

**Reponse :**

```json
{"server_id": "111222333444555666", "removed": true}
```

**Erreur :** `404` si le serveur n'est pas dans l'abonnement de l'utilisateur

**Actions :** DELETE dans `subscription_servers` + publie `refresh` sur `moddy:subscription:updates`

---

### `POST /stripe/portal`

Cree une session Stripe Customer Portal pour gerer/annuler l'abonnement.

**Auth :** session cookie
**Body (optionnel) :**

```json
{"return_url": "https://dashboard.moddy.app/premium"}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `return_url` | string | non | URL vers laquelle Stripe redirige quand l'utilisateur clique "Retour" dans le portail (defaut: `https://moddy.app/dashboard`) |

**Flux interne :**
1. Resolution du client Stripe (voir flux commun ci-dessus) — le client est cree si inexistant
2. Creation d'une session Customer Portal liee a ce client
3. `return_url` est fourni a Stripe comme URL de retour du portail

**Reponse :**

```json
{"url": "https://billing.stripe.com/p/session/xxx"}
```

---

## Staff Panel

Tous les endpoints staff necessitent `is_staff: true` dans la session.

### `GET /staff/guilds`

Tous les serveurs de Moddy.

**Auth :** staff
**Query params :**

| Param | Type | Description |
|---|---|---|
| `search` | string | Recherche par ID (LIKE %search%) |
| `limit` | int | Max 200, defaut 50 |
| `offset` | int | Defaut 0 |

**Reponse :** array d'objets guild complets (avec attributes et data)

---

### `GET /staff/guilds/{guild_id}`

Vue detaillee staff d'un serveur.

**Auth :** staff
**Reponse :** objet guild complet

```json
{
  "guild_id": 123456789,
  "attributes": {"PREMIUM": true, "BETA": true},
  "data": {"modules": {...}},
  "created_at": "2024-01-01T00:00:00+00:00",
  "updated_at": "2025-06-15T12:00:00+00:00"
}
```

---

### `PATCH /staff/guilds/{guild_id}`

Modifier les attributs d'un serveur (PREMIUM, BETA, BLACKLISTED, etc.).

**Auth :** staff
**Body :** attributs a modifier

```json
{
  "PREMIUM": true,
  "BETA": null
}
```

- `true` → active l'attribut
- `null` ou `false` → supprime l'attribut

**Actions :** pour chaque attribut modifie, log dans `attribute_changes` (old_value, new_value, changed_by)

**Reponse :** guild mise a jour (objet complet)

---

### `GET /staff/blacklist`

Liste des entités actuellement blacklistées globalement, c.-à-d. les cases
`global`/`platform` portant une sanction `ban` **active** (cf. `docs/MODERATION_CASES.md` §7).

**Projection en lecture uniquement.** Il n'y a **pas** d'endpoint d'écriture dédié :
une blacklist EST une case globale avec un ban. Pour blacklister → `POST /cases`
(`case_type=global`, `scope_type=platform`, `action=ban`) ; pour dé-blacklister →
révoquer la sanction via `POST /cases/{identifier}/sanctions/{sanction_id}/revoke`.

**Auth :** staff
**Query params :** `limit` (max 200), `offset`
**Réponse :** array joignant le case + sa sanction (`reference`, `subject_type/id`,
`action`, `expires_at`, `sanctioned_at`, …).

---

### `GET /staff/users?q={query}`

Recherche d'utilisateurs par ID.

**Auth :** staff
**Query params :**

| Param | Type | Obligatoire | Description |
|---|---|---|---|
| `q` | string | oui | Recherche (match partiel sur user_id) |
| `limit` | int | non | Max 200, defaut 50 |
| `offset` | int | non | Defaut 0 |

**Reponse :**

```json
[
  {"user_id": 123456789, "attributes": {"PREMIUM": true}, "email": null, "created_at": "..."}
]
```

---

### `GET /staff/users/{user_id}`

Profil complet d'un utilisateur (jointure users + staff_permissions + count cases).

**Auth :** staff
**Reponse :**

```json
{
  "user_id": 123456789,
  "attributes": {"PREMIUM": true, "TEAM": true},
  "stripe_customer_id": "cus_xxx",
  "email": "user@example.com",
  "created_at": "2024-01-01T00:00:00+00:00",
  "staff_roles": ["Manager", "Dev"],
  "denied_commands": ["d.sql"],
  "total_cases": 3,
  "open_cases": 1
}
```

---

### `PATCH /staff/users/{user_id}`

Modifier les attributs d'un utilisateur.

**Auth :** staff
**Body :**

```json
{
  "PREMIUM": true,
  "LANG": "EN",
  "BLACKLISTED": null
}
```

**Protection :** l'attribut `TEAM` ne peut PAS etre modifie via cet endpoint (gere automatiquement par le systeme staff).

**Actions :** pour chaque attribut, log dans `attribute_changes`
**Erreur :** `400 {"error": "TEAM est gere automatiquement par le systeme staff"}`

---

### `GET /staff/stats`

Stats globales de Moddy.

**Auth :** staff
**Reponse :**

```json
{
  "total_users": 150000,
  "premium_users": 1200,
  "blacklisted_users": 45,
  "stripe_users": 800,
  "total_guilds": 5000,
  "premium_guilds": 300,
  "total_staff": 12,
  "open_cases": 67
}
```

**Requete SQL sous-jacente :**

```sql
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE attributes ? 'PREMIUM') AS premium_users,
  (SELECT COUNT(*) FROM users WHERE attributes ? 'BLACKLISTED') AS blacklisted_users,
  (SELECT COUNT(*) FROM users WHERE stripe_customer_id IS NOT NULL) AS stripe_users,
  (SELECT COUNT(*) FROM guilds) AS total_guilds,
  (SELECT COUNT(*) FROM guilds WHERE attributes ? 'PREMIUM') AS premium_guilds,
  (SELECT COUNT(*) FROM staff_permissions) AS total_staff,
  (SELECT COUNT(*) FROM cases WHERE status = 'open') AS open_cases;
```

---

### `GET /staff/bot/status`

Statut du bot Discord (appel HTTP interne vers le bot).

**Auth :** staff
**Appel interne :** `GET {BOT_INTERNAL_URL}/status` (timeout 10s)
**Reponse :** JSON retourne directement par le bot (shards, latence, uptime, memoire, etc.)
**Erreur :** `502 {"error": "Bot non disponible"}` ou `502 {"error": "Impossible de joindre le bot"}`

---

### `GET /staff/banners`

Liste toutes les bannières (actives et inactives).

**Auth :** staff
**Query params :** `limit` (max 200, defaut 50), `offset`
**Reponse :** array de bannières triées par `created_at DESC`

```json
[
  {
    "id": 3,
    "message": "Maintenance prevue le 28 mai.",
    "type": "maintenance",
    "icon_svg": null,
    "color": null,
    "show_dashboard": true,
    "show_website": true,
    "is_active": true,
    "created_at": "2026-05-27T09:00:00+00:00",
    "updated_at": "2026-05-27T10:00:00+00:00"
  }
]
```

---

### `POST /staff/banners`

Creer une nouvelle banniere.

**Auth :** staff
**Body :**

Mode typé :

```json
{
  "message": "Maintenance prevue le 28 mai de 02h a 04h UTC.",
  "type": "maintenance",
  "show_dashboard": true,
  "show_website": true
}
```

Mode custom (SVG + couleur) :

```json
{
  "message": "Evenement special ce weekend !",
  "icon_svg": "<svg>...</svg>",
  "color": "#FF6600",
  "show_dashboard": false,
  "show_website": true
}
```

| Champ | Type | Description |
|---|---|---|
| `message` | string | Contenu du bandeau (Markdown supporte cote frontend) |
| `type` | string\|null | Type predéfini. Mutuellement exclusif avec `icon_svg`/`color` |
| `icon_svg` | string\|null | SVG brut. Requis si pas de `type` |
| `color` | string\|null | Hex `#RRGGBB`. Requis si pas de `type` |
| `show_dashboard` | bool | Defaut `true` |
| `show_website` | bool | Defaut `true` |

**Contrainte :** `type` OU (`icon_svg` + `color`) — jamais les deux, jamais ni l'un ni l'autre.
**Reponse :** la banniere creee (status 201), non active par defaut.

---

### `PATCH /staff/banners/{id}`

Modifier le contenu d'une banniere.

**Auth :** staff
**Body :** tous les champs sont optionnels

```json
{
  "message": "Incident resolu.",
  "type": "resolved"
}
```

**Reponse :** la banniere mise a jour
**Erreur :** `404` si introuvable
**Cache :** invalide `moddy:banner:active` si la banniere etait active

---

### `POST /staff/banners/{id}/activate`

Active cette banniere. Desactive automatiquement toute autre banniere active (operation atomique en transaction).

**Auth :** staff
**Reponse :** la banniere activee
**Erreur :** `404` si introuvable
**Cache :** invalide `moddy:banner:active`

---

### `POST /staff/banners/{id}/deactivate`

Desactive cette banniere sans en activer une autre (bandeau cache partout).

**Auth :** staff
**Reponse :** la banniere desactivee
**Erreur :** `404` si introuvable
**Cache :** invalide `moddy:banner:active`

---

### `DELETE /staff/banners/{id}`

Supprime une banniere.

**Auth :** staff
**Reponse :** 204 No Content
**Erreur :** `404` si introuvable
**Cache :** invalide `moddy:banner:active`

---

### `GET /staff/redirects`

Liste toutes les redirections enregistrees.

**Auth :** staff
**Query params :** `limit` (max 500, defaut 100), `offset`
**Reponse :** array de redirections triees par `domain, path`

```json
[
  {
    "id": 1,
    "domain": "moddy.app",
    "path": "/privacy",
    "description": "Privacy policy",
    "added_by": "123456789012345678",
    "added_at": "2026-05-27T09:00:00+00:00"
  }
]
```

---

### `POST /staff/redirects`

Creer une nouvelle redirection.

**Auth :** staff
**Body :**

```json
{
  "domain": "moddy.app",
  "path": "/privacy",
  "description": "Privacy policy"
}
```

| Champ | Type | Description |
|---|---|---|
| `domain` | string | Sans protocole (ex: `moddy.app`) |
| `path` | string | Doit commencer par `/` |
| `description` | string | Description lisible |

**Contraintes :**
- `domain` sans `http://` ni `https://`
- `path` toujours prefixe par `/`
- Paire `(domain, path)` unique — `409` si doublon

**Reponse :** la redirection creee (status 201)
**Erreur :** `409 {"error": "Redirection moddy.app/privacy existe deja"}`

---

### `DELETE /staff/redirects/{id}`

Supprimer une redirection.

**Auth :** staff
**Reponse :** 204 No Content
**Erreur :** `404` si introuvable

---

### `POST /staff/bot/announce`

Envoyer une annonce via le bot (tache critique Redis Stream).

**Auth :** staff
**Body :**

```json
{
  "message": "Maintenance prevue demain a 14h",
  "guild_ids": [111222333, 444555666]
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `message` | string | oui | Contenu de l'annonce |
| `guild_ids` | int[] | non | Serveurs cibles (null = tous) |

**Action :** `XADD moddy:tasks * type send_announcement guild_id 0 payload {"message":"...", "guild_ids":[...], "staff_id":"..."}`

**Reponse :**

```json
{"status": "queued"}
```

---

## Tally — Formulaires

### `POST /webhooks/tally`

Reçoit une soumission Tally. Identifie le formulaire via `formId`, vérifie la signature HMAC-SHA256 (base64) avec le `signing_secret` du formulaire, valide le champ caché `session` pour extraire et authentifier le `discord_id`, puis persiste la soumission et ses réponses.

**Auth :** aucune (signature Tally via `X-Tally-Signature`)

**Headers requis :**

| Header | Description |
|---|---|
| `X-Tally-Signature` | HMAC-SHA256 du body brut, encodé en base64 |

**Payload Tally (exemple) :**

```json
{
  "eventId": "...",
  "eventType": "FORM_RESPONSE",
  "data": {
    "responseId": "abc123",
    "submissionId": "abc123",
    "formId": "mYfOrM",
    "formName": "Mon formulaire",
    "fields": [
      { "key": "session", "label": "session", "type": "HIDDEN_FIELDS", "value": "123456789:hmac_hex" },
      { "key": "question_abc", "label": "Pseudo", "type": "INPUT_TEXT", "value": "John" }
    ]
  }
}
```

**Champ `session` :** format `discord_id:hmac_hex` — le HMAC est `HMAC-SHA256(TALLY_SESSION_SECRET, discord_id)`.

**Comportement :**
- Formulaire inconnu → ignoré silencieusement (200)
- Signature invalide → ignoré silencieusement (200)
- Session invalide → ignoré silencieusement (200)
- Soumission dupliquée → ignorée (idempotent)

**Réponse :** `{"received": true}`

---

### `GET /tally/session-hash`

Génère le token de session à injecter dans le champ caché `session` d'un formulaire Tally.

**Auth :** session cookie

**Réponse :**

```json
{ "session": "123456789012345678:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" }
```

Format : `discord_id:hmac_hex` (HMAC-SHA256 du discord_id signé avec `TALLY_SESSION_SECRET`)

---

### `GET /staff/tally/forms`

Liste tous les formulaires enregistrés avec leur nombre de soumissions.

**Auth :** staff

**Réponse :**

```json
[
  { "form_id": "mYfOrM", "title": "Candidature", "created_at": "2026-06-01T00:00:00Z", "submission_count": 42 }
]
```

---

### `GET /staff/tally/forms/{form_id}`

Infos générales d'un formulaire (sans le `signing_secret`).

**Auth :** staff

**Réponse :**

```json
{ "form_id": "mYfOrM", "title": "Candidature", "created_at": "2026-06-01T00:00:00Z" }
```

**Erreurs :** `404` si formulaire inexistant

---

### `PUT /staff/tally/forms/{form_id}`

Crée ou met à jour un formulaire (enregistrement du `signing_secret` Tally).

**Auth :** staff

**Body :**

```json
{ "title": "Candidature modérateur", "signing_secret": "tally_secret_..." }
```

**Réponse :** formulaire créé/mis à jour (sans `signing_secret`)

**Erreurs :** `400` si `title` ou `signing_secret` manquant

---

### `GET /staff/tally/forms/{form_id}/submissions`

Liste les soumissions d'un formulaire avec pagination.

**Auth :** staff

**Query params :**

| Param | Type | Défaut | Description |
|---|---|---|---|
| `limit` | int | 50 | Max 200 |
| `offset` | int | 0 | Décalage |

**Réponse :**

```json
{
  "total": 42,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "submission_id": "abc123",
      "form_id": "mYfOrM",
      "discord_id": 123456789012345678,
      "status": "pending",
      "note": null,
      "created_at": "2026-06-07T12:00:00Z"
    }
  ]
}
```

**Erreurs :** `404` si formulaire inexistant

---

### `GET /staff/tally/submissions/{submission_id}`

Charge les infos générales d'une soumission + toutes ses réponses.

**Auth :** staff

**Réponse :**

```json
{
  "submission_id": "abc123",
  "form_id": "mYfOrM",
  "discord_id": 123456789012345678,
  "status": "pending",
  "note": null,
  "created_at": "2026-06-07T12:00:00Z",
  "answers": [
    { "id": 1, "submission_id": "abc123", "form_id": "mYfOrM", "key": "question_abc", "type": "INPUT_TEXT", "label": "Pseudo", "value": "John" }
  ]
}
```

**Erreurs :** `404` si soumission inexistante

---

### `PATCH /staff/tally/submissions/{submission_id}`

Met à jour le statut et/ou la note d'une soumission.

**Auth :** staff

**Body :**

```json
{ "status": "done", "note": "Candidature acceptée" }
```

| Champ | Type | Valeurs acceptées |
|---|---|---|
| `status` | string (optionnel) | `pending`, `done`, `rejected` |
| `note` | string (optionnel) | texte libre |

**Réponse :** soumission mise à jour

**Erreurs :** `400` si statut invalide ou ni `status` ni `note` fourni, `404` si soumission inexistante
