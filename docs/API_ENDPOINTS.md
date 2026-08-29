# Moddy Backend — Reference complete des endpoints

Toutes les reponses sont en JSON. Les erreurs suivent le format `{"error": "message"}`.

**Sanctions globales** — un compte ou un serveur sous sanction globale se voit
refuser certaines requetes avec un `403` dont le `error` est un **objet**
(`{"code", "level", "subject_type", "subject_id", "references", "expires_at",
"message", "violations_url"}`). Le niveau retenu est le plus severe entre
l'utilisateur agissant et le serveur ou il agit.

- *suspendu* (`ban`) : bloque sur tous les endpoints authentifies, sauf
  `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`, les lectures de
  `/cases` (ses propres dossiers) et tout `/violations` ;
- *limite* (`restrict`) : rien n'est coupe cote interactions — seuls le premium et
  la configuration d'un **nouveau** module sont refuses (un module deja configure
  reste pleinement modifiable, sous-ressources comprises). L'automod IA n'est coupe
  que si c'est le SERVEUR qui est limite.

Codes possibles :

| `code` | Quand |
|---|---|
| `user_suspended` | compte suspendu — sur tout endpoint authentifie non exempte |
| `guild_suspended` | serveur suspendu — sur tout endpoint du serveur |
| `premium_blocked_user` / `premium_blocked_guild` | souscription ou liaison d'un serveur a un abonnement, par un compte ou pour un serveur limite |
| `new_module_blocked` | configurer un module qui n'existe pas encore, quand l'utilisateur agissant OU le serveur est limite |
| `automod_ai_blocked` | ecrire sur `automod_ai` quand le SERVEUR est limite |

Voir `docs/GLOBAL_SANCTIONS.md` (regles backend) et
`docs/DASHBOARD_SANCTIONS_INTEGRATION.md` (guide front).

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
  "staff_roles": ["Manager", "Dev"],
  "sanction": {
    "subject_type": "discord_user",
    "subject_id": "123456789012345678",
    "level": "none",
    "action": null,
    "suspended": false,
    "restricted": false,
    "sanctions": []
  }
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
| `sanction` | object | Sanction globale du compte (`level` = `none`/`warn`/`limited`/`suspended`) — voir §Violations |

**Note :** `GET /auth/me` reste accessible a un compte suspendu, justement pour que
le dashboard puisse afficher l'ecran de suspension plutot qu'une erreur. Idem pour
`POST /auth/refresh` (garder la session vivante) et `POST /auth/logout`.

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
      "welcome_channel": {
        "version": 2,
        "messages": [
          {"id": "wm_3f9a1c72", "channel_id": "888", "message": "Bienvenue {user} !", "accent_color": null, "enabled": true, "created_by": null, "created_at": null}
        ]
      }
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
4. **Sanctions globales** : `is_premium` retombe a `false` si le serveur est limite/suspendu OU si l'abonne qui l'a lie l'est — « aucun abonnement actif, meme paye ». Les champs `subscriber_id`/`tier`/`expires_at` restent affiches : l'abonnement n'est pas encore resilie, seulement inoperant (`docs/GLOBAL_SANCTIONS.md`)

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

> Si le body contient une cle `settings`, un `settings_updated` est publie **en
> plus** de `config_updated` : le cache de langue du bot n'expire pas et
> `config_updated` ne vide que le cache des modules. Ecrire la langue par ici
> reste deconseille — utiliser `PUT /guilds/{id}/settings/language`.

---

### `GET /guilds/{guild_id}/settings/language`

Langue que Moddy parle **collectivement** sur le serveur (`guilds.data.settings.language`).

**Auth :** guild_read (lecture seule : un utilisateur suspendu voit encore ses serveurs)

```json
{
  "guild_id": "123456789012345678",
  "language": "auto",
  "effective_language": "en-US",
  "preferred_locale": "fr",
  "is_community": false,
  "choices": ["auto", "en-US", "fr", "es-ES", "pt-BR", "de"]
}
```

| Champ | Type | Description |
|---|---|---|
| `language` | str | Valeur **stockee**, normalisee comme le bot la lira (`en-GB` -> `en-US`, `es-419` -> `es-ES`, `pt-PT` -> `pt-BR`, tout le reste -> `auto`) |
| `effective_language` | str\|null | Langue reellement parlee. `null` si Discord est injoignable — on ne devine pas |
| `preferred_locale` | str\|null | `guild.preferred_locale` cote Discord, pour l'affichage |
| `is_community` | bool\|null | Feature `COMMUNITY` : sans elle, `auto` ne suit **pas** `preferred_locale` |
| `choices` | str[] | Les 6 valeurs canoniques a proposer dans le formulaire |

> Le bot ne publie **rien** quand un admin change la langue depuis `/config` :
> si le dashboard cache la valeur, il doit relire cet endpoint.

---

### `PUT /guilds/{guild_id}/settings/language`

**Auth :** guild_access
**Body :** `{"language": "fr"}` — une des 6 valeurs canoniques (`auto` + les 5 locales livrees)

**Actions declenchees :**
1. `jsonb_set(data, '{settings,language}', ...)` (upsert de la ligne guilde ; les autres cles de `settings` sont preservees)
2. Invalide le cache : `DEL guild:{id}:config`
3. Notifie le bot : `PUBLISH moddy:bot {"type": "settings_updated", "guild_id": "123456789012345678"}`

**Reponse :** identique a `GET`.

**Erreurs :** `422` valeur hors des 6 canoniques (le bot lirait `it` comme `auto`
sans rien dire — mieux vaut le refuser ici).

> `settings_updated` est **obligatoire** : le bot cache le reglage en memoire,
> une lecture par guilde, **sans expiration**. En le recevant il invalide ce
> cache puis re-poste les messages deja ecrits dans l'ancienne langue (panneau
> de verification AltGuard, panneaux de tickets). `config_updated` ne suffit
> pas — il ne touche ni le cache de langue ni les panneaux.

**Ce qui suit la langue du serveur :** bienvenue (salon et DM), panneau AltGuard
et ses cartes, panneaux et salons de tickets, logs serveur, DM et cartes de
sanction automod, notifications sociales, cartes de transcription vocale,
starboard, DM d'expiration de sanction, suggestions de raison IA.

**Ce qui ne suit pas :** tout ce qui s'adresse a une personne en prive (reponses
ephemeres, ecrans `/config`, erreurs) reste dans la langue Discord de cette
personne.

---

## Modules

### `GET /guilds/{guild_id}/modules`

Retourne toutes les configs modules du serveur.

**Auth :** guild_access
**Reponse :** objet avec chaque module_id comme cle

```json
{
  "starboard": {"channel_id": 999, "reaction_count": 5, "emoji": "⭐"},
  "welcome_channel": {"version": 2, "messages": [{"id": "wm_3f9a1c72", "channel_id": "888", "message": "Bienvenue {user} !", "accent_color": null, "enabled": true, "created_by": null, "created_at": null}]},
  "auto_role": {"role_ids": [111, 222]}
}
```

Retourne `{}` si aucun module configure.

---

### `GET /guilds/{guild_id}/modules/{module_id}`

> **Modules retirés :** un module supprimé du backend (aujourd'hui `logging`,
> remplacé par `logs`) renvoie `404 {"error": "Module 'logging' supprimé — utiliser 'logs'"}`
> sur **toutes** les routes de modules, et n'apparaît plus dans
> `GET /guilds/{id}/modules` même si des données subsistent en base.


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

**Livraison garantie (`notify`) :** un module dont la config a un pendant *dans
Discord* (panneau poste, permissions de salons) ne peut pas se contenter du
Pub/Sub de l'etape 4 — un message publie pendant un redemarrage du bot est perdu
silencieusement. Ces modules declarent un hook `notify` qui **remplace** la
publication Pub/Sub par une tache sur le stream `moddy:tasks` (rejouee au
redemarrage) et attend l'accuse du bot sur `moddy:dashboard`. L'accuse est alors
renvoye dans la reponse sous la cle **`_apply`** :

```json
{
  "channel_id": "999",
  "_apply": {"type": "module_config_applied", "ok": true, "enabled": true,
             "panel": "posted", "panel_message_id": "1416…",
             "permissions": {"updated": 12, "failed": 0, "skipped": 30}}
}
```

