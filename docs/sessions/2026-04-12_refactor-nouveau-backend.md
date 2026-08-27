# Session 2026-04-12 — Mise à jour frontend pour le nouveau backend

## Objectif
Adapter le frontend au nouveau backend Moddy entièrement refait, en suivant le guide `docs/FRONTEND_GUIDE.md`.

## Changements principaux

### Suppression du système proxy HMAC
L'ancien système nécessitait un proxy Vercel (`/api/backend-proxy.ts`) pour signer les requêtes avec HMAC-SHA256. Le nouveau backend n'utilise plus ce mécanisme.

### Nouveau flow d'authentification
- **Avant** : `callBackendProxy('/api/website/auth/init')` → récupère un `state` → construction manuelle de l'URL Discord OAuth
- **Maintenant** : simple redirect `window.location.href = "https://api.moddy.app/auth/login"` (le backend gère tout)
- **Cookie** : `session_token` (était `moddy_session`)
- **Vérification session** : `GET /auth/me` (était `GET /auth/verify` + `GET /auth/user-info` séparément)

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/lib/auth.ts` | Réécriture complète : suppression proxy/HMAC, nouveaux types `User`/`Guild`, fonctions `getMe`, `login`, `logout`, `refreshSession`, `refreshGuilds`, helpers `getAvatarUrl`/`getGuildIconUrl` |
| `app/src/hooks/useAuth.ts` | Simplifié : un seul appel `getMe()` remplace `verifySession + getUserInfo`, état `{ status, user: User }` (plus de `userInfo` séparé) |
| `app/src/pages/HomePage.tsx` | Redirect vers `api.moddy.app/auth/login` (via `login()`) au lieu de `moddy.app/sign-in` |
| `app/src/pages/DashboardPage.tsx` | Prop `userInfo: UserInfo` → `user: User` |
| `app/src/components/app-sidebar.tsx` | Import `User` + `getAvatarUrl` au lieu de `UserInfo`, calcul de l'avatar via `getAvatarUrl(user_id, avatar)` |
| `app/src/pages/DebugPage.tsx` | `signInWithDiscord` → `login`, refs `auth.userInfo` → `auth.user`, `pingApi` → `/auth/me`, `pingProxy` → `/auth/refresh` |
| `app/vite.config.ts` | Ajout du proxy dev local (`/api/*` → `http://localhost:8080`) |

## Nouveaux types

```typescript
interface User {
  user_id: string       // Discord snowflake (string car > 32 bits)
  username: string
  avatar: string | null // hash Discord, pas une URL
  guilds: Guild[]
  is_staff: boolean
  staff_roles: string[]
}

interface Guild {
  id: number
  name: string
  icon: string | null
}
```

## Notes importantes
- L'URL d'avatar Discord se calcule avec `getAvatarUrl(user_id, avatar_hash)` — l'API retourne un hash, pas une URL directe
- `credentials: "include"` reste obligatoire sur toutes les requêtes API
- Pour le dev local : mettre `VITE_API_URL=/api` dans `.env.local` pour utiliser le proxy Vite

## Prochaines étapes suggérées
- Supprimer `/api/backend-proxy.ts` si le déploiement Vercel ne l'utilise plus
- Implémenter `TeamSwitcher` avec les vraies guilds depuis `user.guilds`
- Ajouter la sélection de serveur et charger `GET /guilds/{guild_id}/discord`
- Mettre en place `POST /auth/refresh` périodique (toutes les 24h) pour maintenir la session
