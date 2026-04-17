# Moddy Frontend — Guide complet d'intégration API

> Ce document est destiné au développeur frontend (dashboard Vite sur `moddy.app` / `dashboard.moddy.app`).
> Il couvre tout ce qu'il faut savoir pour consommer l'API Moddy correctement.

---

## Table des matières

1. [Configuration de base](#1-configuration-de-base)
2. [Authentification & Sessions](#2-authentification--sessions)
3. [Gestion des erreurs](#3-gestion-des-erreurs)
4. [Endpoints Auth](#4-endpoints-auth)
5. [Endpoints Guilds](#5-endpoints-guilds)
6. [Endpoints Modules](#6-endpoints-modules)
7. [Endpoints Logging](#7-endpoints-logging)
8. [Endpoints Stats](#8-endpoints-stats)
9. [Endpoints Stripe (Premium)](#9-endpoints-stripe-premium)
10. [Endpoints Staff Panel](#10-endpoints-staff-panel)
11. [Flux complets step-by-step](#11-flux-complets-step-by-step)
12. [Référence des types TypeScript](#12-référence-des-types-typescript)

---

## 1. Configuration de base

### URL de base

```
Production : https://api.moddy.app
Dev local  : http://localhost:8080
```

### Configuration fetch / axios

**Règle absolue : toujours envoyer `credentials: "include"`** pour que le cookie de session soit transmis en cross-origin.

```typescript
// Wrapper fetch recommandé
const api = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`https://api.moddy.app${path}`, {
    ...options,
    credentials: "include",          // OBLIGATOIRE — envoie le cookie session_token
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erreur inconnue" }));
    throw new ApiError(response.status, error.error);
  }

  return response.json();
};
```

```typescript
// Avec axios
import axios from "axios";

const apiClient = axios.create({
  baseURL: "https://api.moddy.app",
  withCredentials: true,   // OBLIGATOIRE
  headers: { "Content-Type": "application/json" },
});
```

### CORS — origines autorisées

L'API accepte uniquement ces origines :
- `https://moddy.app`
- `https://www.moddy.app`
- `https://dashboard.moddy.app`
- `https://preview.moddy.app`

En dev local, configurer un proxy Vite pour éviter les problèmes CORS :

```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
};
```

---

## 2. Authentification & Sessions

### Principe

L'authentification est **entièrement basée sur les cookies** — pas de JWT, pas de localStorage.

- Le backend pose un cookie `session_token` (HttpOnly, Secure, SameSite=Lax, Domain=`.moddy.app`, TTL 30j)
- Le frontend n'a **jamais** accès direct au token (HttpOnly = pas lisible en JS)
- Chaque requête envoie automatiquement le cookie si `credentials: "include"` est configuré

### Vérifier si l'utilisateur est connecté

```typescript
// Au chargement de l'app, appeler GET /auth/me
// Si 401 → non connecté, rediriger vers login
// Si 200 → connecté, stocker les données user en mémoire

const checkAuth = async () => {
  try {
    const user = await api("/auth/me");
    // user = { user_id, username, avatar, guilds, is_staff, staff_roles }
    return user;
  } catch (e) {
    if (e.status === 401) return null; // Non connecté
    throw e;
  }
};
```

### Connexion Discord OAuth2

```typescript
// Rediriger simplement vers cette URL
// Le backend gère tout l'OAuth2, puis redirige vers le dashboard
window.location.href = "https://api.moddy.app/auth/login";
```

Optionnel : passer une URL de redirect pour revenir sur une page précise après connexion (si l'API le supporte via le paramètre `redirect`).

### Déconnexion

```typescript
await api("/auth/logout", { method: "POST" });
// Le cookie est supprimé côté serveur
// Rediriger vers la page d'accueil
window.location.href = "/";
```

### Refresh de session

```typescript
// Appeler périodiquement pour maintenir la session active (ex: toutes les 24h)
await api("/auth/refresh", { method: "POST" });
```

### Refresh de la liste des serveurs

```typescript
// Après qu'un utilisateur ajoute le bot sur un nouveau serveur,
// rafraîchir sa liste de guilds sans reconnecter
const { guilds } = await api("/auth/refresh-guilds", { method: "POST" });
// Mettre à jour l'état local avec la nouvelle liste
```

### Structure des données utilisateur (`/auth/me`)

```typescript
interface User {
  user_id: string;      // String (Discord snowflake > 32bits)
  username: string;
  avatar: string | null;
  guilds: Guild[];
  is_staff: boolean;
  staff_roles: string[];
}

interface Guild {
  id: number;
  name: string;
  icon: string | null;
}
```

### Avatar Discord

```typescript
// Construire l'URL de l'avatar Discord
const getAvatarUrl = (userId: string, avatarHash: string | null) => {
  if (!avatarHash) {
    const defaultIndex = (BigInt(userId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  }
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
};

// Icône d'un serveur
const getGuildIconUrl = (guildId: number | string, iconHash: string | null) => {
  if (!iconHash) return null;
  const ext = iconHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`;
};
```

---

## 3. Gestion des erreurs

### Format des erreurs API

Toutes les erreurs retournent :
```json
{"error": "Message descriptif de l'erreur"}
```

### Codes HTTP à gérer

| Code | Signification | Action recommandée |
|---|---|---|
| `401` | Non authentifié / session expirée | Rediriger vers `/auth/login` |
| `403` | Accès refusé (pas admin du serveur, pas staff) | Afficher un message d'erreur |
| `404` | Ressource introuvable | Page 404 ou message contextuel |
| `422` | Données invalides dans le body | Afficher les erreurs de validation |
| `500` | Erreur serveur | Message générique, retry optionnel |
| `502` | Bot Discord non disponible | Indiquer que le bot est hors ligne |

### Classe d'erreur recommandée

```typescript
class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
  ) {
    super(message);
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden()    { return this.status === 403; }
  get isNotFound()     { return this.status === 404; }
  get isServerError()  { return this.status >= 500; }
}

// Intercepteur global avec axios
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Session expirée → rediriger
      window.location.href = "/login";
    }
    return Promise.reject(new ApiError(err.response?.status, err.response?.data?.error));
  }
);
```

---

## 4. Endpoints Auth

### `GET /auth/login`

Redirige vers Discord OAuth2. Utiliser `window.location.href`, pas fetch.

```typescript
const login = () => {
  window.location.href = "https://api.moddy.app/auth/login";
};
```

---

### `GET /auth/discord/callback` *(géré par le backend)*

Le frontend n'appelle jamais cet endpoint directement. Le backend reçoit le callback Discord, crée la session et redirige vers `https://dashboard.moddy.app`.

---

### `POST /auth/logout`

```typescript
const logout = async () => {
  await api("/auth/logout", { method: "POST" });
};
```

**Réponse :** `200` body vide, cookie supprimé.

---

### `POST /auth/refresh`

```typescript
const refreshSession = async () => {
  await api("/auth/refresh", { method: "POST" });
};
// Réponse : { "status": "refreshed" }
// Erreur 401 si session invalide
```

---

### `POST /auth/refresh-guilds`

```typescript
const refreshGuilds = async (): Promise<Guild[]> => {
  const data = await api("/auth/refresh-guilds", { method: "POST" });
  return data.guilds;
};
// Réponse : { guilds: [{ id, name, icon }] }
```

---

### `GET /auth/me`

```typescript
const getMe = async (): Promise<User> => {
  return await api("/auth/me");
};
```

---

## 5. Endpoints Guilds

Tous ces endpoints nécessitent une session valide. Les endpoints `/{guild_id}/*` vérifient en plus que l'utilisateur est admin du serveur (ou staff).

### `GET /guilds`

Liste des serveurs accessibles par l'utilisateur.

```typescript
interface GuildListItem {
  guild_id: number;
  name: string;
  icon: string | null;
  attributes: Record<string, boolean | string>;
  data: {
    modules?: Record<string, ModuleConfig>;
  };
  in_database: boolean;
}

const getGuilds = async (): Promise<GuildListItem[]> => {
  return await api("/guilds");
};
```

**Note :** `in_database: false` signifie que le bot est dans le serveur mais qu'il n'y a pas encore de config en base. Afficher un état "non configuré".

---

### `GET /guilds/{guild_id}`

Détail complet d'un serveur (Discord info + config DB).

```typescript
interface GuildDetail {
  guild_id: number;
  name: string;
  icon: string | null;
  banner: string | null;
  splash: string | null;
  description: string | null;
  owner_id: string;
  premium_tier: number;           // 0, 1, 2 ou 3 (boosts Discord)
  premium_subscription_count: number;
  preferred_locale: string;
  verification_level: number;
  vanity_url_code: string | null;
  features: string[];
  member_count: number;
  presence_count: number;
  system_channel_id: string | null;
  attributes: {
    PREMIUM?: true;
    BETA?: true;
    BLACKLISTED?: true;
  };
  data: {
    modules?: Record<string, ModuleConfig>;
  };
  in_database: boolean;
}

const getGuild = async (guildId: string | number): Promise<GuildDetail> => {
  return await api(`/guilds/${guildId}`);
};
```

---

### `GET /guilds/{guild_id}/channels`

Liste des salons du serveur.

```typescript
interface Channel {
  id: string;
  name: string;
  type: number;      // 0=text, 2=voice, 4=category, 5=announcement, etc.
  position: number;
  parent_id: string | null;  // ID de la catégorie parente
  permission_overwrites: unknown[];
  topic: string | null;      // Sujet du salon
}

const getChannels = async (guildId: string | number): Promise<Channel[]> => {
  return await api(`/guilds/${guildId}/channels`);
};

// Types de salons Discord utiles
const CHANNEL_TYPES = {
  TEXT: 0,
  VOICE: 2,
  CATEGORY: 4,
  ANNOUNCEMENT: 5,
  STAGE: 13,
  FORUM: 15,
};
```

---

### `GET /guilds/{guild_id}/roles`

Liste des rôles du serveur.

```typescript
interface Role {
  id: string;
  name: string;
  color: number;      // Couleur en décimal (0 = pas de couleur)
  position: number;   // Position dans la hiérarchie (0 = @everyone)
  permissions: string;
  mentionable: boolean;
  managed: boolean;   // true = géré par une intégration (bot)
  hoist: boolean;     // true = affiché séparément dans la liste membres
}

const getRoles = async (guildId: string | number): Promise<Role[]> => {
  return await api(`/guilds/${guildId}/roles`);
};

// Convertir la couleur en hex pour CSS
const roleColorToHex = (color: number) =>
  color === 0 ? "#99aab5" : `#${color.toString(16).padStart(6, "0")}`;
```

---

### `GET /guilds/{guild_id}/emojis`

```typescript
const getEmojis = async (guildId: string | number) => {
  return await api(`/guilds/${guildId}/emojis`);
};
```

---

### `GET /guilds/{guild_id}/discord`

Récupère guild + channels + roles en un seul appel. **Utiliser pour l'initialisation d'une page de config.**

```typescript
const getGuildDiscordData = async (guildId: string | number) => {
  const { guild, channels, roles } = await api(`/guilds/${guildId}/discord`);
  return { guild, channels, roles };
};
```

---

### `PATCH /guilds/{guild_id}/settings`

Modifie les paramètres généraux du serveur (merge dans `guilds.data`).

```typescript
const updateGuildSettings = async (guildId: string | number, settings: Record<string, unknown>) => {
  return await api(`/guilds/${guildId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
};
// Réponse : { guild_id, status: "updated" }
```

---

## 6. Endpoints Modules

Les modules sont les fonctionnalités configurables du bot par serveur. Toutes les configs sont dans `guilds.data.modules.<module_id>`.

### Modules disponibles

| `module_id` | Description |
|---|---|
| `starboard` | Épingle les messages avec des réactions |
| `welcome_channel` | Message de bienvenue dans un salon |
| `welcome_dm` | Message de bienvenue en DM |
| `auto_role` | Rôles attribués automatiquement à l'arrivée |
| `auto_restore_roles` | Restaure les rôles d'un membre qui revient |
| `interserver` | Réseau de chat inter-serveurs |
| `youtube_notifications` | Notifications YouTube |
| `logging` | Logs des actions du serveur |

---

### `GET /guilds/{guild_id}/modules`

Tous les modules configurés.

```typescript
const getModules = async (guildId: string | number) => {
  // Retourne {} si aucun module configuré
  return await api(`/guilds/${guildId}/modules`);
};
```

---

### `GET /guilds/{guild_id}/modules/{module_id}`

Config d'un module spécifique.

```typescript
const getModule = async (guildId: string | number, moduleId: string) => {
  // Retourne 404 si module non configuré
  return await api(`/guilds/${guildId}/modules/${moduleId}`);
};
```

---

### `PATCH /guilds/{guild_id}/modules/{module_id}`

**Met à jour la config complète d'un module.** Remplace l'ancienne config.

```typescript
const updateModule = async (
  guildId: string | number,
  moduleId: string,
  config: Record<string, unknown>
) => {
  return await api(`/guilds/${guildId}/modules/${moduleId}`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
};

// Exemple : configurer le starboard
await updateModule("123456789", "starboard", {
  channel_id: 999888777,
  reaction_count: 3,
  emoji: "⭐",
});

// Exemple : configurer le welcome channel
await updateModule("123456789", "welcome_channel", {
  channel_id: 111222333,
  message_template: "Bienvenue {user} sur le serveur !",
  mention_user: true,
  embed_enabled: false,
});
```

**Important :** si la config inclut `update_panel: true`, le bot va mettre à jour le message interactif Discord correspondant (tâche critique via Redis Stream). Utiliser pour les modules avec un panel Discord (ex: tickets).

---

### `DELETE /guilds/{guild_id}/modules/{module_id}`

Désactive un module (supprime sa config).

```typescript
const disableModule = async (guildId: string | number, moduleId: string) => {
  return await api(`/guilds/${guildId}/modules/${moduleId}`, {
    method: "DELETE",
  });
};
// Réponse : { guild_id, module_id, status: "disabled" }
```

---

### Configs de modules par type

#### Module `starboard`

```typescript
interface StarboardConfig {
  channel_id: number;      // Salon où épingler les messages
  reaction_count: number;  // Nombre de réactions requises (défaut: 5)
  emoji: string;           // Emoji déclencheur (défaut: "⭐")
}
```

#### Module `welcome_channel`

```typescript
interface WelcomeChannelConfig {
  channel_id: number;
  message_template: string;    // Utiliser {user} pour la mention
  mention_user: boolean;
  embed_enabled: boolean;
  embed_title?: string;
  embed_description?: string | null;
  embed_color?: number;        // Couleur en décimal (ex: 5793266 = #5865F2)
  embed_footer?: string | null;
  embed_image_url?: string | null;
  embed_thumbnail_enabled?: boolean;
  embed_author_enabled?: boolean;
}
```

#### Module `welcome_dm`

```typescript
interface WelcomeDmConfig {
  message_template: string;
  embed_enabled: boolean;
  embed_title?: string;
  embed_description?: string | null;
  embed_color?: number;
}
```

#### Module `auto_role`

```typescript
interface AutoRoleConfig {
  role_ids: number[];  // Liste des IDs de rôles à attribuer
}
```

#### Module `auto_restore_roles`

```typescript
interface AutoRestoreRolesConfig {
  enabled: boolean;
  ignored_role_ids: number[];  // Rôles à ne pas restaurer
}
```

#### Module `interserver`

```typescript
interface InterserverConfig {
  channel_id: number;
  network_id: string;       // Réseau auquel se connecter (défaut: "default")
  webhook_url: string;      // URL du webhook Discord pour le salon
}
```

---

## 7. Endpoints Logging

Le module logging est accessible à la fois via `/modules` et via ses propres endpoints dédiés.

### `GET /guilds/{guild_id}/logging`

```typescript
interface LoggingConfig {
  channel_id: number;
  events: string[];    // Liste des événements à logger
}

const getLoggingConfig = async (guildId: string | number) => {
  const { guild_id, config } = await api(`/guilds/${guildId}/logging`);
  return config as LoggingConfig;
};
```

### `PATCH /guilds/{guild_id}/logging`

```typescript
const updateLogging = async (guildId: string | number, config: LoggingConfig) => {
  return await api(`/guilds/${guildId}/logging`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
};

// Exemple
await updateLogging("123456789", {
  channel_id: 777888999,
  events: ["message_delete", "message_edit", "member_join", "member_leave"],
});
```

---

## 8. Endpoints Stats

### `GET /guilds/{guild_id}/stats`

```typescript
interface GuildStats {
  guild_id: number;
  is_premium: boolean;
  total_cases: number;
  open_cases: number;
}

const getGuildStats = async (guildId: string | number): Promise<GuildStats> => {
  return await api(`/guilds/${guildId}/stats`);
};
```

---

## 9. Endpoints Stripe (Premium)

### `POST /stripe/create-checkout`

Crée une session de paiement et retourne l'URL Stripe.

```typescript
const createCheckout = async (guildId: number, plan: "monthly" | "yearly" = "monthly") => {
  const { url } = await api("/stripe/create-checkout", {
    method: "POST",
    body: JSON.stringify({ guild_id: guildId, plan }),
  });
  // Rediriger l'utilisateur vers Stripe
  window.location.href = url;
};
```

---

### `POST /stripe/portal`

Ouvre le portail Stripe pour gérer/annuler l'abonnement existant.

```typescript
const openBillingPortal = async () => {
  const { url } = await api("/stripe/portal", { method: "POST" });
  window.location.href = url;
};
// Erreur 404 si l'utilisateur n'a pas d'abonnement Stripe
```

---

### `GET /stripe/subscription?guild_id={guild_id}`

Vérifie le statut premium d'un serveur.

```typescript
const getSubscriptionStatus = async (guildId: number) => {
  const { premium } = await api(`/stripe/subscription?guild_id=${guildId}`);
  return premium as boolean;
};
```

---

### `POST /stripe/webhook` *(backend only)*

Ce webhook est exclusivement appelé par Stripe — ne jamais appeler depuis le frontend.

---

## 10. Endpoints Staff Panel

Ces endpoints nécessitent `is_staff: true` dans la session. Les utiliser uniquement dans la section staff du dashboard.

### Guard de protection

```typescript
const requireStaff = (user: User | null) => {
  if (!user?.is_staff) {
    throw new Error("Accès refusé — staff uniquement");
  }
};
```

---

### Gestion des serveurs (staff)

#### `GET /staff/guilds`

```typescript
const getAllGuilds = async (params?: { search?: string; limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  return await api(`/staff/guilds?${query.toString()}`);
};
```

#### `GET /staff/guilds/{guild_id}`

```typescript
const getGuildStaff = async (guildId: string | number) => {
  return await api(`/staff/guilds/${guildId}`);
  // { guild_id, attributes, data, created_at, updated_at }
};
```

#### `PATCH /staff/guilds/{guild_id}`

Modifier les attributs d'un serveur (`PREMIUM`, `BETA`, `BLACKLISTED`).

```typescript
const updateGuildAttributes = async (
  guildId: string | number,
  attrs: Partial<{ PREMIUM: true | null; BETA: true | null; BLACKLISTED: true | null }>
) => {
  return await api(`/staff/guilds/${guildId}`, {
    method: "PATCH",
    body: JSON.stringify(attrs),
  });
};

// Activer PREMIUM
await updateGuildAttributes("123456789", { PREMIUM: true });

// Désactiver PREMIUM
await updateGuildAttributes("123456789", { PREMIUM: null });
```

---

### Blacklist

#### `GET /staff/blacklist`

```typescript
const getBlacklist = async (limit = 50, offset = 0) => {
  return await api(`/staff/blacklist?limit=${limit}&offset=${offset}`);
};
```

#### `POST /staff/blacklist`

```typescript
const addToBlacklist = async (params: {
  entity_type: "user" | "guild";
  entity_id: number;
  reason?: string;
  sanction_type?: "global_blacklist" | "guild_blacklist";
}) => {
  return await api("/staff/blacklist", {
    method: "POST",
    body: JSON.stringify(params),
  });
};
```

#### `DELETE /staff/blacklist/{case_id}`

```typescript
const removeFromBlacklist = async (caseId: string) => {
  return await api(`/staff/blacklist/${caseId}`, { method: "DELETE" });
  // Réponse : { deleted: true, case_id: "A1B2C3D4" }
};
```

---

### Cases de modération

#### `GET /cases`

```typescript
const getCases = async (filters?: {
  entity_id?: number;
  entity_type?: "user" | "guild";
  case_type?: "global" | "interserver";
  status?: "open" | "closed";
  limit?: number;
  offset?: number;
}) => {
  const query = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  return await api(`/cases?${query.toString()}`);
};
```

#### `GET /cases/{case_id}`

```typescript
interface ModerationCase {
  case_id: string;          // "A1B2C3D4"
  case_type: "global" | "interserver";
  sanction_type: string;
  entity_type: "user" | "guild";
  entity_id: number;
  status: "open" | "closed";
  reason: string;
  evidence: string | null;
  duration: number | null;
  staff_notes: { staff_id: number; note: string; timestamp: string }[];
  created_by: number;
  created_at: string;       // ISO 8601 UTC
  updated_by: number | null;
  updated_at: string;
  closed_by: number | null;
  closed_at: string | null;
  close_reason: string | null;
}

const getCase = async (caseId: string): Promise<ModerationCase> => {
  return await api(`/cases/${caseId}`);
};
```

---

### Utilisateurs (staff)

#### `GET /staff/users?q={query}`

```typescript
const searchUsers = async (query: string, limit = 50, offset = 0) => {
  return await api(`/staff/users?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
};
```

#### `GET /staff/users/{user_id}`

```typescript
interface UserFullProfile {
  user_id: number;
  attributes: Record<string, boolean | string>;
  stripe_customer_id: string | null;
  email: string | null;
  created_at: string;
  staff_roles: string[];
  denied_commands: string[];
  total_cases: number;
  open_cases: number;
}

const getUserProfile = async (userId: string | number): Promise<UserFullProfile> => {
  return await api(`/staff/users/${userId}`);
};
```

#### `PATCH /staff/users/{user_id}`

```typescript
const updateUserAttributes = async (
  userId: string | number,
  attrs: Record<string, true | string | null>
) => {
  // Note : TEAM ne peut PAS être modifié ici (400 si tenté)
  return await api(`/staff/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(attrs),
  });
};

// Changer la langue
await updateUserAttributes("123456789", { LANG: "EN" });

// Blacklister
await updateUserAttributes("123456789", { BLACKLISTED: true });

// Retirer la blacklist
await updateUserAttributes("123456789", { BLACKLISTED: null });
```

---

### Stats globales

#### `GET /staff/stats`

```typescript
interface GlobalStats {
  total_users: number;
  premium_users: number;
  blacklisted_users: number;
  stripe_users: number;
  total_guilds: number;
  premium_guilds: number;
  total_staff: number;
  open_cases: number;
}

const getGlobalStats = async (): Promise<GlobalStats> => {
  return await api("/staff/stats");
};
```

---

### Bot Discord

#### `GET /staff/bot/status`

```typescript
const getBotStatus = async () => {
  // Retourne les infos du bot (shards, latence, uptime, mémoire)
  // 502 si le bot est hors ligne
  return await api("/staff/bot/status");
};
```

#### `POST /staff/bot/announce`

```typescript
const sendAnnouncement = async (message: string, guildIds?: number[]) => {
  return await api("/staff/bot/announce", {
    method: "POST",
    body: JSON.stringify({
      message,
      guild_ids: guildIds ?? null,  // null = tous les serveurs
    }),
  });
  // Réponse : { status: "queued" }
};
```

---

## 11. Flux complets step-by-step

### Flux 1 : Première visite (non connecté)

```
1. App charge → GET /auth/me → 401
2. Rediriger vers /login
3. Bouton "Se connecter avec Discord" → window.location.href = "https://api.moddy.app/auth/login"
4. Discord OAuth2 → callback → cookie posé → redirect vers dashboard
5. App charge → GET /auth/me → 200
6. Stocker user en état global
7. Afficher la liste des serveurs depuis user.guilds
```

---

### Flux 2 : Accéder à la config d'un serveur

```
1. L'utilisateur clique sur un serveur dans la liste
2. GET /guilds/{guild_id}/discord → guild info + channels + roles (une seule requête)
3. GET /guilds/{guild_id}/modules → configs actuelles des modules
4. Afficher l'interface de configuration avec les données chargées
```

---

### Flux 3 : Modifier la config d'un module

```
1. L'utilisateur modifie les paramètres (ex: starboard)
2. Bouton "Enregistrer" → PATCH /guilds/{guild_id}/modules/starboard
   Body: { channel_id: 123, reaction_count: 3, emoji: "⭐" }
3. Réponse 200 → afficher toast de succès
4. Mettre à jour l'état local avec la réponse
```

---

### Flux 4 : Passer un serveur en Premium

```
1. L'utilisateur clique "Passer Premium"
2. Choix du plan : monthly ou yearly
3. POST /stripe/create-checkout { guild_id, plan }
4. Récupérer l'URL Stripe → window.location.href = url
5. L'utilisateur paie sur Stripe
6. Stripe webhook → backend active PREMIUM sur le serveur
7. L'utilisateur est redirigé vers le dashboard (URL de success Stripe)
8. GET /guilds/{guild_id} → afficher le badge Premium
```

---

### Flux 5 : Déconnecter un utilisateur inactif

```
1. Appeler GET /auth/me périodiquement (ex: toutes les heures)
2. Si 401 → session expirée → POST /auth/logout → redirect login
3. Sinon → appeler POST /auth/refresh pour maintenir la session active
```

---

## 12. Référence des types TypeScript

```typescript
// Attributs serveur
interface GuildAttributes {
  PREMIUM?: true;
  BETA?: true;
  BLACKLISTED?: true;
}

// Attributs utilisateur
interface UserAttributes {
  TEAM?: true;
  PREMIUM?: true;
  BETA?: true;
  BLACKLISTED?: true;
  LANG?: "FR" | "EN";
}

// Config de chaque module
type ModuleConfig =
  | StarboardConfig
  | WelcomeChannelConfig
  | WelcomeDmConfig
  | AutoRoleConfig
  | AutoRestoreRolesConfig
  | InterserverConfig
  | LoggingConfig;

// Guild complète
interface GuildFull {
  guild_id: number;
  name: string;
  icon: string | null;
  banner: string | null;
  splash: string | null;
  description: string | null;
  owner_id: string;
  premium_tier: 0 | 1 | 2 | 3;
  premium_subscription_count: number;
  preferred_locale: string;
  verification_level: number;
  vanity_url_code: string | null;
  features: string[];
  member_count: number;
  presence_count: number;
  system_channel_id: string | null;
  attributes: GuildAttributes;
  data: { modules?: Record<string, ModuleConfig> };
  in_database: boolean;
}

// Rôles staff
type StaffRole =
  | "Dev"
  | "Manager"
  | "Supervisor_Mod"
  | "Supervisor_Com"
  | "Supervisor_Sup"
  | "Moderator"
  | "Communication"
  | "Support";
```

---

## Checklist d'intégration

- [ ] `credentials: "include"` configuré sur toutes les requêtes
- [ ] Intercepteur 401 → redirect `/auth/login`
- [ ] `GET /auth/me` au démarrage de l'app
- [ ] `POST /auth/refresh-guilds` disponible après invitation du bot
- [ ] IDs Discord traités comme `string` ou `BigInt` (> 32 bits)
- [ ] Redirect Stripe après paiement bien gérée
- [ ] Section staff conditionnée sur `user.is_staff === true`
- [ ] Timestamps UTC convertis en heure locale pour l'affichage