`_apply` n'est jamais stocke en base et n'apparait que pour les modules
concernes (aujourd'hui **`altguard`**, voir plus bas). Le renvoyer tel quel dans
un `PUT` suivant est sans effet : les cles inconnues sont ignorees.

**Erreurs (sanctions globales) :**

| Code | Cas |
|---|---|
| `403 new_module_blocked` | le module n'existe pas encore ET l'utilisateur agissant ou le serveur est **limite**. Un module deja configure reste pleinement modifiable. |
| `403 automod_ai_blocked` | `module_id = automod_ai` et le **serveur** est limite (une sanction d'utilisateur ne coupe pas l'automod) |

`DELETE` n'est jamais bloque : desactiver un module reste possible sous sanction.

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
3. Notifie le bot : `PUBLISH moddy:bot {"type": "module_disabled", ...}` — ou,
   pour un module a hook `notify`, une tache `update_panel` avec
   `action: "deleted"` sur `moddy:tasks`, dont l'accuse est renvoye sous `_apply`

**Reponse :**

```json
{"guild_id": 123456789, "module_id": "starboard", "status": "disabled"}
```

---

## Module — Starboard

Le module `starboard` épingle un message dans un salon dédié quand il reçoit
assez de réactions. Depuis 2026-08 il est piloté par un `ModuleSpec`
(`app/modules/specs/starboard.py`) : validation + effet de bord passent par le
endpoint **générique** `GET/PUT/PATCH/DELETE /guilds/{id}/modules/starboard` —
pas de routeur dédié.

**Structure stockée en DB** (`guilds.data.modules.starboard`) :

```json
{
  "channel_id": 123456789012345678,
  "reaction_count": 5,
  "emoji": "⭐"
}
```

| Champ | Type | Défaut | Contrainte |
|---|---|---|---|
| `channel_id` | snowflake (int64) \| `null` | `null` | Obligatoire pour activer le module. Vérifié en `pre_save` : doit résoudre à un salon texte/annonces existant de la guilde (`fetch_guild_channels`) — sinon **422**. Si Discord est injoignable, la vérification est ignorée (n'échoue pas la sauvegarde). |
| `reaction_count` | int | `5` | Doit être dans `[1, 100]`. |
| `emoji` | string | `"⭐"` | Doit être un emoji Unicode standard. Rejeté (**422**) si custom/de serveur (motif `<:name:id>` / `<a:name:id>`) ou s'il contient un caractère ASCII alphanumérique — mirror best-effort côté backend du check bot-side (`is_standard_discord_emoji`), pas identique bit à bit ; le bot reste juge final. |

> **IDs Discord : chaînes en JSON, entiers en base.** Comme les autres modules,
> `channel_id` est renvoyé en **chaîne** par l'API (snowflake > `Number.MAX_SAFE_INTEGER`)
> et accepté en écriture aussi bien en chaîne qu'en nombre ; le stockage JSONB
> reste en entier.

> **Non couvert côté backend :** la permission `send_messages` du bot dans le
> salon choisi n'est pas vérifiée ici (nécessiterait de calculer les
> permission overwrites Discord) — seul le bot la contrôle à l'exécution.

---

### `GET /guilds/{guild_id}/modules/starboard`

Config du module. Endpoint générique (voir `GET /guilds/{guild_id}/modules/{module_id}`).

**Auth :** guild_access
**Reponse :**

```json
{"channel_id": "123456789012345678", "reaction_count": 5, "emoji": "⭐"}
```

---

### `PUT` / `PATCH /guilds/{guild_id}/modules/starboard`

Sauvegarde complète de la config. Endpoint générique : validation contre le
schéma `ModuleSpec`, puis `pre_save` (vérifie `channel_id`).

**Auth :** guild_access
**Body :**

```json
{"channel_id": 123456789012345678, "reaction_count": 3, "emoji": "🌟"}
```

**Actions déclenchées :**
1. Validation Pydantic (`reaction_count` ∈ [1,100], `emoji` standard) — **422** si invalide
2. `pre_save` : `channel_id` doit être un salon texte/annonces de la guilde — **422** sinon
3. `UPDATE guilds SET data = jsonb_set(data, '{modules,starboard}', $2::jsonb) WHERE guild_id = $1`
4. Invalide le cache : `DEL guild:{id}:config`
5. Notifie le bot (Pub/Sub) : `PUBLISH moddy:bot {"type": "module_updated", "guild_id": 123, "module_id": "starboard"}`

**Reponse :** config mise à jour (channel_id en chaîne)

```json
{"channel_id": "123456789012345678", "reaction_count": 3, "emoji": "🌟"}
```

**Erreurs :** `422` validation ou salon invalide, `404` serveur introuvable

---

### `DELETE /guilds/{guild_id}/modules/starboard`

Désactive le module entier. Endpoint générique (voir `DELETE /guilds/{guild_id}/modules/{module_id}`).

**Reponse :**

```json
{"guild_id": "123456789", "module_id": "starboard", "status": "disabled"}
```

---

## Module — Welcome DM

Le module `welcome_dm` envoie jusqu'à **3** messages en DM au membre qui
rejoint le serveur. Il est piloté par un `ModuleSpec`
(`app/modules/specs/welcome_dm.py`) : aucun routeur dédié, tout passe par les
endpoints **génériques** `GET/PUT/PATCH/DELETE /guilds/{id}/modules/welcome_dm`.

C'est le jumeau de `welcome_channel` à une différence structurelle près :
**il n'y a pas de `channel_id`** (le message part en DM). Ne pas croiser les
deux : préfixe d'id `wdm_` ici, `wm_` là-bas, et 3 messages max contre 5.

**Structure stockée en DB** (`guilds.data.modules.welcome_dm`) :

```json
{
  "version": 2,
  "messages": [
    {
      "id": "wdm_3f9a1c72",
      "message": "Bienvenue sur **{server}**, {display_name} !\n-# Tu es le **{member_count}**ᵉ membre à nous rejoindre.",
      "accent_color": 5793266,
      "enabled": true,
      "created_by": 987654321098765432,
      "created_at": "2026-08-21T12:34:56.789012+00:00"
    }
  ]
}
```

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `version` | `integer` | `2` | Version du schéma, toujours écrire `2` |
| `messages` | `array` | `[]` | **Max 3** entrées ; tableau vide = module désactivé |
| `messages[].id` | `string` | — | `"wdm_"` + 8 hex minuscules, unique dans la guilde |
| `messages[].message` | `string` | — | Texte + placeholders, non vide après trim, `≤ 1500` caractères |
| `messages[].accent_color` | `integer \| null` | `null` (= `0x5865F2` à l'usage) | `0`–`0xFFFFFF`, **entier** (pas `#RRGGBB`) |
| `messages[].enabled` | `bool` | `true` | Pause sans supprimer |
| `messages[].created_by` | `integer \| null` | `null` | Informatif — exposé en **chaîne** en réponse |
| `messages[].created_at` | `string \| null` | `null` | ISO 8601 UTC, informatif |

**Pas de clé racine `enabled`** : l'état « module actif » est **calculé** (au
moins une entrée `enabled: true`). Un on/off dans le dashboard doit mettre en
pause / réactiver les entrées ; une clé `enabled` racine serait ignorée par le
bot (et n'est pas persistée par le schéma).

**Écriture = remplacement complet.** Il n'existe pas de patch par entrée :
`PUT`/`PATCH` remplacent tout l'objet, `version` comprise. Un message supprimé
doit disparaître du tableau — un merge clé à clé le ressusciterait. Le
dashboard génère l'`id` des nouvelles entrées (`wdm_` + 8 hex) et ne doit
**jamais** réutiliser ni renuméroter un id existant : le bot matche les entrées
par `id`.

**Validation (miroir de `WelcomeDmModule.validate_config()` côté bot)** — toute
violation rejette la config **entière** en `422` :

| # | Règle |
|---|---|
| 1 | au plus 3 entrées |
| 2 | pas de doublon d'`id` dans la guilde |
| 3 | `message` non vide après trim |
| 4 | `message` ≤ 1500 caractères |
| 5 | `accent_color` vaut `null` ou un entier dans `[0, 0xFFFFFF]` |

Rien d'autre n'est contraint : markdown, titres (`#`, `##`, `###`), subtext
(`-#`) et `{tokens}` inconnus sont autorisés dans `message`.

**Migration v1 → v2 (lecture seule).** Une guilde qui n'a pas resauvegardé
depuis le rework a encore l'ancien objet (`message_template` + `embed_*`). Il
est migré **à la volée** à chaque lecture (`GET /modules`, `GET
/modules/welcome_dm`) et avant validation d'une écriture — la base n'est
réécrite qu'à la prochaine sauvegarde :

| Clé v1 | Devient |
|---|---|
| `embed_title` (si `embed_enabled`) | titre `### ` en première ligne de `messages[0].message` |
| `message_template` | corps du message |
| `embed_description` (si `embed_enabled` et différent du corps) | ajouté à la suite |
| `embed_color` (si `embed_enabled`) | `messages[0].accent_color` |
| `embed_footer`, `embed_image_url`, `embed_thumbnail_enabled`, `embed_author_enabled` | abandonnées |

Le texte composé est tronqué à 1500 caractères et reçoit l'id `wdm_00000000`
(déterministe : la migration tourne à chaque lecture, un id aléatoire changerait
d'un `GET` à l'autre). Si la composition est vide, le résultat est
`{"version": 2, "messages": []}` (module éteint).

**Placeholders** (substitution littérale au moment de l'envoi, jamais un
`format()` — un `{` isolé est inoffensif, un token inconnu reste visible dans le
DM). Un aperçu dashboard doit faire exactement le même remplacement :

| Placeholder | Valeur |
|---|---|
| `{server}` | nom du serveur |
| `{user}` | mention du membre (`<@id>`) |
| `{display_name}` | pseudo / nom affiché |
| `{username}` | nom de compte |
| `{member_count}` | nombre de membres après l'arrivée |
| `{timestamp}` | heure d'arrivée en **secondes Unix** — à envelopper : `<t:{timestamp}:R>` |

**Constantes à garder synchronisées avec le bot :** `MAX_WELCOME_DMS = 3`,
`MAX_MESSAGE_LENGTH = 1500`, `DEFAULT_ACCENT_COLOR = 0x5865F2` (5793266),
`CONFIG_VERSION = 2`, préfixe d'id `wdm_`.

**Réponse.** `created_by` est renvoyé en **chaîne** (snowflake > `Number.MAX_SAFE_INTEGER`)
et une `accent_color` stockée sous une forme aberrante (héritage) est exposée à
`null` — comme le fait le bot à la lecture. Cette normalisation est en lecture
seule : une écriture avec une couleur invalide reste refusée en `422`.

**Invalidation du cache :** le endpoint générique invalide `guild:{id}:config`
et publie `{"type": "module_updated", "guild_id": …, "module_id": "welcome_dm"}`
sur `moddy:bot` après **chaque** écriture — sans ça le bot continuerait
d'envoyer les anciens DM jusqu'à son redémarrage.

**Désactiver le module :** `messages: []`, ou toutes les entrées `enabled: false`,
ou `DELETE /guilds/{id}/modules/welcome_dm`.

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

**Erreurs :** `400` channel_id invalide, `422` validation, `404` serveur introuvable,
`403 new_module_blocked` si le module `adaptive_slowmode` n'est pas encore configure
et que l'utilisateur agissant ou le serveur est **limite** (une fois le module en
place, ajouter ou modifier un salon reste permis).

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

## Module — Automod AI

Le module `automod_ai` est la modération IA de contenu. Sa config est pilotée par un `ModuleSpec` (`app/modules/specs/automod_ai.py`) : elle se lit et s'écrit par le endpoint **générique** des modules (`GET/PUT /guilds/{id}/modules/automod_ai`). Les routes dédiées ci-dessous ne couvrent que des sous-ressources propres au module (état réel, contrôle des indications, budget IA).

**Renommage (2026-08).** Le module s'appelait `automod` ; l'id est désormais `automod_ai` (un automod *classique*, à règles, prendra l'id `automod`). Le bot migre lui-même une config restée sous `data.modules.automod`. **Le backend ne lit et n'écrit que `automod_ai`** ; un `data.modules.automod` résiduel est du legacy en lecture seule.

**Structure stockée en DB** (`guilds.data.modules.automod_ai`) :

```json
{
  "enabled": false,
  "indications": "",
  "notify_channel_id": null,
  "ignore_moderators": true,
  "severity": 3,
  "max_action": "ban",
  "categories_desactivees": [],
  "dry_run": false,
  "features": {
    "content": { "enabled": false, "exempt_roles": [], "exempt_channels": [] }
  }
}
```

| Champ | Type | Défaut | Notes |
|---|---|---|---|
| `enabled` | bool | `false` | Interrupteur principal. **Pas suffisant seul** (voir *État réel*). |
| `indications` | string ≤ 3000 | `""` | Consignes serveur, injectées **verbatim** dans le system prompt IA → soumises au contrôle anti-injection. |
| `notify_channel_id` | int \| null | `null` | **Obligatoire pour que le module tourne.** Salon texte/annonces où sont postées décisions, cartes shadow et alertes budget. |
| `ignore_moderators` | bool | `true` | Ignore les membres avec `manage_messages`. |
| `severity` | int 1–5 | `3` | Sensibilité (seuil embedding + décalage de cran du barème). |
| `max_action` | `warn`\|`mute`\|`ban` | `ban` | Plafond dur du barème. |
| `categories_desactivees` | string[] | `[]` | Catégories jamais sanctionnées (décision ramenée à la suppression seule). Valeurs : `insulte`, `menace`, `harcelement`, `harcelement_sexuel`, `haine_discrimination`, `incitation_automutilation`, `doxxing`, `arnaque_scam`, `violation_indications`. Champ ops (pas de sélecteur UI). |
| `dry_run` | bool | `false` | Shadow mode : le funnel décide, **rien n'est appliqué** ; une carte SIMULATION est postée. |
| `features.<id>.enabled` | bool | `false` | Feature de détection. Seul id connu aujourd'hui : `content`. |
| `features.<id>.exempt_roles` | int[] ≤ 25 | `[]` | Rôles non modérés. |
| `features.<id>.exempt_channels` | int[] ≤ 25 | `[]` | Salons exemptés (+ threads dont le parent est listé). |

> **IDs Discord : chaînes en JSON, entiers en base.** Un snowflake de 19 chiffres dépasse `Number.MAX_SAFE_INTEGER` — renvoyé en nombre JSON il serait silencieusement arrondi par un client JS, qui réécrirait ensuite un ID faux. L'API renvoie donc `notify_channel_id`, `exempt_roles` et `exempt_channels` en **chaînes** (`"1234567890123456789"`), et accepte en écriture aussi bien la chaîne que le nombre. Le stockage JSONB, lui, reste en entiers (c'est ce que lit le bot) : l'aller-retour `GET` → `PUT` est sans perte.

`features` est une map ouverte indexée par feature id ; une clé inconnue est **rejetée** (`422 Fonctionnalité inconnue : <id>`). Le bloc `features.situation` (supprimé en 2026-08) est retiré automatiquement à la lecture et à la prochaine écriture, comme les clés legacy `rules` → `indications` et `log_channel_id` → `notify_channel_id`. **`langue_serveur` a été supprimée en 2026-08** : la langue des DM, cartes et raisons IA est celle du serveur (`GET/PUT /guilds/{id}/settings/language`). La clé est retirée à la lecture comme avant écriture, n'est plus validée, et l'erreur « Langue invalide » n'existe plus.

**État réel du module.** `enabled` seul ne suffit pas :

```
running = enabled ET au moins une features[*].enabled ET notify_channel_id != null
```

**Validation à l'écriture** (`PUT/PATCH /guilds/{id}/modules/automod_ai`) :

| Règle | Erreur |
|---|---|
| `notify_channel_id` est un salon texte/annonces du serveur | `422 Salon d'alertes invalide` (non bloquant si Discord est injoignable) |
| `len(indications) <= 3000` | `422` |
| `severity` ∈ 1..5, `max_action` ∈ warn/mute/ban | `422` |
| chaque clé de `features` est un feature id connu | `422 Fonctionnalité inconnue : <id>` |
| `indications` (si modifiées) passent le contrôle anti-injection du bot | `422` avec la raison, ou `503` si le bot est injoignable |

> **Contrôle anti-injection.** `indications` étant injecté verbatim dans le system prompt, tout texte **modifié** est envoyé au bot (`POST {BOT_INTERNAL_URL}/automod/rules_check`, call type `automod_rules_check`) avant d'être persisté — le même contrôle que le panel du bot. On échoue **fermé** : si le contrôle ne peut pas tourner, la sauvegarde est refusée (`503`) plutôt que d'écrire du texte non vérifié. Le contrôle n'est rejoué que si le texte a changé (activer une feature ne relance pas d'appel IA).
>
> Appel : `Authorization: Bearer {INTERNAL_API_SECRET}` (secret partagé avec le bot ; **sans lui le bot répond 401** et toute écriture des `indications` échoue en `503`), corps `{guild_id, indications, locale}` — `locale` est dérivée de la **langue du serveur** (`guilds.data.settings.language` : `fr` → `fr`, `en-US` → `en`, tout le reste → défaut du bot) pour que la raison du refus soit affichable telle quelle. Ce `locale`-là est la langue de la *réponse du contrôle*, pas un réglage du module.
>
> Interprétation de la réponse du bot :
>
> | Réponse du bot | Backend |
> |---|---|
> | `200 {"ok": true}` | sauvegarde |
> | `200 {"ok": false, "code": "unsafe"\|"too_long", "reason": …}` | `422` avec `reason` |
> | `200 {"ok": false, "code": "unavailable", …}` | `503` — **panne du bot, pas un texte refusé** |
> | `400`/`401`/`404`/`503` (`invalid_guild_id`, `unauthorized`, `unknown_guild`, `bot_not_ready`) | `503` |
>
> Le point d'attention : le bot signale sa propre indisponibilité par un **`200` avec `ok: false`**. Ne jamais déduire « texte refusé » du seul `ok: false` — sinon une panne de gateway s'affiche à l'utilisateur comme un refus de ses indications.

