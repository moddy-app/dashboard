# Guide d'intégration Frontend - Moddy Backend API

Documentation complète pour intégrer l'authentification Discord et la gestion de session sur le frontend.

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Configuration requise](#configuration-requise)
3. [Flow d'authentification complet](#flow-dauthentification-complet)
4. [Endpoints disponibles](#endpoints-disponibles)
5. [Gestion des cookies](#gestion-des-cookies)
6. [Gestion des états utilisateur](#gestion-des-états-utilisateur)
7. [Exemples de code](#exemples-de-code)
8. [Bonnes pratiques](#bonnes-pratiques)
9. [Gestion des erreurs](#gestion-des-erreurs)

---

## Vue d'ensemble

Le backend Moddy utilise :
- **Discord OAuth2** pour l'authentification
- **HMAC-SHA256** pour signer les requêtes API
- **Cookies HTTP-only** pour la gestion de session
- **PostgreSQL** pour stocker les utilisateurs et sessions

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────┐
│  Frontend   │────────▶│   Backend    │────────▶│ Discord │
│ (moddy.app) │◀────────│(api.moddy.app)│◀────────│   API   │
└─────────────┘         └──────────────┘         └─────────┘
      │                        │
      │                        │
      └────── Cookie ──────────┘
         (moddy_session)
```

---

## Configuration requise

### Variables d'environnement

Créer un fichier `.env` ou `.env.local` :

```bash
# API Backend
NEXT_PUBLIC_API_URL=https://api.moddy.app
NEXT_PUBLIC_API_KEY=your-shared-api-key-here

# Discord OAuth
NEXT_PUBLIC_DISCORD_CLIENT_ID=123456789012345678
```

### ⚠️ Sécurité importante

- ✅ `NEXT_PUBLIC_API_KEY` - Peut être exposée au frontend (utilisée pour HMAC)
- ✅ `NEXT_PUBLIC_DISCORD_CLIENT_ID` - Publique (visible dans l'URL OAuth)
- ❌ **NE JAMAIS** exposer `DISCORD_CLIENT_SECRET` côté frontend
- ❌ **NE JAMAIS** exposer `DATABASE_URL` côté frontend

---

## Flow d'authentification complet

### Étape par étape

```
1. User clique "Sign in with Discord"
   ↓
2. Frontend → POST /api/website/auth/init (avec HMAC)
   ↓
3. Backend → Génère un state token, retourne {state: "uuid"}
   ↓
4. Frontend → Redirige vers Discord OAuth avec state
   ↓
5. Discord → User autorise l'app
   ↓
6. Discord → Redirige vers /auth/discord/callback?code=XXX&state=YYY
   ↓
7. Backend → Échange code contre access_token
   ↓
8. Backend → Récupère infos user depuis Discord API
   ↓
9. Backend → Crée/update user en DB
   ↓
10. Backend → Crée session et pose cookie "moddy_session"
    ↓
11. Backend → Redirige vers page d'origine
    ↓
12. Frontend → Vérifie session avec GET /auth/verify
    ↓
13. ✅ User est connecté !
```

### Diagramme de séquence détaillé

```
┌─────────┐         ┌──────────┐         ┌─────────┐         ┌─────────┐
│ User    │         │ Frontend │         │ Backend │         │ Discord │
└────┬────┘         └────┬─────┘         └────┬────┘         └────┬────┘
     │                   │                    │                   │
     │ 1. Click "Sign in"│                    │                   │
     ├──────────────────>│                    │                   │
     │                   │                    │                   │
     │                   │ 2. POST /api/website/auth/init         │
     │                   │   Body: {current_page: "..."}          │
     │                   ├───────────────────>│                   │
     │                   │                    │                   │
     │                   │                    │ 3. Generate state │
     │                   │                    │    Store {state: redirect_url}
     │                   │                    │                   │
     │                   │ 4. Response        │                   │
     │                   │   {state: "uuid"}  │                   │
     │                   │<───────────────────┤                   │
     │                   │                    │                   │
     │ 5. Redirect to Discord with state      │                   │
     │<──────────────────┤                    │                   │
     │                   │                    │                   │
     │ 6. Authorize      │                    │                   │
     ├────────────────────────────────────────────────────────────>│
     │                   │                    │                   │
     │                   │                    │ 7. Callback       │
     │                   │                    │   ?code=X&state=Y │
     │                   │                    │<──────────────────┤
     │                   │                    │                   │
     │                   │                    │ 8. Exchange code  │
     │                   │                    │    POST /oauth2/token
     │                   │                    ├──────────────────>│
     │                   │                    │                   │
     │                   │                    │ 9. access_token + │
     │                   │                    │    refresh_token  │
     │                   │                    │<──────────────────┤
     │                   │                    │                   │
     │                   │                    │ 10. GET /users/@me│
     │                   │                    ├──────────────────>│
     │                   │                    │                   │
     │                   │                    │ 11. User info     │
     │                   │                    │<──────────────────┤
     │                   │                    │                   │
     │                   │                    │ 12. Save user + session
     │                   │                    │     Set cookie    │
     │                   │                    │                   │
     │ 13. Redirect to page (with cookie)     │                   │
     │<────────────────────────────────────────                   │
     │                   │                    │                   │
     │                   │ 14. GET /auth/verify (with cookie)     │
     │                   ├───────────────────>│                   │
     │                   │                    │                   │
     │                   │ 15. {valid: true, discord_id, email}   │
     │                   │<───────────────────┤                   │
     │                   │                    │                   │
     │ 16. Show authenticated content         │                   │
     │<──────────────────┤                    │                   │
     │                   │                    │                   │
```

---

## Endpoints disponibles

### 1. Initialiser l'authentification

**Endpoint :** `POST /api/website/auth/init`

**Description :** Initialise le flow OAuth Discord.

**Headers requis :**
```javascript
{
  "Content-Type": "application/json",
  "X-Request-Id": "uuid-v4-here",
  "X-Signature": "hmac-sha256-signature"
}
```

**Body :**
```json
{
  "current_page": "https://moddy.app/dashboard"
}
```

**Réponse (200) :**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Auth state created successfully"
}
```

---

### 2. Vérifier la session

**Endpoint :** `GET /auth/verify`

**Description :** Vérifie si l'utilisateur est connecté.

**Headers requis :**
```javascript
{
  "Cookie": "moddy_session=token" // Envoyé automatiquement
}
```

**Réponse si connecté (200) :**
```json
{
  "valid": true,
  "discord_id": 123456789012345678,
  "email": "user@example.com"
}
```

**Réponse si non connecté (200) :**
```json
{
  "valid": false,
  "discord_id": null,
  "email": null
}
```

**⚠️ Important :** Toujours envoyer `credentials: 'include'` pour que les cookies soient envoyés.

---

### 3. Déconnexion

**Endpoint :** `GET /auth/logout`

**Description :** Déconnecte l'utilisateur et révoque sa session.

**Headers requis :**
```javascript
{
  "Cookie": "moddy_session=token" // Envoyé automatiquement
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

**Comportement :**
- Supprime la session de la base de données
- Supprime le cookie `moddy_session`
- L'utilisateur doit se reconnecter

---

### 4. Récupérer les informations utilisateur complètes

**Endpoint :** `GET /auth/user-info`

**Description :** Récupère toutes les informations Discord de l'utilisateur connecté.

**Headers requis :**
```javascript
{
  "Cookie": "moddy_session=token" // Envoyé automatiquement
}
```

**Réponse (200) :**
```json
{
  "id": "123456789012345678",
  "username": "JohnDoe",
  "discriminator": "0001",
  "avatar": "a_d5efa99b3eeaa7dd43acca82f5692432",
  "email": "john@example.com",
  "verified": true,
  "locale": "en-US",
  "mfa_enabled": true,
  "premium_type": 2,
  "public_flags": 131072,
  "avatar_url": "https://cdn.discordapp.com/avatars/123456789012345678/a_d5efa99b3eeaa7dd43acca82f5692432.gif"
}
```

**Champs disponibles :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Discord ID (identifiant unique) |
| `username` | string | Nom d'utilisateur Discord |
| `discriminator` | string | Discriminateur (ex: "0001") |
| `avatar` | string\|null | Hash de l'avatar |
| `email` | string\|null | Email de l'utilisateur |
| `verified` | boolean\|null | Email vérifié sur Discord |
| `locale` | string\|null | Langue (ex: "en-US", "fr") |
| `mfa_enabled` | boolean\|null | Authentification 2FA activée |
| `premium_type` | int\|null | Nitro (0=None, 1=Classic, 2=Full) |
| `public_flags` | int\|null | Badges/flags publics |
| `avatar_url` | string\|null | URL complète de l'avatar |

**Comportement :**
1. Vérifie le cookie de session
2. Utilise le **refresh token** pour obtenir un nouvel **access token** Discord
3. Met à jour le refresh token si Discord en renvoie un nouveau
4. Récupère les infos depuis Discord API (`GET /users/@me`)
5. Construit automatiquement l'URL de l'avatar (PNG ou GIF si animé)
6. ⚠️ **Si le refresh échoue, supprime la session** (l'utilisateur doit se reconnecter)

**Erreurs :**
- `401 Unauthorized` - Non authentifié ou refresh token invalide/révoqué
- `500 Internal Server Error` - Erreur lors de la récupération

**⚠️ Important :**
- L'endpoint utilise automatiquement le refresh token stocké en DB
- Si Discord révoque le refresh token, la session sera supprimée
- L'access token est rafraîchi à chaque appel (pas de cache)
- L'avatar_url est construit automatiquement (GIF si hash commence par "a_")

**Usage Frontend :**
```javascript
async function getUserInfo() {
  const response = await fetch('https://api.moddy.app/auth/user-info', {
    credentials: 'include'
  });

  if (response.status === 401) {
    // Session invalide ou refresh token révoqué
    console.log('Please sign in again');
    window.location.href = '/login';
    return null;
  }

  const userInfo = await response.json();

  console.log('Discord ID:', userInfo.id);
  console.log('Username:', userInfo.username);
  console.log('Avatar:', userInfo.avatar_url);
  console.log('Has Nitro:', userInfo.premium_type > 0);

  return userInfo;
}
```

---

## Gestion des cookies

### Cookie de session : `moddy_session`

Le backend pose automatiquement ce cookie lors de l'authentification réussie.

**Format complet du cookie :**
```http
Set-Cookie: moddy_session=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789; Domain=.moddy.app; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax
```

**Détails des propriétés :**

| Propriété | Valeur | Description |
|-----------|--------|-------------|
| **Name** | `moddy_session` | Nom du cookie |
| **Value** | Token aléatoire 64 caractères | Token de session généré par `secrets.token_urlsafe(32)` |
| **Domain** | `.moddy.app` | Valide pour tous les sous-domaines (moddy.app, www.moddy.app, etc.) |
| **Path** | `/` | Accessible sur toutes les routes |
| **Max-Age** | `2592000` | 30 jours en secondes (30 × 24 × 60 × 60) |
| **HttpOnly** | `true` | ⚠️ **CRITIQUE** : Inaccessible au JavaScript (protection XSS) |
| **Secure** | `true` | ⚠️ **CRITIQUE** : HTTPS uniquement (pas de transmission HTTP) |
| **SameSite** | `Lax` | Protection CSRF modérée (envoyé sur GET cross-site) |

### Exemple de cookie réel

```
moddy_session=k7Jx9mP2nQ5vL8zW3bT6yR1aF4cH0dE9sG2iU5oA7pK
```

### Cycle de vie du cookie

```
1. Authentification réussie
   ↓
2. Backend génère un token sécurisé (secrets.token_urlsafe(32))
   ↓
3. Backend crée une session en DB avec ce token
   ↓
4. Backend pose le cookie avec Set-Cookie dans la réponse HTTP
   ↓
5. Navigateur stocke le cookie pour 30 jours
   ↓
6. À chaque requête vers api.moddy.app, le navigateur envoie:
   Cookie: moddy_session=token
   ↓
7. Backend vérifie le token dans la DB
   ↓
8. Si valide → retourne les données utilisateur
   Si expiré → supprime la session et retourne valid:false
```

### ⚠️ Important pour le frontend

1. **Ne jamais tenter de lire le cookie en JavaScript** - Il est `HttpOnly`
   ```javascript
   // ❌ Ceci retournera une string vide pour moddy_session
   document.cookie // "autre_cookie=valeur" (pas moddy_session)
   ```

2. **Toujours envoyer `credentials: 'include'`** dans les fetch
   ```javascript
   // ✅ Correct - envoie les cookies
   fetch('https://api.moddy.app/auth/verify', {
     credentials: 'include'
   })

   // ❌ Incorrect - ne envoie pas les cookies
   fetch('https://api.moddy.app/auth/verify')
   ```

3. **Le cookie est automatiquement envoyé** par le navigateur
   - Pas besoin de l'ajouter manuellement dans les headers
   - Le navigateur l'envoie automatiquement à chaque requête vers `*.moddy.app`

4. **Utiliser `/auth/verify` pour vérifier** l'état de connexion
   - Seule façon de savoir si l'utilisateur est connecté
   - Le cookie est invisible au JavaScript

### Sécurité du cookie

**Protections en place :**

✅ **HttpOnly** → Empêche les scripts malveillants de voler le token
```javascript
// ❌ Impossible de faire ceci (HttpOnly bloque)
const token = document.cookie.match(/moddy_session=([^;]+)/)?.[1]
localStorage.setItem('stolen_token', token)
```

✅ **Secure** → Empêche l'interception sur HTTP
```
HTTP  : ❌ Cookie NOT sent
HTTPS : ✅ Cookie sent
```

✅ **SameSite=Lax** → Protection CSRF partielle
```
Requête depuis moddy.app    → ✅ Cookie sent
GET depuis evil.com         → ✅ Cookie sent (Lax autorise)
POST depuis evil.com        → ❌ Cookie NOT sent (Lax bloque)
```

✅ **Domain=.moddy.app** → Scope limité
```
Envoyé à:
  ✅ moddy.app
  ✅ www.moddy.app
  ✅ api.moddy.app
  ✅ dashboard.moddy.app

Non envoyé à:
  ❌ evil.com
  ❌ moddy.com
  ❌ fakemoddy.app
```

### Debugging des cookies

**Vérifier si le cookie est présent :**

1. **Dans DevTools (Chrome/Firefox) :**
   ```
   F12 → Application → Cookies → https://moddy.app

   Name: moddy_session
   Value: k7Jx9m...
   Domain: .moddy.app
   Path: /
   Expires: (30 days from now)
   HttpOnly: ✓
   Secure: ✓
   SameSite: Lax
   ```

2. **Via Network tab :**
   ```
   F12 → Network → Select request → Headers

   Request Headers:
   Cookie: moddy_session=k7Jx9mP2nQ5vL8zW3bT6yR1aF4cH0dE9sG2iU5oA7pK
   ```

3. **Via curl :**
   ```bash
   # Sauvegarder les cookies
   curl -c cookies.txt https://api.moddy.app/auth/discord/callback?code=X&state=Y

   # Utiliser les cookies
   curl -b cookies.txt https://api.moddy.app/auth/verify
   ```

### Que faire si le cookie n'est pas envoyé ?

**Checklist de debugging :**

- [ ] Vérifier que `credentials: 'include'` est présent dans le fetch
- [ ] Vérifier que le domain correspond (moddy.app ou sous-domaine)
- [ ] Vérifier que la connexion est en HTTPS (Secure=true)
- [ ] Vérifier dans DevTools → Application → Cookies
- [ ] Vérifier les headers de réponse après login (Set-Cookie)
- [ ] Vérifier que le navigateur n'est pas en navigation privée
- [ ] Vérifier que les cookies ne sont pas bloqués (paramètres navigateur)

---

## Gestion des états utilisateur

### États possibles

```typescript
type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated', user: User }
  | { status: 'unauthenticated' }

interface User {
  discord_id: number
  email: string | null
}
```

### Flow de vérification au chargement

```
1. App démarre
   ↓
2. État = 'loading'
   ↓
3. Appel GET /auth/verify
   ↓
4. Si valid: true → État = 'authenticated'
   Si valid: false → État = 'unauthenticated'
   ↓
5. Afficher le contenu approprié
```

---

## Exemples de code

### Configuration HMAC

```typescript
// lib/hmac.ts
import crypto from 'crypto'

const API_KEY = process.env.NEXT_PUBLIC_API_KEY!

export function generateSignature(requestId: string, body: any = {}): string {
  const payload = JSON.stringify({
    request_id: requestId,
    body: body
  })

  const signature = crypto
    .createHmac('sha256', API_KEY)
    .update(payload)
    .digest('hex')

  return signature
}

export function generateRequestId(): string {
  return crypto.randomUUID()
}
```

### Service d'authentification

```typescript
// lib/auth.ts
import { generateSignature, generateRequestId } from './hmac'

const API_URL = process.env.NEXT_PUBLIC_API_URL!
const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!
const REDIRECT_URI = `${API_URL}/auth/discord/callback`

export interface User {
  discord_id: number
  email: string | null
}

export interface VerifyResponse {
  valid: boolean
  discord_id?: number
  email?: string | null
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export async function verifySession(): Promise<VerifyResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      credentials: 'include', // Important: envoie les cookies
    })

    if (!response.ok) {
      console.error('Failed to verify session:', response.status)
      return { valid: false }
    }

    const data: VerifyResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error verifying session:', error)
    return { valid: false }
  }
}

/**
 * Démarre le flow d'authentification Discord
 */
export async function signInWithDiscord() {
  try {
    // 1. Initialiser l'auth et obtenir le state
    const requestId = generateRequestId()
    const body = {
      current_page: window.location.href
    }
    const signature = generateSignature(requestId, body)

    const response = await fetch(`${API_URL}/api/website/auth/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Signature': signature
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize auth: ${response.status}`)
    }

    const { state } = await response.json()

    // 2. Construire l'URL Discord OAuth
    const discordUrl = new URL('https://discord.com/api/oauth2/authorize')
    discordUrl.searchParams.set('client_id', DISCORD_CLIENT_ID)
    discordUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    discordUrl.searchParams.set('response_type', 'code')
    discordUrl.searchParams.set('scope', 'identify email')
    discordUrl.searchParams.set('state', state)

    // 3. Rediriger vers Discord
    window.location.href = discordUrl.toString()
  } catch (error) {
    console.error('Error signing in with Discord:', error)
    throw error
  }
}

/**
 * Déconnecte l'utilisateur
 */
export async function logout(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      credentials: 'include', // Important: envoie les cookies
    })

    if (!response.ok) {
      console.error('Failed to logout:', response.status)
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Error logging out:', error)
    return false
  }
}
```

### Hook React

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react'
import { verifySession, type User } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated', user: User }
  | { status: 'unauthenticated' }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    async function checkAuth() {
      const result = await verifySession()

      if (result.valid && result.discord_id) {
        setState({
          status: 'authenticated',
          user: {
            discord_id: result.discord_id,
            email: result.email || null
          }
        })
      } else {
        setState({ status: 'unauthenticated' })
      }
    }

    checkAuth()
  }, [])

  return state
}
```

### Composant de connexion

```typescript
// components/SignInButton.tsx
'use client'

import { signInWithDiscord } from '@/lib/auth'

export function SignInButton() {
  const handleSignIn = async () => {
    try {
      await signInWithDiscord()
      // La redirection vers Discord se fait automatiquement
    } catch (error) {
      alert('Erreur lors de la connexion. Veuillez réessayer.')
    }
  }

  return (
    <button
      onClick={handleSignIn}
      className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold py-2 px-4 rounded-lg transition"
    >
      Sign in with Discord
    </button>
  )
}
```

### Composant de déconnexion

```typescript
// components/LogoutButton.tsx
'use client'

import { logout } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const success = await logout()

      if (success) {
        // Rediriger vers la page d'accueil
        router.push('/')
        // Rafraîchir pour mettre à jour l'état
        router.refresh()
      } else {
        alert('Erreur lors de la déconnexion')
      }
    } catch (error) {
      console.error('Logout error:', error)
      alert('Erreur lors de la déconnexion')
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="text-gray-600 hover:text-gray-900 font-medium"
    >
      Logout
    </button>
  )
}
```

### Page protégée

```typescript
// app/dashboard/page.tsx
'use client'

import { useAuth } from '@/hooks/useAuth'
import { SignInButton } from '@/components/SignInButton'
import { LogoutButton } from '@/components/LogoutButton'

export default function DashboardPage() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Please sign in</h1>
        <SignInButton />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <LogoutButton />
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-4">User Info</h2>
        <div className="space-y-2">
          <p><strong>Discord ID:</strong> {auth.user.discord_id}</p>
          <p><strong>Email:</strong> {auth.user.email || 'Not provided'}</p>
        </div>
      </div>
    </div>
  )
}
```

### Context Provider (optionnel, pour app-wide state)

```typescript
// contexts/AuthContext.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { verifySession, logout as logoutUser, type User } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated', user: User }
  | { status: 'unauthenticated' }

interface AuthContextValue {
  auth: AuthState
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  const refresh = async () => {
    setAuth({ status: 'loading' })
    const result = await verifySession()

    if (result.valid && result.discord_id) {
      setAuth({
        status: 'authenticated',
        user: {
          discord_id: result.discord_id,
          email: result.email || null
        }
      })
    } else {
      setAuth({ status: 'unauthenticated' })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const logout = async () => {
    const success = await logoutUser()
    if (success) {
      setAuth({ status: 'unauthenticated' })
    }
  }

  return (
    <AuthContext.Provider value={{ auth, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider')
  }
  return context
}
```

---

## Bonnes pratiques

### 1. Sécurité

✅ **À FAIRE :**
- Toujours utiliser `credentials: 'include'` pour les requêtes API
- Vérifier la session au chargement de l'app
- Re-vérifier la session avant les actions sensibles
- Gérer les erreurs réseau gracieusement
- Utiliser HTTPS en production

❌ **À ÉVITER :**
- Stocker le token de session en localStorage
- Tenter d'accéder au cookie `moddy_session` en JS
- Faire confiance au state local sans vérification backend
- Exposer des secrets côté client

### 2. UX

✅ **À FAIRE :**
- Afficher un loader pendant la vérification
- Rediriger vers la page demandée après connexion
- Afficher des messages d'erreur clairs
- Permettre la déconnexion depuis n'importe quelle page
- Persister l'état d'auth dans un context/store global

❌ **À ÉVITER :**
- Bloquer l'UI sans feedback visuel
- Perdre la page demandée après connexion
- Montrer des erreurs techniques à l'utilisateur
- Forcer la déconnexion sans confirmation

### 3. Performance

✅ **À FAIRE :**
- Vérifier la session une seule fois au chargement
- Utiliser un context/store pour partager l'état
- Implémenter un système de cache côté client
- Rafraîchir la session seulement quand nécessaire

❌ **À ÉVITER :**
- Vérifier la session à chaque rendu
- Faire des appels API redondants
- Re-fetch les données utilisateur constamment

### 4. Gestion d'état

✅ **À FAIRE :**
- Utiliser un state manager (Context, Zustand, Redux)
- Avoir 3 états clairs: loading, authenticated, unauthenticated
- Synchroniser l'état avec le backend
- Gérer les transitions d'état proprement

❌ **À ÉVITER :**
- Disperser l'état d'auth partout
- Avoir des états incohérents
- Oublier l'état de chargement

---

## Gestion des erreurs

### Erreurs possibles

| Erreur | Code | Cause | Solution |
|--------|------|-------|----------|
| Signature invalide | 401 | HMAC incorrect | Vérifier l'API_KEY et l'algorithme |
| State invalide | 400 | State expiré/invalide | Recommencer le flow OAuth |
| Session expirée | 200 (valid: false) | Cookie expiré | Redemander la connexion |
| Erreur réseau | - | API inaccessible | Afficher message de retry |
| CORS error | - | Origine non autorisée | Vérifier configuration backend |

### Exemple de gestion d'erreurs

```typescript
// lib/auth.ts
export class AuthError extends Error {
  constructor(
    message: string,
    public code?: number,
    public details?: any
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function signInWithDiscord() {
  try {
    const requestId = generateRequestId()
    const body = { current_page: window.location.href }
    const signature = generateSignature(requestId, body)

    const response = await fetch(`${API_URL}/api/website/auth/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Signature': signature
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthError('Invalid API signature', 401)
      }
      throw new AuthError(`Failed to initialize auth: ${response.status}`, response.status)
    }

    const { state } = await response.json()

    const discordUrl = new URL('https://discord.com/api/oauth2/authorize')
    discordUrl.searchParams.set('client_id', DISCORD_CLIENT_ID)
    discordUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    discordUrl.searchParams.set('response_type', 'code')
    discordUrl.searchParams.set('scope', 'identify email')
    discordUrl.searchParams.set('state', state)

    window.location.href = discordUrl.toString()
  } catch (error) {
    if (error instanceof AuthError) {
      console.error('[Auth Error]', error.message, error.code)
      throw error
    }

    console.error('[Unexpected Error]', error)
    throw new AuthError('An unexpected error occurred')
  }
}
```

### Composant d'erreur

```typescript
// components/AuthError.tsx
interface AuthErrorProps {
  error: Error
  onRetry?: () => void
}

