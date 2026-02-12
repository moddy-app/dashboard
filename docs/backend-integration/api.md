# Documentation API

Base URL: `https://api.moddy.app`

## Authentification des requêtes

Toutes les requêtes vers `/api/website/` doivent être signées avec HMAC-SHA256.

### Headers requis

| Header | Description | Exemple |
|--------|-------------|---------|
| `X-Request-Id` | UUID unique de la requête | `550e8400-e29b-41d4-a716-446655440000` |
| `X-Signature` | Signature HMAC-SHA256 du payload | `a1b2c3d4e5f6...` |
| `Content-Type` | Type de contenu (pour POST) | `application/json` |

### Génération de la signature

```javascript
// Frontend (JavaScript)
import crypto from 'crypto';

const API_KEY = process.env.API_KEY; // Clé partagée

function generateSignature(requestId, body = {}) {
  const payload = JSON.stringify({
    request_id: requestId,
    body: body
  }, Object.keys(payload).sort()); // Important: trier les clés

  const signature = crypto
    .createHmac('sha256', API_KEY)
    .update(payload)
    .digest('hex');

  return signature;
}

// Exemple d'utilisation
const requestId = crypto.randomUUID();
const body = { current_page: "https://moddy.app/dashboard" };
const signature = generateSignature(requestId, body);

fetch('https://api.moddy.app/api/website/auth/init', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Request-Id': requestId,
    'X-Signature': signature
  },
  body: JSON.stringify(body)
});
```

## Endpoints

### 🏠 Root

#### `GET /`

Vérifie que l'API fonctionne.

**Requête :**
```bash
curl https://api.moddy.app/
```

**Réponse :**
```json
{
  "message": "Moddy Backend API",
  "version": "1.0.0",
  "status": "running"
}
```

---

#### `GET /health`

Endpoint de santé pour monitoring.

**Requête :**
```bash
curl https://api.moddy.app/health
```

**Réponse :**
```json
{
  "status": "healthy",
  "environment": "production"
}
```

---

### 🔐 API Endpoints (`/api/website/`)

#### `POST /api/website/auth/init`

Initialise une authentification Discord. Le frontend l'appelle quand l'utilisateur clique sur "Sign in with Discord".

**Headers :**
- `X-Request-Id`: UUID de la requête
- `X-Signature`: Signature HMAC
- `Content-Type`: application/json

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

**Erreurs :**
- `401 Unauthorized` - Signature HMAC invalide
- `422 Unprocessable Entity` - Body invalide

**Usage :**
```javascript
// 1. Appeler l'endpoint
const response = await fetch('/api/website/auth/init', {
  method: 'POST',
  headers: {
    'X-Request-Id': requestId,
    'X-Signature': signature,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    current_page: window.location.href
  })
});

const { state } = await response.json();

// 2. Rediriger vers Discord
const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=identify%20email&state=${state}`;
window.location.href = discordUrl;
```

---

#### `POST /api/website/test`

Endpoint de test pour vérifier que HMAC fonctionne.

**Headers :**
- `X-Request-Id`: UUID de la requête
- `X-Signature`: Signature HMAC

**Réponse (200) :**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "message": "API is working correctly",
  "data": {
    "hmac_validated": true
  }
}
```

**Erreurs :**
- `401 Unauthorized` - Signature HMAC invalide

---

### 🔑 Auth Endpoints (`/auth/discord/`)

#### `GET /auth/discord/callback`

Callback Discord OAuth2. **N'est pas appelé directement par le frontend**, mais par Discord après l'authentification.

**Query Parameters :**
- `code`: Code d'autorisation Discord
- `state`: State token généré par `/api/website/auth/init`

**Réponse :**
- Redirection vers la page d'origine avec cookie `moddy_session`

**Cookie posé :**
```
moddy_session=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
Domain=.moddy.app
Path=/
HttpOnly
Secure
SameSite=Lax
Max-Age=2592000 (30 jours)
```

**Erreurs :**
- `400 Bad Request` - State invalide ou code invalide
- `500 Internal Server Error` - Erreur lors de l'échange avec Discord

**Flow complet :**
```
1. User clique "Sign in"
2. Frontend → POST /api/website/auth/init
3. Backend → Retourne state
4. Frontend → Redirige vers Discord avec state
5. Discord → Authentifie user
6. Discord → Redirige vers /auth/discord/callback?code=XXX&state=YYY
7. Backend → Échange code → access_token
8. Backend → Récupère user info
9. Backend → Crée session + cookie
10. Backend → Redirige vers page d'origine
11. Frontend → Reçoit cookie, user connecté
```

---

### 🔓 Session Endpoints (`/auth/`)

#### `GET /auth/verify`

Vérifie si le token de session dans le cookie est valide. Le frontend l'utilise pour vérifier si l'utilisateur est connecté.

**Requête :**
```bash
curl https://api.moddy.app/auth/verify \
  --cookie "moddy_session=TOKEN"
```

**Réponse (200) - Connecté :**
```json
{
  "valid": true,
  "discord_id": 123456789012345678,
  "email": "user@example.com"
}
```

**Réponse (200) - Non connecté :**
```json
{
  "valid": false,
  "discord_id": null,
  "email": null
}
```

**Usage Frontend :**
```javascript
const response = await fetch('https://api.moddy.app/auth/verify', {
  credentials: 'include'  // Envoie les cookies
});

const data = await response.json();

if (data.valid) {
  console.log(`Connecté: ${data.discord_id}`);
} else {
  console.log('Non connecté');
}
```