Comme pour tout module, une écriture invalide le cache et publie `{"type": "module_updated", "guild_id": ..., "module_id": "automod_ai"}` sur `moddy:bot` — sans cet événement le bot ne relirait la config qu'au redémarrage. `PUT` et `PATCH` ont la même sémantique : le corps **remplace** la config (le dashboard envoie toujours l'objet complet, comme le bot).

---

### `GET /guilds/{guild_id}/modules/automod_ai/status`

État réel du module + avertissements de configuration (à afficher tel quel dans le dashboard).

**Auth :** guild_access

**Reponse :**

```json
{
  "guild_id": "123456789",
  "module_id": "automod_ai",
  "running": false,
  "enabled": true,
  "dry_run": false,
  "blocked_by_global_sanction": false,
  "notify_channel_id": null,
  "active_features": ["content"],
  "warnings": ["missing_notify_channel"]
}
```

`warnings` : `missing_notify_channel` (mauvaise config la plus fréquente), `no_feature_enabled`, `dry_run` (le module tourne mais n'applique rien), `blocked_by_global_sanction`.

`blocked_by_global_sanction: true` = le serveur est sous sanction globale
`restrict`/`ban` : l'automod IA est coupé côté bot, `running` et `enabled` sont
donc forcés à `false` quelle que soit la config stockée, et toute écriture sur
`automod_ai` est refusée (`403 automod_ai_blocked`). Voir `docs/GLOBAL_SANCTIONS.md`.

---

### `POST /guilds/{guild_id}/modules/automod_ai/indications/check`

Passe un texte au contrôle anti-injection **sans rien sauvegarder** (retour immédiat dans le formulaire). Le même contrôle est rejoué à la sauvegarde : ce endpoint ne dispense de rien.

**Auth :** guild_access
**Body :** `{"indications": "pas d'insultes, même pour rire"}` — la langue de `reason` est celle du serveur (`GET /guilds/{id}/settings/language`), plus un champ du body. Un `langue_serveur` résiduel est ignoré.

**Reponse :** `{"ok": true}` ou `{"ok": false, "reason": "..."}`
**Erreur :** `503` contrôle indisponible (bot injoignable, non authentifié, ou gateway du bot en panne)

---

### `GET` / `PUT /guilds/{guild_id}/modules/automod_ai/budget`

Soft cap quotidien d'appels IA (en « unités » ; un appel `mini` en coûte 4). Au-delà du cap, le bot **dégrade** le funnel (IA réservée aux cas flagrants) au lieu de s'arrêter. Stocké dans Redis : `automod:budget:cap:{guild_id}` (override) et `automod:budget:{guild_id}:{YYYYMMDD}` (consommation du jour).

**Auth :** staff — un admin de serveur ne relève pas son propre plafond.
**Body du `PUT` :** `{"cap": 500}` ou `{"cap": null}` pour restaurer le défaut.

**Reponse :**

```json
{
  "guild_id": "123456789",
  "cap": 500,
  "cap_overridden": true,
  "default_cap": 300,
  "used_today": 128,
  "day": "20260806"
}
```

> Les plafonds **durs** par type d'appel (`automod_decision`, `automod_decision_mini`, `automod_confirm`, `automod_rules_check`) vivent dans `quota_limits` / `quota_overrides` (scope `guild`, `-1` = illimité) et ne sont pas exposés ici.

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
| Sanction globale : module pas encore configure, utilisateur agissant ou serveur **limite** | `403` | `new_module_blocked` (objet, cf. en-tete du document). Sur un module deja en place, ajouter un abonnement reste permis. |

---

## Module — Bot Customization

Le module `bot_customization` personnalise l'apparence de Moddy **dans une guilde** : pseudo, bio, avatar, bannière (premium) et style du pseudo (gratuit).

Le backend **n'écrit jamais** `guilds.data.modules.bot_customization` : les hashes d'avatar/bannière ne peuvent venir que de Discord. Chaque écriture est **déléguée** au bot via une tâche `bot_customization_update` sur `moddy:tasks`, dont le résultat revient sur `moddy:dashboard` (corrélé par `request_id`). Ces routes **masquent** les routes génériques des modules pour ce `module_id`. Détails complets : `docs/BOT_CUSTOMIZATION.md`.

| Champ | Condition |
|---|---|
| `nickname`, `bio`, `avatar_url`, `banner_url` | guilde premium |
| `style` | toujours |

Le gating premium fait ici est un **filtre UX** ; le bot re-vérifie. Réinitialiser un champ premium (`null`) reste permis sans premium.

### `GET /guilds/{guild_id}/modules/bot_customization`

État courant + tout ce qu'il faut au formulaire (aucun appel au bot).

**Reponse :**

```json
{
  "guild_id": "123456789",
  "config": {
    "nickname": "Guardian",
    "bio": "Le bot de notre serveur",
    "avatar_hash": "a_1c9e4f2b",
    "banner_hash": "b_77f2a91d",
    "avatar_source": "https://api.moddy.app/uploads/abc.png",
    "banner_source": null,
    "style": { "font_id": 7, "effect_id": 2, "colors": [16711680, 255] },
    "updated_at": "2026-08-08T14:31:07+00:00",
    "updated_by": "942386103000000000"
  },
  "avatar_url": "https://cdn.discordapp.com/guilds/123456789/users/<bot_id>/avatars/a_1c9e4f2b.gif",
  "banner_url": "https://cdn.discordapp.com/guilds/123456789/users/<bot_id>/banners/b_77f2a91d.png",
  "is_premium": true,
  "limits": {
    "nickname_max_length": 32,
    "bio_max_length": 137,
    "bio_attribution": "<a:Rocket:1535783839870353499> Powered by @**Moddy**",
    "image_max_bytes": 8388608,
    "image_content_types": ["image/png", "image/jpeg", "image/gif", "image/webp"],
    "font_ids": [3, 4, 6, 7, 8, 10, 12],
    "effect_ids": [2, 3, 4, 5],
    "gradient_effect_id": 2
  },
  "premium_fields": ["nickname", "bio", "avatar_url", "banner_url"]
}
```

- `config` = bloc stocké tel quel (`{}` si jamais personnalisé), `updated_by` exposé en **chaîne**.
- `avatar_url` / `banner_url` sont calculées depuis les hashes (`.gif` si le hash commence par `a_`), `null` sans hash. **Aucune image n'est stockée côté Moddy.**
- `bio_max_length` ne compte **que la partie serveur** : le bot ajoute lui-même `bio_attribution` en dernière ligne. Ne jamais l'envoyer dans `bio`.

### `GET /guilds/{guild_id}/modules/bot_customization/schema`

Schéma JSON du corps accepté en écriture (masque le `/schema` générique, qui décrit la forme stockée avec les hashes — inutilisable pour un formulaire).

### `PUT` / `PATCH /guilds/{guild_id}/modules/bot_customization`

Applique la personnalisation. Les deux verbes sont identiques : **c'est la présence des clés qui fait foi**.

| Cas | Effet |
|---|---|
| clé absente | champ inchangé |
| clé à `null` | champ réinitialisé |
| clé avec valeur | champ appliqué |

**Corps :**

```json
{
  "nickname": "Guardian",
  "bio": "Le bot de notre serveur",
  "avatar_url": "https://api.moddy.app/uploads/abc.png",
  "banner_url": "https://api.moddy.app/uploads/def.png",
  "style": { "font_id": 7, "effect_id": 2, "colors": ["#FF0000", "#0000FF"] }
}
```

- `nickname` ≤ 32 car. — `bio` ≤ 137 car. (partie serveur seule).
- `style.colors` accepte des entiers 24-bit **ou** des `"#RRGGBB"` ; le backend normalise en entiers. `effect_id=2` (dégradé) exige exactement 2 couleurs, tout autre effet exactement 1.
- `avatar_url` / `banner_url` doivent être publiques et sans auth — utiliser `POST .../uploads` ci-dessous.
- Corps vide → `422 empty_update`.

**Reponse :** le résultat publié par le bot (`bot_customization_update_result`), avec les `avatar_hash` / `banner_hash` fraîchement renvoyés par Discord.

### `DELETE /guilds/{guild_id}/modules/bot_customization`

Reset complet : émet la tâche avec `nickname`, `bio`, `avatar_url`, `banner_url`, `style` tous à `null`. Masque le `DELETE` générique, qui supprimerait le bloc en base sans rien remettre à zéro côté Discord.

### `POST /guilds/{guild_id}/modules/bot_customization/uploads`

Héberge temporairement une image (avatar ou bannière) pour que le bot la télécharge. `multipart/form-data`, champ `file`. Premium requis.

**Reponse :**

```json
{ "url": "https://api.moddy.app/uploads/3f1a….png", "content_type": "image/png", "size": 104832, "expires_in": 900 }
```

- Types acceptés : `image/png`, `image/jpeg`, `image/gif`, `image/webp` → sinon `422 invalid_image_type`.
- Taille ≤ 8 Mio, vérifiée sur les octets réellement lus → sinon `422 image_too_large`.
- L'URL est publique et **expire** (15 min) : elle sert une seule fois, au téléchargement par le bot.

### `GET /uploads/{token}`

Sert l'image hébergée. **Public, sans authentification** (le bot n'a ni session ni `Authorization`). `404 upload_not_found` une fois expirée.