export function AuthError({ error, onRetry }: AuthErrorProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="text-red-500 text-xl">⚠️</div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">
            Authentication Error
          </h3>
          <p className="text-red-700 text-sm mb-3">
            {error.message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="bg-red-100 hover:bg-red-200 text-red-900 px-4 py-2 rounded text-sm font-medium transition"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Checklist d'implémentation

### Phase 1 : Configuration
- [ ] Installer les dépendances nécessaires
- [ ] Configurer les variables d'environnement
- [ ] Créer le service HMAC (`lib/hmac.ts`)
- [ ] Créer le service d'auth (`lib/auth.ts`)

### Phase 2 : Authentification
- [ ] Implémenter le bouton de connexion
- [ ] Implémenter la vérification de session
- [ ] Implémenter la déconnexion
- [ ] Tester le flow complet

### Phase 3 : Gestion d'état
- [ ] Créer le hook `useAuth`
- [ ] Créer le Context Provider (optionnel)
- [ ] Intégrer dans l'app

### Phase 4 : UI/UX
- [ ] Créer le composant SignInButton
- [ ] Créer le composant LogoutButton
- [ ] Créer les états de loading
- [ ] Gérer les erreurs visuellement

### Phase 5 : Protection des pages
- [ ] Protéger les routes privées
- [ ] Rediriger les non-authentifiés
- [ ] Sauvegarder la page demandée

### Phase 6 : Tests
- [ ] Tester la connexion
- [ ] Tester la déconnexion
- [ ] Tester l'expiration de session
- [ ] Tester les erreurs réseau

---

## Support et aide

### URLs importantes

- **API Backend :** `https://api.moddy.app`
- **Frontend :** `https://moddy.app`
- **Discord OAuth Callback :** `https://api.moddy.app/auth/discord/callback`

### Endpoints de test

```bash
# Vérifier que l'API fonctionne
curl https://api.moddy.app/

# Vérifier la santé de l'API
curl https://api.moddy.app/health

# Vérifier la session (avec cookie)
curl https://api.moddy.app/auth/verify \
  --cookie "moddy_session=YOUR_TOKEN"
```

### Debugging

**Vérifier les cookies :**
```javascript
// Dans la console du navigateur
document.cookie
// Devrait montrer: moddy_session=...
```

**Vérifier la requête HMAC :**
```javascript
import crypto from 'crypto'

const requestId = crypto.randomUUID()
const body = { current_page: 'https://moddy.app' }
const payload = JSON.stringify({ request_id: requestId, body })
const signature = crypto.createHmac('sha256', API_KEY).update(payload).digest('hex')

console.log('Request ID:', requestId)
console.log('Payload:', payload)
console.log('Signature:', signature)
```

**Vérifier les headers de réponse :**
```javascript
fetch('https://api.moddy.app/auth/verify', {
  credentials: 'include'
})
.then(r => {
  console.log('Status:', r.status)
  console.log('Headers:', [...r.headers.entries()])
  return r.json()
})
.then(data => console.log('Data:', data))
```

---

## Résumé

### Ce que le frontend doit faire :

1. ✅ Générer des signatures HMAC pour `/api/website/*`
2. ✅ Utiliser `credentials: 'include'` pour tous les appels
3. ✅ Vérifier la session au chargement avec `/auth/verify`
4. ✅ Rediriger vers Discord OAuth avec le state
5. ✅ Gérer les 3 états : loading, authenticated, unauthenticated
6. ✅ Appeler `/auth/logout` pour déconnecter

### Ce que le frontend NE doit PAS faire :

1. ❌ Tenter de lire le cookie `moddy_session`
2. ❌ Stocker des tokens en localStorage
3. ❌ Exposer des secrets (client_secret, database_url)
4. ❌ Oublier d'envoyer les cookies (`credentials: 'include'`)
5. ❌ Faire confiance à l'état local sans vérification backend

---

**Bonne implémentation ! 🚀**