---

#### `GET /auth/logout`

Déconnecte l'utilisateur en révoquant sa session et supprimant le cookie.

**Requête :**
```bash
curl https://api.moddy.app/auth/logout \
  --cookie "moddy_session=TOKEN"
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
- Retourne une réponse JSON

**⚠️ Note :** Cela ne révoque pas l'access token Discord, seulement la session Moddy.

**Usage Frontend :**
```javascript
const response = await fetch('https://api.moddy.app/auth/logout', {
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  window.location.href = 'https://moddy.app';
}
```

---

#### `GET /auth/user-info`

Récupère les informations complètes de l'utilisateur depuis Discord. Utilise le refresh token pour obtenir un access token frais.

**Requête :**
```bash
curl https://api.moddy.app/auth/user-info \
  --cookie "moddy_session=TOKEN"
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

**Champs de la réponse :**

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Discord ID (Snowflake) |
| `username` | string | Nom d'utilisateur Discord |
| `discriminator` | string | Discriminateur (ex: "0001") |
| `avatar` | string\|null | Hash de l'avatar |
| `email` | string\|null | Email de l'utilisateur |
| `verified` | boolean\|null | Si l'email est vérifié |
| `locale` | string\|null | Langue (ex: "en-US", "fr") |
| `mfa_enabled` | boolean\|null | Si 2FA est activé |
| `premium_type` | int\|null | Type Nitro (0=None, 1=Classic, 2=Full) |
| `public_flags` | int\|null | Flags publics du compte |
| `avatar_url` | string\|null | URL complète de l'avatar (PNG ou GIF) |

**Erreurs :**
- `401 Unauthorized` - Non authentifié ou refresh token invalide
- `500 Internal Server Error` - Erreur lors de la récupération

**Comportement :**
1. Vérifie le cookie de session
2. Utilise le refresh token pour obtenir un access token Discord
3. Met à jour le refresh token si Discord en renvoie un nouveau
4. Récupère les infos utilisateur depuis `GET /users/@me`
5. Construit l'URL de l'avatar automatiquement (PNG ou GIF)
6. ⚠️ Si le refresh échoue, supprime la session

**⚠️ Important :** Si le refresh token est invalide ou révoqué, la session sera automatiquement supprimée et l'utilisateur devra se reconnecter.

**Usage Frontend :**
```javascript
const response = await fetch('https://api.moddy.app/auth/user-info', {
  credentials: 'include'
});

if (response.status === 401) {
  // Refresh token invalide, rediriger vers login
  window.location.href = '/login';
  return;
}

const userInfo = await response.json();

console.log('Username:', userInfo.username);
console.log('Avatar URL:', userInfo.avatar_url);
console.log('Has Nitro:', userInfo.premium_type > 0);
```

---

## Codes d'erreur

| Code | Signification | Cause commune |
|------|---------------|---------------|
| 200 | OK | Requête réussie |
| 302 | Found | Redirection (callback OAuth) |
| 400 | Bad Request | Paramètres manquants ou invalides |
| 401 | Unauthorized | Signature HMAC invalide |
| 422 | Unprocessable Entity | Body JSON invalide |
| 500 | Internal Server Error | Erreur serveur |

## Rate limiting

⚠️ **Pas encore implémenté**

À implémenter :
- 100 requêtes / minute par IP
- 1000 requêtes / heure par IP
- Réponse: `429 Too Many Requests`

## CORS

Les origines autorisées :
- `https://moddy.app`
- `https://www.moddy.app`
- `https://*.moddy.app` (tous sous-domaines)

Headers autorisés : Tous (`*`)
Méthodes autorisées : `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
Credentials : Oui (pour cookies)

## Exemples d'intégration

### React/Next.js

```typescript
// lib/api.ts
import crypto from 'crypto';

const API_URL = 'https://api.moddy.app';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY!;

export async function apiRequest(endpoint: string, body: any = {}) {
  const requestId = crypto.randomUUID();
  const payload = { request_id: requestId, body };
  const signature = crypto
    .createHmac('sha256', API_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include', // Important pour cookies
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Signature': signature
    },
    body: JSON.stringify(body)
  });

  return response.json();
}

// Usage
export async function initiateDiscordAuth() {
  const data = await apiRequest('/api/website/auth/init', {
    current_page: window.location.href
  });

  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent('https://api.moddy.app/auth/discord/callback')}&response_type=code&scope=identify%20email&state=${data.state}`;

  window.location.href = discordUrl;
}
```

### Vue.js

```javascript
// api/auth.js
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

const API_URL = 'https://api.moddy.app';
const API_KEY = import.meta.env.VITE_API_KEY;

async function makeRequest(endpoint, body = {}) {
  const requestId = uuidv4();
  const payload = JSON.stringify({ request_id: requestId, body });
  const signature = CryptoJS.HmacSHA256(payload, API_KEY).toString();

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Signature': signature
    },
    body: JSON.stringify(body)
  });

  return response.json();
}

export async function startDiscordLogin() {
  const { state } = await makeRequest('/api/website/auth/init', {
    current_page: window.location.href
  });

  const url = new URL('https://discord.com/api/oauth2/authorize');
  url.searchParams.set('client_id', import.meta.env.VITE_DISCORD_CLIENT_ID);
  url.searchParams.set('redirect_uri', 'https://api.moddy.app/auth/discord/callback');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'identify email');
  url.searchParams.set('state', state);

  window.location.href = url.toString();
}
```