### Codes d'erreur (bot customization)

| Code | HTTP |
|---|---|
| `premium_required`, `missing_permissions` | `403` |
| `new_module_blocked` (sanction globale, module pas encore configure) | `403` |
| `guild_not_found` | `404` |
| `rate_limited` | `429` |
| `empty_update`, `nickname_too_long`, `bio_too_long`, `invalid_color`, `invalid_font`, `invalid_effect`, `gradient_needs_two_colors`, `effect_needs_color`, `invalid_image_type`, `image_too_large`, `invalid_config` | `422` |
| `image_download_failed`, `rejected_by_discord`, `discord_error`, `save_failed`, `internal_error` | `502` |
| `bot_timeout` (aucun résultat en 25 s) | `504` |

`premium_required` couvre aussi le cas d'une **sanction globale** : un serveur limite
ou suspendu, ou dont l'abonne l'est, n'est plus premium (« aucun abonnement actif,
meme paye ») — la remise a `null` d'un champ premium reste possible.

Le corps d'erreur est toujours `{"error": "<code>"}` — les codes sont aussi des clés i18n. (Exception : les blocages par sanction globale, dont `error` est un objet.) Sur `bot_timeout`, la tâche reste dans le stream et sera rejouée : **ne pas ré-émettre**, prévoir un simple message côté dashboard.

---

## Module — AltGuard

`altguard` retient chaque humain qui rejoint le serveur derrière une
vérification anti multi-comptes. Tout le parcours (panneau, consentement, jeton,
verdict, DM) est géré **par le bot** ; le backend ne gère que la config, via le
endpoint **générique** `GET/PUT/PATCH/DELETE /guilds/{id}/modules/altguard` — pas
de routeur dédié. Détails complets : `docs/ALTGUARD.md`.

**Structure stockée en DB** (`guilds.data.modules.altguard`) :

```json
{
  "channel_id": 111111111111111111,
  "unverified_role_id": 222222222222222222,
  "verified_role_id": 333333333333333333,
  "log_channel_id": 444444444444444444,
  "message_id": 1416000000000000000
}
```

| Champ | Type | Requis | Rôle |
|---|---|---|---|
| `channel_id` | int | ✅ | Salon de vérification — seul salon visible par le rôle non vérifié |
| `unverified_role_id` | int | ✅ | Donné au join, bloque l'accès |
| `verified_role_id` | int | ✅ | Donné quand la vérification passe |
| `log_channel_id` | int | — | Verdicts + décisions manuelles |
| `message_id` | int | — | Bookkeeping du bot (id du panneau posté). **Jamais géré à la main** |

`enabled` n'est **pas stocké** : il est calculé (`channel_id` + les deux rôles) et
ajouté en lecture seule dans les réponses `GET`/`PUT`. Ni le texte du panneau ni sa
langue ne sont configurables ici.

> **Langue.** Ce module n'a plus de langue à lui depuis 2026-08 : les textes suivent la langue du **serveur** (`GET/PUT /guilds/{id}/settings/language`). `panel_locale` a été supprimée : elle est retirée à la lecture comme avant écriture, et une écriture qui la porte encore n'est pas rejetée — elle est sans effet.

**Snowflakes en chaînes :** en lecture, `channel_id`, `unverified_role_id`,
`verified_role_id`, `log_channel_id` et `message_id` sont renvoyés en **string**
(un id de 19 chiffres déborde `Number` en JS). En écriture, les deux formes sont
acceptées.

### `PUT` / `PATCH /guilds/{guild_id}/modules/altguard`

**Validation (422) :** les deux rôles différents ; et,
quand Discord répond : salons = salons texte/annonces du serveur, rôles
existants, ni `@everyone` ni gérés par une intégration, **sous** le rôle le plus
haut du bot, et bot disposant de « Gérer les rôles ». Si Discord est injoignable,
la sauvegarde passe (le bot reste juge final).

Une config **incomplète** est acceptée (le dashboard sauvegarde au fil de l'eau) :
elle désactive simplement le gate et fait retirer le panneau par le bot.

**Reponse :** config + accusé du bot sous `_apply`

```json
{
  "channel_id": "111111111111111111",
  "unverified_role_id": "222222222222222222",
  "verified_role_id": "333333333333333333",
  "log_channel_id": "444444444444444444",
  "message_id": "1416000000000000000",
  "enabled": true,
  "_apply": {
    "type": "module_config_applied", "ok": true, "action": "updated",
    "enabled": true, "panel": "posted", "panel_message_id": "1416…",
    "permissions": {"updated": 12, "failed": 0, "skipped": 30}
  }
}
```

**À afficher côté dashboard :** `panel: "failed"` et `permissions.failed > 0`
sont les **seuls** signaux qu'il manque une permission au bot — sans eux la
sauvegarde a l'air réussie alors qu'elle ne l'est qu'à moitié.

| `_apply.error` | Sens |
|---|---|
| `unknown_module`, `no_database`, `invalid_config`, `config_unreadable`, `invalid_guild`, `internal_error` | Le bot a refusé/raté le reload (`ok: false`) |
| `hook_error` (champ à part) | Le côté Discord a planté ; la config reste stockée et chargée |
| `bot_timeout` | Pas d'accusé en 25 s. **La config est enregistrée** et la tâche reste dans le stream : ne pas ré-émettre |
| `task_transport_unavailable` | `TASK_STREAM_SECRET` absent/trop court. Config enregistrée, rien appliqué dans Discord |

### `DELETE /guilds/{guild_id}/modules/altguard`

Supprime la config et demande au bot de retirer le panneau (`action: "deleted"`).
Réponse standard + `_apply`. Le bot ne réécrit **rien** en base sur une suppression.

> **Limite connue :** une suppression qui arrive avec un cache bot froid
> (redémarrage entre les deux) ne peut rien nettoyer — la config est déjà vide,
> le bot ne sait plus quel `message_id` chercher. L'accusé renvoie
> `cleaned: false` et le panneau reste orphelin dans Discord.

---

## Module — Logs (logs serveur)

`logs` journalise les événements du serveur : **18 catégories, 163 événements**,
routés vers un ou plusieurs salons. Config stockée dans `guilds.data.modules.logs`,
lue/écrite par le endpoint **générique** `GET/PUT/PATCH /guilds/{id}/modules/logs`.
Trois routes s'y ajoutent (`app/routers/logs.py`) : `/catalog`, `/diagnostics` et
un `DELETE` qui écrit `{}`. Détails complets : `docs/LOGS.md`.

> Remplace l'ancien module `logging` (`GET`/`PATCH /guilds/{id}/logging`, clé
> `data.modules.logging`), **supprimé** du backend en 2026-08. Ces deux routes
> n'existent plus ; `data.modules.logging` n'est plus ni lu ni écrit ici.

