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

### `PATCH /guilds/{guild_id}/modules/{module_id}`

Modifier la config d'un module. Remplace entierement la config du module.

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

**Actions declenchees :**
1. `UPDATE guilds SET data = jsonb_set(data, '{modules,starboard}', $3::jsonb) WHERE guild_id = $1`
2. Invalide le cache : `DEL guild:{id}:config`
3. Notifie le bot (Pub/Sub) : `PUBLISH moddy:bot {"type": "module_updated", "guild_id": 123, "module_id": "starboard"}`
4. Si `update_panel: true` dans le body → ajoute une tache critique (Redis Stream) : `XADD moddy:tasks * type update_panel guild_id 123 payload {...}`

**Reponse :** config mise a jour

```json
{"channel_id": 999, "reaction_count": 3, "emoji": "🌟"}
```

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

## Cases (moderation)

### `GET /cases`

Liste les cases de moderation. **Staff only.**

**Auth :** staff
**Query params (tous optionnels) :**

| Param | Type | Description |
|---|---|---|
| `entity_id` | int | Filtrer par ID de l'entite sanctionnee |
| `entity_type` | string | `"user"` ou `"guild"` |
| `case_type` | string | `"global"` ou `"interserver"` |
| `status` | string | `"open"` ou `"closed"` |
| `limit` | int | Max 100, defaut 50 |
| `offset` | int | Defaut 0 |

**Reponse :**

```json
[
  {
    "case_id": "A1B2C3D4",
    "case_type": "global",
    "sanction_type": "global_blacklist",
    "entity_type": "user",
    "entity_id": 123456789,
    "status": "open",
    "reason": "Spam massif",
    "evidence": "https://...",
    "duration": null,
    "staff_notes": [
      {"staff_id": 987654321, "note": "Recidive", "timestamp": "2025-12-10T10:30:00+00:00"}
    ],
    "created_by": 987654321,
    "created_at": "2025-12-01T00:00:00+00:00",
    "updated_by": null,
    "updated_at": "2025-12-01T00:00:00+00:00",
    "closed_by": null,
    "closed_at": null,
    "close_reason": null
  }
]
```

---

### `GET /cases/{case_id}`

Detail d'une case. **Staff only.**

**Auth :** staff
**Path params :**

| Param | Type | Description |
|---|---|---|
| `case_id` | string | ID hex 8 chars (ex: `A1B2C3D4`) |

**Reponse :** meme format qu'un element de la liste ci-dessus

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

Liste des entites blacklistees (cases `global_blacklist` ou `guild_blacklist` avec status `open`).

**Auth :** staff
**Query params :** `limit` (max 200), `offset`
**Reponse :** array de `moderation_cases`

---

### `POST /staff/blacklist`

Ajouter une entite a la blacklist.

**Auth :** staff
**Body :**

```json
{
  "entity_type": "user",
  "entity_id": 123456789,
  "reason": "Spam massif sur plusieurs serveurs",
  "sanction_type": "global_blacklist"
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `entity_type` | string | oui | `"user"` ou `"guild"` |
| `entity_id` | int | oui | ID Discord de l'entite |
| `reason` | string | non | Raison de la blacklist |
| `sanction_type` | string | non | `"global_blacklist"` (defaut) ou `"guild_blacklist"` |

**Actions :**
1. Cree une `moderation_case` (case_id hex 8 chars, status "open")
2. Set l'attribut `BLACKLISTED` sur l'entite (`users.attributes` ou `guilds.attributes`)

**Reponse :** la case creee

---

### `DELETE /staff/blacklist/{case_id}`

Retirer une entite de la blacklist.

**Auth :** staff
**Path params :**

| Param | Type | Description |
|---|---|---|
| `case_id` | string | ID hex 8 chars de la case |

**Actions :**
1. Ferme la case (`status = "closed"`, `closed_by`, `closed_at`)
2. Retire l'attribut `BLACKLISTED` de l'entite

**Reponse :**

```json
{"deleted": true, "case_id": "A1B2C3D4"}
```

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
  (SELECT COUNT(*) FROM moderation_cases WHERE status = 'open') AS open_cases;
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