**Structure stockée en DB** (`guilds.data.modules.logs`) :

```json
{
  "categories": {
    "server":   { "channel_ids": ["123456789012345678"], "disabled_events": ["user_kick"] },
    "messages": { "channel_ids": ["456789012345678901"], "disabled_events": [] }
  },
  "ignored_channel_ids": ["789012345678901234"],
  "ignored_role_ids": [],
  "ignore_bots": false,
  "attach_transcripts": true,
  "merge_duplicates": true
}
```

| Champ | Type | Défaut | Contrainte |
|---|---|---|---|
| `categories` | object | `{}` | Clés = ids du catalogue. Clé inconnue → 422 |
| `categories.<id>.channel_ids` | array de string | `[]` | **3 max**, dédupliqués (ordre conservé) |
| `categories.<id>.disabled_events` | array de string | `[]` | **Exclusions uniquement**. Nom hors catégorie → 422 |
| `ignored_channel_ids` | array de string | `[]` | **25 max** |
| `ignored_role_ids` | array de string | `[]` | **25 max** |
| `ignore_bots` | bool | `false` | |
| `attach_transcripts` | bool | `true` | `false` → les `.txt` sont retirés avant envoi |
| `merge_duplicates` | bool | `true` | Un log par *acte* au lieu d'un par événement |

**Snowflakes en chaînes** en base comme en réponse (les entiers envoyés sont
acceptés et convertis). `enabled` n'est **pas stocké** : il est calculé
(`any(cat.channel_ids)`) et ajouté en lecture seule aux réponses ; envoyé par un
client, il est ignoré.

**Trois règles qui ne se devinent pas :** seules les **exclusions** sont
persistées (un événement ajouté plus tard au registre démarre *activé*) ; une
catégorie sans salon est retirée à l'écriture *sauf* si elle porte des
`disabled_events` ; la **catégorie est l'unité de routage** (deux événements d'une
même catégorie ne peuvent pas viser deux salons différents).

Pas de gating premium sur ce module.

> **Langue.** Ce module n'a plus de langue à lui depuis 2026-08 : les textes suivent la langue du **serveur** (`GET/PUT /guilds/{id}/settings/language`). `locale` a été supprimée : elle est retirée à la lecture comme avant écriture, n'est plus validée, et une écriture qui la porte est sans effet.

### `PUT` / `PATCH /guilds/{guild_id}/modules/logs`

⚠️ **Remplacement complet de l'objet**, pour les deux verbes. Un corps
`{"ignore_bots": true}` efface les catégories : lire, muter, réécrire en entier.

**Validation (422) :** catégories et événements du catalogue, limites de listes,
et, quand Discord répond, pour chaque salon de destination —
il existe dans la guilde (**les fils sont acceptés**), c'est un salon
texte/annonces ou un fil, et le bot y a `view_channel`, `send_messages` (ou
`send_messages_in_threads` pour un fil) **et** `embed_links`. Si Discord est
injoignable, la sauvegarde passe (le bot reste juge final).

`manage_webhooks` n'est **pas** exigée : sans elle le bot dégrade sur
`channel.send` (perte du bucket de rate-limit dédié et du batching de 10 embeds).
Elle remonte comme avertissement sur `/diagnostics`.

**Réponse :** config stockée + `enabled`.

```json
{
  "categories": {"server": {"channel_ids": ["123456789012345678"], "disabled_events": ["user_kick"]}},
  "ignored_channel_ids": [], "ignored_role_ids": [],
  "ignore_bots": false, "attach_transcripts": true, "merge_duplicates": true,
  "enabled": true
}
```

**Actions :** écrit `data.modules.logs`, invalide `guild:{id}:config`, publie
`module_updated` (avec `module_id: "logs"`) sur `moddy:bot`. Pub/Sub best-effort :
si le bot est down le message est perdu, mais la config est en base et sera relue
à la prochaine lecture de la guilde — **ne pas réécrire**.

### `GET /guilds/{guild_id}/modules/logs/catalog`

Catalogue complet + limites + locales. **Source unique du dashboard** : il ne doit
pas en garder sa propre copie, sinon il dérive à chaque ajout d'événement.

```json
{
  "categories": {
    "server": {"events": ["ban_add", "ban_remove", "…"], "unimplemented": []},
    "moderation": {"events": ["…"], "unimplemented": ["case_delete", "…"]}
  },
  "category_count": 18,
  "event_count": 163,
  "locales": ["en-US", "fr", "es-ES", "pt-BR", "de"],
  "locale_keys": {
    "event": "modules.logs.events.{category}.{event}",
    "title": "modules.logs.titles.{category}.{event}"
  },
  "limits": {"channels_per_category": 3, "ignored_channels": 25, "ignored_roles": 25},
  "required_channel_permissions": ["view_channel", "send_messages", "embed_links"],
  "recommended_channel_permissions": ["manage_webhooks"]
}
```

Les **libellés** ne sont pas renvoyés : ils viennent des locales du bot, à
résoudre avec `locale_keys`. `unimplemented` liste les événements déclarés dont
aucune source n'émet aujourd'hui (9 dans `moderation`) — à griser, pas à masquer.

### `GET /guilds/{guild_id}/modules/logs/diagnostics`

État réel de chaque salon de destination de la config **actuellement en base**. À
afficher après une sauvegarde : les permissions peuvent disparaître *après* coup,
et `manage_webhooks` n'a jamais bloqué.

```json
{
  "guild_id": "123456789012345678",
  "enabled": true,
  "checked": true,
  "channels": [
    {
      "channel_id": "111111111111111111",
      "exists": true, "is_thread": false, "unsupported_type": false,
      "ok": true,
      "missing_permissions": [],
      "degraded_permissions": ["manage_webhooks"],
      "categories": ["server", "moderation"]
    }
  ]
}
```

`checked: false` = Discord n'a pas pu être interrogé (token absent, API
injoignable) : rien à conclure, ce n'est pas un diagnostic négatif.

### `DELETE /guilds/{guild_id}/modules/logs`

Désactive le module en écrivant `{}` dans `data.modules.logs` — **sans retirer la
clé**, contrairement au `DELETE` générique : côté bot une config vide *est* une
suppression, et c'est la forme qu'écrit `/config`.

```json
{"guild_id": "123…", "module_id": "logs", "status": "disabled", "config": {}, "enabled": false}
```

**Actions :** écrit `{}`, invalide le cache, publie `module_disabled` sur `moddy:bot`.

> **Webhooks orphelins :** délier un salon ne supprime pas le webhook `Moddy Logs`
> que le bot y avait créé — il devient inerte mais reste visible dans les
> intégrations du salon. Le backend n'en supprime aucun ; si le dashboard veut
> nettoyer, c'est à lui de le faire, et seulement pour le salon délié.

---

## Module — Tickets

`tickets` gère les panneaux de tickets (un message Discord porteur de boutons ou
d'un menu) et les salons de support qu'ils créent. Le module a **deux moitiés
d'état** : la **configuration** (`guilds.data.modules.tickets`, lue/écrite par le
endpoint générique) et l'**état vivant** (table `tickets`, propriété du bot,
**lecture seule** côté backend). Détails complets : `docs/TICKETS.md`.

**Structure stockée** (`guilds.data.modules.tickets`) :

```json
{
  "panels": [
    {
      "id": "p_a1b2c3",
      "name": "Support",
      "channel_id": "123456789012345678",
      "message_id": "987654321098765432",
      "title": "Besoin d'aide ?",
      "description": "Choisis une catégorie",
      "accent_color": 5793266,
      "style": "buttons",
      "placeholder": null,
      "enabled": true,
      "categories": [
        {
          "id": "c_d4e5f6",
          "name": "Support général",
          "emoji": "<:support:123456789012345678>",
          "description": "Une question, un souci",
          "button_style": "primary",
          "discord_category_id": "111111111111111111",
          "allowed_role_ids": [], "denied_role_ids": [], "ping_role_ids": ["222222222222222222"],
          "permissions": {"222222222222222222": ["view", "close", "staff_thread"]},
          "ping_staff_roles": true,
          "claim_enabled": true,
          "claim_lock": false,
          "buttons": null,
          "open_message": null, "close_message": null,
          "name_format": "ticket-{number}",
          "max_open_per_user": 1,
          "enabled": true
        }
      ]
    }
  ],
  "enabled": true
}
```

| Champ | Type | Défaut | Contrainte |
|---|---|---|---|
| `panels[].id` | str | généré `p_` + 6 hex | **Stable** (voyage dans les `custom_id`). Doublon → 422 |
| `panels[].name` | str | — | **Requis**, ≤60. Vide → 422 (le bot supprimerait le panneau) |
| `panels[].channel_id` | str \| null | `null` | Salon texte/annonces du serveur. `null` = brouillon valide |
| `panels[].message_id` | str \| null | reconduit | **Écrit par le bot** — à round-tripper, jamais inventé |
| `panels[].title` / `description` | str \| null | `null` | ≤100 / ≤2000 |
| `panels[].accent_color` | int \| null | `null` | `0..0xFFFFFF` |
| `panels[].style` | str | `buttons` | `buttons` \| `select` |
| `panels[].placeholder` | str \| null | `null` | ≤150, style `select` uniquement |
| `panels[].enabled` | bool | `true` | |
| `categories[].id` | str | généré `c_` + 6 hex | **Stable** (référencé par `tickets.category_id`). Doublon → 422 |
| `categories[].name` | str | — | **Requis**, ≤60 |
| `categories[].emoji` | str \| null | `null` | ≤64 |
| `categories[].description` | str \| null | `null` | ≤100 (option du menu) |
| `categories[].button_style` | str | `primary` | `primary` \| `secondary` \| `success` \| `danger` |
| `categories[].discord_category_id` | str \| null | `null` | Doit être une **catégorie** Discord |
| `categories[].allowed_role_ids` | array de str | `[]` | `[]` = tout le monde |
| `categories[].denied_role_ids` | array de str | `[]` | Gagne toujours, même sur un admin |
| `categories[].ping_role_ids` | array de str | `[]` | Mentionnés à l'ouverture |
| `categories[].permissions` | object | `{}` | Clés = role_id **en chaîne**, valeurs parmi `view`, `close`, `claim`, `unclaim_others`, `staff_thread`, `rename`, `move`, `participants`, `admin`. Inconnue → 422 |
| `categories[].ping_staff_roles` | bool | `true` | Mentionne aussi, à l'ouverture, les rôles qui ont `view` sur la catégorie |
| `categories[].claim_enabled` | bool | `true` | Prise en charge + pastille de couleur dans le nom du salon |
| `categories[].claim_lock` | bool | `false` | Claim ⇒ seuls claimeur, responsables, auteur et participants manuels **écrivent** ; les autres lisent |
| `categories[].buttons` | array de str \| null | `null` | `close`, `claim`, `escalate`, `staff_thread`, `participants`, `close_request`. Inconnu → 422. **`null` ≠ `[]`** (voir ci-dessous) |
| `categories[].open_message` | str \| null | `null` | ≤2000 — **le message entier** (titre + corps + footer) |
| `categories[].close_message` | str \| null | `null` | ≤2000 |
| `categories[].name_format` | str | `ticket-{number}` | ≤90 |
| `categories[].max_open_per_user` | int | `1` | `1..10` |
| `categories[].enabled` | bool | `true` | |

**Snowflakes** : entiers ou chaînes acceptés à l'écriture, **stockés en entiers**,
**renvoyés en chaînes**. `enabled` (racine) est **calculé** (au moins un panneau
`enabled`), jamais stocké : envoyé par un client, il est ignoré.

**Quotas** : 3 panneaux / 5 catégories par panneau en free, 10 / 15 en premium.
Plafonds Discord par-dessus : 15 catégories en style `buttons`, 25 en `select`.

> **Langue.** Les textes générés par le bot dans un ticket (panneaux, messages
> d'ouverture par défaut, cartes) suivent la langue du **serveur**
> (`GET/PUT /guilds/{id}/settings/language`) depuis 2026-08. `categories[].locale`
> a été supprimée : elle est retirée à la lecture comme avant écriture, n'est plus
> validée, et une écriture qui la porte est sans effet.

**`buttons` — trois cas non équivalents** : clé absente ou `null` → les défauts du
bot (`close`, `claim`, `escalate`, `staff_thread`, `participants`) ; `[]` → aucun
bouton, tout passe par les commandes `/ticket` ; une liste → exactement ces
boutons. L'ordre stocké est ignoré (c'est celui du bot qui rend), les doublons
sont retirés, un bouton inconnu part en 422.

**`open_message` est le message entier** : le bot n'ajoute plus ni titre
(`### Ticket #42`) ni ligne meta autour. Une ligne contenant uniquement `---` y
devient un vrai séparateur Components V2. `null` = le défaut **localisé** du bot :
à round-tripper tel quel, jamais à recopier — le dashboard qui veut le pré-remplir
lit les fichiers de locale, sinon les deux textes divergent au prochain wording.

### `GET /guilds/{guild_id}/modules/tickets`

Config stockée, snowflakes en chaînes, plus `enabled`.

### `PUT` / `PATCH /guilds/{guild_id}/modules/tickets`

⚠️ **Remplacement complet de l'objet**, pour les deux verbes : lire, muter,
réécrire en entier.

**Validation (422)** : schéma ci-dessus, puis quotas free/premium et — quand
Discord répond — le salon du panneau existe, est un salon texte/annonces et le bot
y a `view_channel` + `send_messages` + `embed_links` ; la `discord_category_id`
existe et est bien une catégorie. Discord injoignable → les contrôles Discord sont
sautés (le bot reste juge final), les quotas restent appliqués.

**409** : une sauvegarde des tickets est déjà en vol pour ce serveur. Le bot
réécrit tout le nœud `modules.tickets` après avoir republié les panneaux
(last-writer-wins) : deux sauvegardes concurrentes s'écrasent, donc le backend
n'en laisse passer qu'une à la fois (verrou Redis, TTL 45 s). À retenter dans
quelques secondes.

**Actions** : écrit `data.modules.tickets`, invalide `guild:{id}:config`, pousse
une tâche **signée** `update_panel` sur `moddy:tasks` (payload
`{module_id: "tickets", action: "updated", request_id}` — jamais de valeurs de
config, le bot relit la base), attend l'accusé `module_config_applied` sur
`moddy:dashboard` (25 s) et le renvoie sous `_apply`.

**Réponse** : config + `enabled` + `_apply`.

```json
{
  "panels": [ "…" ],
  "enabled": true,
  "_apply": {
    "type": "module_config_applied", "ok": true, "action": "updated",
    "enabled": true, "panels": 2, "panels_posted": 2, "panels_failed": 0
  }
}
```

> **`_apply.panels_failed > 0` doit être affiché à l'admin** : la sauvegarde est
> enregistrée mais le panneau n'est pas visible (cause n°1 : le bot n'a pas
> *Envoyer des messages* dans le salon, permission perdue après la sauvegarde).
> `_apply.ok: false` + `error` = le bot n'a pas rechargé.
> `_apply.error: "bot_timeout"` = pas d'accusé dans les 25 s ; la tâche reste dans
> le stream et sera exécutée au redémarrage du bot — **ne pas réécrire**.

### `DELETE /guilds/{guild_id}/modules/tickets`

Retire `data.modules.tickets` et demande au bot de retirer **tous** les messages
de panneau (`action: "deleted"`). Réponse : `{guild_id, module_id, status, _apply}`.

> Supprimer la config **ne ferme pas** les tickets ouverts et ne supprime aucun
> salon : les lignes de la table `tickets` restent.

### `GET /guilds/{guild_id}/modules/tickets/limits`

Quotas applicables **et** consommation actuelle, pour griser « Ajouter un
panneau / une catégorie » avant l'envoi.

```json
{
  "guild_id": "123456789012345678",
  "premium": false,
  "enabled": true,
  "max_panels": 3,
  "max_categories_per_panel": 5,
  "discord_max_categories_per_panel": {"buttons": 15, "select": 25},
  "panels": 2,
  "categories": {"p_a1b2c3": 4, "p_9f8e7d": 1}
}
```

### `GET /guilds/{guild_id}/tickets`

Tickets qui existent réellement, les plus récents d'abord (par `number`).
**Lecture seule** — la table appartient au bot.

Query : `status` (`open`\|`closed`), `panel_id`, `category_id`, `owner_id`,
`limit` (1..200, défaut 50), `offset`.

```json
{
  "tickets": [
    {
      "id": 42,
      "guild_id": "123456789012345678",
      "channel_id": "444444444444444444",
      "panel_id": "p_a1b2c3", "category_id": "c_d4e5f6",
      "number": 42,
      "owner_id": "555555555555555555",
      "status": "open",
      "escalated": false,
      "claimed_by": "666666666666666666", "claimed_at": "2026-08-23T10:05:00Z",
      "pre_escalation_claim": null, "escalation_mute": false,
      "staff_thread_id": null,
      "participants": [], "participant_roles": [],
      "close_requested_by": null, "close_request_reason": null,
      "opened_at": "2026-08-23T10:00:00Z",
      "closed_at": null, "closed_by": null, "close_reason": null,
      "category": {"name": "Support général", "panel_id": "p_a1b2c3", "panel_name": "Support"}
    }
  ],
  "total": 1, "limit": 50, "offset": 0
}
```

`category: null` = la catégorie a disparu de la config (ticket **orphelin**).
`number` est le compteur par serveur — c'est ce que les humains citent.

`claimed_by` = l'agent qui s'en occupe maintenant (`null` = non pris en charge) ;
`pre_escalation_claim` = le claim mis de côté pendant une escalade. Les deux ne
sont **jamais** renseignés en même temps. La pastille de couleur du nom du salon
(`🔴🟢🟣⚫`) est dérivée de cet état côté bot, jamais stockée : ne pas la parser.

> Ces quatre champs sont ajoutés à la table par le bot à son démarrage. Si le
> backend tourne avant lui, ils sont servis à `null` / `false` (et
> `stats.claimed` à `0`) plutôt que de faire échouer la route — l'état réel d'une
> base non migrée. **Déployer le bot en premier** pour les voir.

### `GET /guilds/{guild_id}/tickets/stats`

Compteurs du serveur + volume par catégorie sur `days` jours (1..365, défaut 30).

```json
{
  "guild_id": "123456789012345678",
  "total": 128, "open": 12, "closed": 116, "escalated": 3, "close_requested": 1,
  "claimed": 5,
  "avg_resolution_seconds": 7412.5,
  "window_days": 30,
  "by_category": [
    {"panel_id": "p_a1b2c3", "category_id": "c_d4e5f6", "total": 61,
     "category": {"name": "Support général", "panel_id": "p_a1b2c3", "panel_name": "Support"}}
  ]
}
```

`claimed` compte les tickets **ouverts** actuellement pris en charge.
`avg_resolution_seconds` est `null` tant qu'aucun ticket n'a été fermé. `closed`
compte des salons qui **existent toujours** dans Discord : fermer ne supprime pas
le salon.

### `GET /guilds/{guild_id}/tickets/orphans`

Tickets **ouverts** dont la catégorie n'existe plus dans la config (`limit`
1..200, défaut 100). Supprimer une catégorie ne ferme pas ses tickets : le bot
répond « catégorie disparue » à toute action tant qu'ils n'ont pas été déplacés.
À proposer dans l'UI **avant** toute suppression de catégorie.

```json
{"guild_id": "123…", "tickets": [ "…" ], "count": 2}
```

---

## Cases (moderation)

Schéma unifié `cases`/`case_sanctions`/`case_events`/`case_appeals`, partagé avec
le bot. **Lecture** en SQL direct ; **écriture** directe en base pour les cases
globales/réseau (référence unique, event `sanction_added`, recalcul de statut
réimplémentés). Les cases `guild` sont éditables (raison/statut/notes en direct DB)
mais leurs **sanctions** sont déléguées au bot via `moddy:tasks`. Détails :
`docs/MODERATION_CASES.md` (§4.2). **Note :** `case_type = platform` et
`sanction_action = kick` sont retirés du flux actif (lecture d'historique seulement).

**Les lectures restent accessibles à un utilisateur suspendu** (son périmètre
habituel : ses propres cases et celles de ses serveurs) — c'est l'équivalent du
`/mycases` que le bot laisse ouvert pour contester une sanction. Les écritures
restent réservées au staff modérateur.

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

## Violations (sanctions globales)

Projection en **lecture seule** de `cases` + `case_sanctions` + `case_enforcements`,
filtrée sur `type = 'global'` et groupée par `cases.group_id` : une infraction =
plusieurs cases partageant un groupe (l'utilisateur ET ses serveurs, par exemple).
C'est ce qui alimente moddy.app/violations. Rien ne s'écrit ici (les sanctions se
posent via `POST /cases` ou le bot).

**Auth : session** — accessible même à un compte **suspendu** : il doit pouvoir
consulter ce qu'on lui reproche. Un non-staff ne voit que ses propres infractions
et celles des serveurs qu'il administre ; le staff voit tout.

Niveaux : `none` < `warn` < `limited` (`restrict`) < `suspended` (`ban`).
Effets et blocages : `docs/GLOBAL_SANCTIONS.md`.

### `GET /violations`

Query : `subject_type` (`discord_user`|`discord_guild`), `subject_id`,
`level` (`warn`|`restrict`|`ban`), `limit` (≤100), `offset`.

```json
[
  {
    "group_id": "0e5f6b0a-…",
    "grouped": true,
    "level": "suspended",
    "actions": ["ban", "restrict"],
    "active_actions": ["ban"],
    "active": true,
    "reason": "Coordinated raid",
    "case_count": 2,
    "references": ["A7F2K9", "B8G3L2"],
    "subjects": [
      {"subject_type": "discord_guild", "subject_id": "222"},
      {"subject_type": "discord_user", "subject_id": "111"}
    ],
    "created_at": "2026-08-10T12:00:00Z",
    "updated_at": "2026-08-10T12:00:00Z",
    "enforcement": {
      "group_id": "0e5f6b0a-…",
      "level": "suspended",
      "status": "pending",
      "deadline": "2026-08-12T12:00:00Z",
      "premium": true,
      "notified": true,
      "halted_by": null,
      "halted_reason": null,
      "halted_at": null,
      "executed_at": null
    }
  }
]
```

`grouped: false` = ancienne case globale sans `group_id` : le `group_id` renvoyé est
alors l'UUID de la case. `enforcement` vaut `null` pour un `warn` (pas de compte à
rebours) et tant que la table `case_enforcements` n'existe pas.
`status` ∈ `pending` | `halted` | `executed` | `cancelled`.

### `GET /violations/status`

Query : `guild_id` (optionnel, doit être un serveur de l'utilisateur).

```json
{
  "user": {
    "subject_type": "discord_user",
    "subject_id": "111",
    "level": "limited",
    "action": "restrict",
    "suspended": false,
    "restricted": true,
    "sanctions": [
      {
        "case_id": "…", "reference": "A7F2K9", "group_id": "…",
        "action": "restrict", "level": "limited", "reason": "Coordinated raid",
        "sanctioned_at": "2026-08-10T12:00:00Z",
        "expires_at": "2026-08-17T12:00:00Z", "expires_in_seconds": 518400
      }
    ]
  },
  "guild": { "…": "même forme, présent seulement si guild_id est fourni" }
}
```

Le dashboard s'en sert pour son bandeau et pour griser ce qui est bloqué, sans
attendre un `403`.

### `GET /violations/{group_id}`

Détail d'une infraction : `group_id`, `level`, `actions`, `active_actions`,
`active`, `cases` (chaque case avec ses `sanctions`), `enforcement`, et
`appeal_url` (moddy.app/support — l'appel est traité par un humain).
`404` si l'infraction n'existe pas **ou** n'est pas visible par l'appelant.

---

## Notifications

Tout ce que Moddy dit à un humain (DM Discord, avis à un serveur, mail, carte du
dashboard) est **une** notification : une ligne avec un uuid, un template et les
variables substituées pour ce destinataire-là. **Le bot écrit, le backend lit et
rend** — voir `docs/NOTIFICATIONS.md`.

Règles communes à tous les endpoints ci-dessous :

- le champ `content` est **résolu** (plus aucune accolade), jamais le template ;
- `accent_color` est un hex CSS, `icon_url` une URL CDN Discord ou `null` ;
- snowflakes en **chaînes**, dates en ISO-8601 UTC suffixé `Z` ;
- pagination **keyset** : `next` vaut `"<created_at>,<uuid>"`, à repasser en
  `?before=`. `next: null` = dernière page. Un curseur illisible → `422` ;
- une notification qu'on n'a pas le droit de lire répond **404** (jamais 403 :
  l'endpoint ne doit pas servir à tester l'existence d'un uuid) ;
- accessible à un compte **suspendu** (`session`) : l'avis de suspension est
  lui-même une notification.

### `GET /notifications`

Mes notifications, les plus récentes d'abord. Query : `limit` (≤100, défaut 25),
`before`.

```json
{
  "items": [
    {
      "id": "0f2a4e2e-…",
      "created_at": "2026-08-26T10:14:03Z",
      "locale": "fr",
      "kind": "guild",
      "author": "guild",
      "reportable": true,
      "report_block": null,
      "source": {
        "service_id": "welcome_dm",
        "service_label": "Welcome message",
        "guild_id": "1421493239579676682",
        "guild_name": "Moddy",
        "guild_icon": "a1b2c3",
        "verified": true,
        "official": false,
        "guild_url": "https://discord.com/channels/1421493239579676682"
      },
      "content": {
        "title": "Moddy",
        "body": "Bienvenue <@7> sur **Moddy** !",
        "sections": [{"title": "Règles", "body": "Lis #rules"}],
        "links": [{"label": "Ouvrir le serveur", "url": "https://discord.com/channels/1421493239579676682"}],
        "footer": "Envoyé par Moddy",
        "icon_url": "https://cdn.discordapp.com/emojis/1519789691711393982.webp",
        "accent_color": "#5865F2",
        "template_id": "welcome_dm.wdm_a1b2"
      },
      "delivery": {"discord": {"status": "sent", "message_id": "1554444444444444444"}}
    }
  ],
  "next": "2026-08-26T10:14:03Z,0f2a4e2e-…"
}
```

`kind = "official"` (Moddy en tant qu'institution) → `source: null` : il n'y a
aucun tiers à nommer.

`report_block` explique l'absence du bouton « signaler » avec les mots du bot :
`moddy_authored` (les mots sont ceux de Moddy) ou `official_guild` (serveur
officiel). `null` = signalable. **Le dépôt d'un signalement n'existe pas encore
côté dashboard** (il poste aussi un panneau Discord, côté bot) : `reportable` est
une information affichée, pas une action offerte.

`delivery.discord.status` vaut `sent` / `failed` / `skipped` / `pending` : un
membre dont les DM sont fermés voit ici le message qu'il n'a jamais reçu.

### `GET /notifications/{id}`

Une notification dont je suis le destinataire — ou dont j'administre le serveur
destinataire. Même objet qu'un `items[]` ci-dessus. `404` sinon.

### `GET /guilds/{guild_id}/notifications`

**Auth : admin du serveur.** Ce que CE serveur a envoyé à travers Moddy
(bienvenue, tickets, automod…). Ce sont ses propres mots, mais ils nomment ses
membres : données personnelles. Query : `service`, `limit`, `before`.

### `GET /guilds/{guild_id}/notifications/inbox`

**Auth : admin du serveur.** Ce que Moddy a adressé à ce serveur (avis de
sanction globale, annonces). Query : `limit`, `before`.

### Staff

**Auth : staff.** Rien ne s'écrit : `notification_reports` en particulier est en
lecture seule (décider édite aussi le panneau Discord, les logs et le DM au
signaleur).

| Endpoint | Contenu |
|---|---|
| `GET /staff/notifications` | recherche : `recipient_id`, `guild_id`, `service`, `batch_id`, `kind`, `limit`, `offset` |
| `GET /staff/notifications/{id}` | vue complète : livraisons par plateforme, template brut, `content_hash` + `content_uses`, `variables`, `actor_id`, signalements |
| `GET /staff/notifications/campaigns` | diffusions récentes (une ligne par `batch_id`) |
| `GET /staff/notifications/campaigns/{batch_id}` | avancement : compteurs par (plateforme, statut) |
| `GET /staff/notifications/templates` | formulations les plus envoyées (`hash`, `uses`, `template_id`) |
| `GET /staff/notifications/reports` | signalements (`status`, `notification_id`, `limit`, `offset`) + `review_url` vers le fil Discord |
| `GET /staff/notifications/metrics` | file de livraison `email` / `dashboard` et signalements ouverts |

`actor_id`, `variables`, le `recipient_id` d'un tiers et les raisons de
signalement **ne sortent jamais** de ces surfaces.

```json
// GET /staff/notifications/metrics
{
  "platforms": {
    "email": {"pending": 3, "oldest_seconds": 42},
    "dashboard": {"pending": 0, "oldest_seconds": null}
  },
  "reports_open": 1
}
```

`oldest_seconds` est la métrique à alarmer : une ligne `pending` de plus d'une
heure est un bug du worker de livraison, pas un fournisseur lent.

## Brocoli (assistant IA)

Assistant conversationnel du backend. Le **genre** (`kind`) est décidé à partir
de l'authentification, jamais du corps de la requête, et revérifié à **chaque**
requête — voir `docs/AI_ASSISTANT.md`.

Règles communes à tous les endpoints ci-dessous :

- **Auth : `current_user`** partout (cookie de session ou `Authorization: Bearer`) ;
- une conversation appartient à la personne qui l'a ouverte : la reprendre depuis
  un autre compte répond **403** ;
- snowflakes en **chaînes**, dates en ISO-8601 UTC ;
- assistant non configuré (`OPENAI_API_KEY` absente) ou coupe-circuit armé
  (`AI_ASSISTANT_ENABLED=false`) → **503** sur les trois endpoints d'écriture
  (`POST /ai/conversations`, `POST …/messages`, `POST …/decision`). `GET /ai/status`
  répond toujours ;
- les deux endpoints de tour rendent un flux **`text/event-stream`**, pas du JSON
  (7 types d'événements, §SSE plus bas).

### `GET /ai/status`

Disponibilité de l'assistant et quota restant de l'appelant.

**Auth :** connecté

**Réponse :**

```json
{
  "enabled": true,
  "model": "gpt-5.6-luna",
  "modes": ["read_only", "ask", "auto"],
  "default_mode": "ask",
  "quota": {
    "available": true,
    "messages_used_today": 12,
    "messages_limit": 100,
    "guild_messages_used_today": null,
    "guild_messages_limit": null,
    "resets_in_seconds": 41230
  }
}
```

`model` vaut `null` si `enabled` est `false`. Redis indisponible → `quota` vaut
`{"available": true, "detail": "compteurs indisponibles"}`.

---

### `POST /ai/conversations`

Ouvre une conversation.

**Auth :** connecté ; staff si `kind = support_staff` ; accès au serveur si
`kind = guild_config`

**Body :**

```json
{
  "kind": "guild_config",
  "mode": "ask",
  "guild_id": "1421493239579676682",
  "title": "Mise en place des tickets"
}
```

| Champ | Type | Défaut | Note |
|---|---|---|---|
| `kind` | string | `guild_config` | `guild_config`, `support_user`, `support_staff` |
| `mode` | string | `ask` | `read_only`, `ask`, `auto` |
| `guild_id` | string (optionnel) | `null` | **requis** pour `guild_config` |
| `subject_user_id` | string (optionnel) | `null` | `support_staff` ; forcé à l'appelant en `support_user` |
| `subject_guild_id` | string (optionnel) | `null` | `support_staff` |
| `title` | string (optionnel) | `null` | nettoyé, tronqué à 120 caractères |

Une conversation `support_staff` doit désigner **au moins un** sujet
(`subject_user_id` et/ou `subject_guild_id`). Le sujet est figé : aucun endpoint
ne le modifie.

**Réponse :**

```json
{
  "id": "0f2a4e2e-8c1d-4c2b-9d3a-6b5e1f0a7c44",
  "kind": "guild_config",
  "mode": "ask",
  "guild_id": "1421493239579676682",
  "user_id": "708006478807793776",
  "subject_user_id": null,
  "subject_guild_id": null,
  "actor_is_staff": false,
  "title": "Mise en place des tickets",
  "created_at": "2026-08-29T10:14:03+00:00",
  "updated_at": "2026-08-29T10:14:03+00:00",
  "archived_at": null
}
```

**Erreurs :** `422` (mode ou genre inconnu, `guild_id` manquant pour
`guild_config`, sujet manquant pour `support_staff`, identifiant non numérique),
`403` (pas staff, pas d'accès au serveur, serveur suspendu), `503`

---

### `GET /ai/conversations`

Les 30 conversations non archivées de l'appelant, `updated_at` décroissant.

**Auth :** connecté

**Réponse :** `{ "conversations": [ … ] }` (même objet que ci-dessus)

---

### `GET /ai/conversations/{conversation_id}`

Conversation et transcript affichable.

**Auth :** propriétaire de la conversation

**Réponse :**

```json
{
  "conversation": { "…": "…" },
  "messages": [
    { "id": 41, "seq": 1, "role": "user",
      "content": {"text": "Active les tickets"},
      "tokens_in": null, "tokens_out": null,
      "created_at": "2026-08-29T10:14:05+00:00" },
    { "id": 45, "seq": 5, "role": "action",
      "content": {"action_id": "6d1c8f0a-…", "kind": "set_module_config",
                  "risk": "high", "status": "pending",
                  "summary": "Crée un panneau « Support » dans #aide",
                  "call_id": "call_3"},
      "tokens_in": null, "tokens_out": null,
      "created_at": "2026-08-29T10:14:20+00:00" }
  ]
}
```

Seuls les rôles `user`, `assistant` et `action` sont rendus : les `tool_call` et
`tool_result` bruts ne servent pas au dashboard.

**Erreurs :** `404` conversation inexistante, `403` conversation d'un autre

---

### `PATCH /ai/conversations/{conversation_id}`

Change le mode et/ou le titre.

**Auth :** propriétaire de la conversation

**Body :**

```json
{ "mode": "auto", "title": "Tickets — support" }
```

| Champ | Type | Valeurs acceptées |
|---|---|---|
| `mode` | string (optionnel) | `read_only`, `ask`, `auto` |
| `title` | string (optionnel) | texte libre, tronqué à 120 |

Un champ absent n'est pas modifié.

**Réponse :** la conversation mise à jour

**Erreurs :** `422` mode inconnu, `404`, `403`

---

### `DELETE /ai/conversations/{conversation_id}`

Archive la conversation (`archived_at` posé, sortie du listing). Rien n'est
supprimé.

**Auth :** propriétaire de la conversation

**Réponse :**

```json
{ "conversation_id": "0f2a4e2e-…", "status": "archived" }
```

**Erreurs :** `404`, `403`

---

### `POST /ai/conversations/{conversation_id}/messages`

Envoie un message et rend la réponse en **SSE**.

**Auth :** propriétaire de la conversation

**Body :**

```json
{ "message": "Active le starboard à partir de 5 étoiles", "mode": "auto" }
```

| Champ | Type | Note |
|---|---|---|
| `message` | string | requis, non vide après nettoyage (max 8 000 caractères) |
| `mode` | string (optionnel) | **persisté** sur la conversation avant le tour |

**Réponse :** `200`, `Content-Type: text/event-stream`,
`Cache-Control: no-store`, `X-Accel-Buffering: no`

**Erreurs :** `422` message vide ou mode inconnu · `429` quota du jour atteint,
avec en-tête **`Retry-After`** (secondes jusqu'à minuit UTC) · `409` un tour est
déjà en cours sur cette conversation (un seul en vol, verrou Redis) · `503` ·
`404` / `403`

---

### `POST /ai/conversations/{conversation_id}/actions/{action_id}/decision`

Approuve ou refuse une action en attente et **reprend le tour**, en SSE.

**Auth :** propriétaire de la conversation

**Body :**

```json
{ "decision": "approve" }
```

| Champ | Type | Valeurs acceptées |
|---|---|---|
| `decision` | string | `approve`, `deny` |

La transition `pending` → `approved`/`denied` se fait par un `UPDATE … WHERE
status = 'pending' AND expires_at > now()` : deux clics simultanés ne peuvent pas
exécuter l'action deux fois.

**Réponse :** `200`, flux SSE (même contrat que ci-dessus)

**Erreurs :** `422` décision invalide · `404` action inexistante ou rattachée à
une autre conversation · `409` « Action déjà traitée » ou « Action expirée —
redemande à Brocoli de la reformuler » · `409` un tour est déjà en cours ·
`503` · `403`

---

### Flux SSE — 7 événements

Noms du backend, pas ceux d'OpenAI. `data` est du JSON compact ; les entiers
dépassant 2^53-1 sont convertis en chaînes comme sur les autres réponses.

| Événement | `data` |
|---|---|
| `message_start` | `{"conversation_id": "<uuid>"}` |
| `text_delta` | `{"delta": "…"}` — fragment à concaténer |
| `tool_call` | `{"call_id": "call_1", "name": "get_module_config", "arguments": "{\"module_id\":\"tickets\"}"}` — `arguments` est une **chaîne JSON** |
| `tool_result` | `{"call_id": "call_1", "name": "get_module_config", "ok": true}` — jamais le contenu du résultat |
| `permission_request` | `{"action_id", "kind", "risk", "status", "preview", "expires_at", "requires_confirmation": true}` |
| `run_end` | `{"status": "completed" \| "awaiting_confirmation" \| "max_iterations" \| "error", "usage": {…}}` |
| `error` | `{"code", "message"}` — codes : `timeout`, `network`, `rate_limited`, `upstream`, `bad_request`, `stream_error`, `ai_unavailable`, `internal` |

`usage` (`{"input_tokens", "output_tokens", "total_tokens"}`) n'accompagne que
`completed` et `awaiting_confirmation`. Un `error` est toujours suivi d'un
`run_end`.

`permission_request.preview` porte `{"summary"}` pour la plupart des actions, et
pour une config de module `{"summary", "module_id", "valid", "errors", "diff"}`
où `diff` est une liste plate `{"path", "op", "before", "after"}` (`op` :
`added` / `removed` / `changed`, 200 entrées au maximum). `params` n'est jamais
exposé.

Un tour arrêté sur une confirmation se termine par `permission_request` puis
`run_end: awaiting_confirmation`, et la connexion est fermée : la suite arrive
dans le flux de `POST …/decision`. Voir `docs/AI_ASSISTANT.md` §6 pour la
séquence complète et §7 pour le guide d'intégration dashboard.


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

`is_premium` tient compte des sanctions globales, comme
`GET /guilds/{id}/premium` : un serveur limité/suspendu, ou dont l'abonné l'est,
n'est plus premium.

---

## Bot (profil global)

### `GET /bot/profile`

Avatar, banniere et bio **actuels** du bot, lus **en direct sur Discord** (pas en
DB). A ne pas confondre avec `guilds.data.modules.bot_customization` (personnalisation
PAR GUILDE, ecrite par le bot) : ceci reflete le profil GLOBAL de l'application,
tel qu'affiche par Discord partout ou aucune personnalisation de guilde ne
s'applique.

Combine `GET /users/{id}` (bot token — avatar/banniere globaux, meme cache que
`GET /users/{user_id}`) et `GET /applications/{id}/rpc` (public Discord — bio,
onglet "A propos" du profil de l'application).

**Auth :** utilisateur connecte (session cookie)
**Cache :** Redis `discord:user:{bot_id}` (avatar/banniere, TTL 5min) + `discord:app:{bot_id}:rpc` (bio, TTL 5min)

**Reponse :**

```json
{
  "id": "942386103000000000",
  "username": "moddy",
  "avatar_url": "https://cdn.discordapp.com/avatars/942386103000000000/a_1c9e4f2b.gif?size=256",
  "banner_url": "https://cdn.discordapp.com/banners/942386103000000000/b_77f2a91d.png?size=256",
  "accent_color": 5793266,
  "bio": "Le bot de moderation tout-en-un pour Discord."
}
```

| Champ | Type | Description |
|---|---|---|
| `id` | string | Discord ID du bot (= `DISCORD_CLIENT_ID`) |
| `username` | string | Nom d'utilisateur Discord du bot |
| `avatar_url` | string\|null | URL CDN de l'avatar global |
| `banner_url` | string\|null | URL CDN de la banniere globale |
| `accent_color` | int\|null | Couleur d'accent (si pas de banniere) |
| `bio` | string\|null | Description de l'application (`null` si le RPC Discord est injoignable — best-effort, ne fait pas echouer l'appel) |

**Erreurs :**

| Code | Description |
|---|---|
| `404` | Bot introuvable sur Discord |
| `429` | Rate limit Discord atteint |
| `502` | Erreur API Discord |
| `503` | Bot token non configure |

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

**Erreur (sanction globale) :** `403 premium_blocked_user` — un compte **limite** ou
**suspendu** ne peut pas souscrire (« pas de premium ») : aucun lien de paiement
n'est cree, la session Stripe n'est meme pas ouverte. Le portail
(`POST /stripe/portal`) reste accessible pour resilier.

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
  "blocked_by_global_sanction": false,
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
| `is_active` | bool | `tier != null AND (expires_at == null OR expires_at > now())`, **et** aucune sanction globale en cours |
| `blocked_by_global_sanction` | bool | `true` = compte limite/suspendu : l'abonnement existe mais ne donne plus rien (il sera resilie a l'echeance de l'appel) |
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
| `403` | `premium_blocked_user` / `premium_blocked_guild` — abonne ou serveur sous sanction globale **limite**/**suspendu** |
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

Volontairement **non bloque** par une sanction globale « limite » : on n'empeche pas
quelqu'un de resilier. C'est la creation d'un paiement (`create-checkout`) qui est
refusee.

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
