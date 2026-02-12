# Session du 2026-02-12 - Intégration Backend

**Date** : 12 février 2026
**Durée** : ~1h
**Objectif** : Intégrer la communication entre le frontend (dashboard) et le backend Moddy

---

## 🎯 Objectif de la session

Implémenter la connexion complète entre le dashboard React et le backend Moddy API pour permettre:
- L'authentification via Discord OAuth2
- La vérification de session
- La communication sécurisée avec signature HMAC

---

## ✅ Tâches accomplies

### 1. Configuration de l'environnement

**Fichiers créés:**
- `app/.env.local` - Variables d'environnement pour le développement local

**Variables configurées:**
```bash
VITE_API_URL=https://api.moddy.app
VITE_API_KEY=your-shared-api-key-here
VITE_DISCORD_CLIENT_ID=your-discord-client-id-here
```

> **Note**: En production (Vercel), ces variables seront configurées directement dans les settings Vercel.

---

### 2. Structure de dossiers créée

```
app/src/
├── lib/
│   ├── hmac.ts          # Nouveau
│   ├── auth.ts          # Nouveau
│   └── utils.ts         # Existant
├── hooks/
│   └── useAuth.ts       # Nouveau
└── services/            # Nouveau (vide pour l'instant)
```

---

### 3. Implémentation du service HMAC

**Fichier**: `app/src/lib/hmac.ts`

**Fonctionnalités:**
- `generateSignature(requestId, body)` - Génère une signature HMAC-SHA256
- `generateRequestId()` - Génère un UUID v4 unique
- Utilise l'API Web Crypto du navigateur (pas Node.js crypto)
- Trie récursivement les clés JSON pour correspondre au backend Python

**Points techniques:**
- Adaptation pour le navigateur (Web Crypto API au lieu de Node.js crypto)
- Signature HMAC-SHA256 en hexadécimal
- Payload au format: `{"body": {...}, "request_id": "..."}`

---

### 4. Implémentation du service d'authentification

**Fichier**: `app/src/lib/auth.ts`

**Fonctions créées:**

1. **`verifySession()`**
   - Vérifie si l'utilisateur est connecté
   - Appelle `GET /auth/verify`
   - Retourne `{valid: boolean, discord_id?, email?}`

2. **`signInWithDiscord()`**
   - Démarre le flow OAuth Discord
   - Appelle `POST /api/website/auth/init` avec signature HMAC
   - Redirige vers Discord OAuth avec le state token

3. **`logout()`**
   - Déconnecte l'utilisateur
   - Appelle `GET /auth/logout`
   - Retourne `boolean` (succès/échec)

4. **`getUserInfo()`**
   - Récupère les infos complètes Discord de l'utilisateur
   - Appelle `GET /auth/user-info`
   - Gère le refresh token automatiquement

**Points importants:**
- Toutes les requêtes utilisent `credentials: 'include'` pour envoyer les cookies
- Le backend gère la création des cookies (pas le frontend)
- Les signatures HMAC sont générées pour `/api/website/*` uniquement

---

### 5. Création du hook useAuth

**Fichier**: `app/src/hooks/useAuth.ts`

**Fonctionnalité:**
- Hook React qui gère l'état d'authentification
- 3 états possibles:
  - `{status: 'loading'}` - Vérification en cours
  - `{status: 'authenticated', user: {...}}` - Utilisateur connecté
  - `{status: 'unauthenticated'}` - Utilisateur non connecté
- Vérifie automatiquement la session au montage du composant

---

### 6. Test de connexion au démarrage

**Fichier modifié**: `app/src/App.tsx`

**Ajouts:**
- Import et utilisation du hook `useAuth()`
- Affichage du statut de connexion avec le backend
- Interface visuelle avec 3 états:
  - 🔄 Loading: spinner + "Connexion au backend..."
  - ✅ Authenticated: infos utilisateur + bouton déconnexion
  - ⚠️ Unauthenticated: message + bouton "Se connecter avec Discord"
- Boutons fonctionnels pour login et logout

**Design:**
- Utilise les composants Tailwind CSS du projet
- Icônes SVG intégrées (pas de dépendance supplémentaire)
- Style cohérent avec le design system existant

---

### 7. Documentation mise à jour

**Fichier modifié**: `docs/CLAUDE.md`

**Sections ajoutées:**
- Description des nouveaux utilitaires (hmac.ts, auth.ts)
- Section "Intégration Backend" complète
- Description du hook useAuth
- Flow d'authentification détaillé
- Notes de sécurité
- Mise à jour du statut de développement

---

## 📚 Documentation technique

### Flow d'authentification complet

```
1. User clique "Se connecter avec Discord"
   ↓
2. Frontend → POST /api/website/auth/init (avec HMAC)
   ↓
3. Backend → Retourne state token
   ↓
4. Frontend → Redirige vers Discord OAuth + state
   ↓
5. Discord → User autorise
   ↓
6. Discord → Redirige vers backend /auth/discord/callback
   ↓
7. Backend → Échange code → access_token
   ↓
8. Backend → Crée session + pose cookie moddy_session
   ↓
9. Backend → Redirige vers page d'origine
   ↓
10. Frontend → Vérifie session (GET /auth/verify)
    ↓
11. ✅ User connecté!
```

### Sécurité

**HMAC Signature:**
- Algorithme: HMAC-SHA256
- Format payload: `{"body": {...}, "request_id": "uuid"}`
- Clés triées alphabétiquement (récursif)
- Headers: `X-Request-Id` + `X-Signature`

**Cookies:**
- Nom: `moddy_session`
- Propriétés: `HttpOnly`, `Secure`, `SameSite=Lax`
- Durée: 30 jours
- Domain: `.moddy.app` (tous sous-domaines)
- **Créés par le backend uniquement**

**Frontend:**
- Ne crée jamais de cookies
- Vérifie uniquement la session existante
- Utilise `credentials: 'include'` pour envoyer les cookies

---

## 🔧 Technologies utilisées

- **Web Crypto API** - Signature HMAC côté navigateur
- **React Hooks** - Gestion d'état avec useState/useEffect
- **TypeScript** - Typage strict de toutes les fonctions
- **Fetch API** - Requêtes HTTP avec credentials: 'include'

---

## 📝 Notes importantes

### Variables d'environnement

Pour le développement local:
- Fichier `.env.local` créé dans `/app/`
- À ne pas commit (déjà dans .gitignore normalement)

Pour la production (Vercel):
- Configurer les 3 variables dans Vercel Settings
- `VITE_API_URL`, `VITE_API_KEY`, `VITE_DISCORD_CLIENT_ID`

### Rôles frontend/backend

**Backend** (api.moddy.app):
- ✅ Gère l'OAuth Discord
- ✅ Crée et gère les sessions
- ✅ Pose les cookies `moddy_session`
- ✅ Stocke les refresh tokens Discord
- ✅ Vérifie les signatures HMAC

**Frontend** (moddy.app):
- ✅ Initie le flow d'authentification
- ✅ Vérifie si une session existe
- ✅ Signe les requêtes vers `/api/website/*`
- ❌ Ne crée jamais de cookies
- ❌ Ne gère pas les tokens Discord directement

---

## 🎯 Prochaines étapes possibles

1. **Routing** - Implémenter React Router pour les pages
2. **Pages protégées** - Créer des routes nécessitant l'authentification
3. **Context Provider** - AuthContext global pour éviter prop drilling
4. **Gestion d'erreurs** - Messages d'erreur plus détaillés
5. **Loading states** - Améliorer les états de chargement
6. **Refresh automatique** - Rafraîchir le token avant expiration

---

## 🐛 Problèmes rencontrés

Aucun problème majeur. Quelques adaptations:

1. **Crypto API** - Adaptation du code de la doc (Node.js) vers Web Crypto API
2. **Import meta env** - Utilisation de `import.meta.env.VITE_*` au lieu de `process.env.NEXT_PUBLIC_*`

---

## ✨ Résultat

Le dashboard peut maintenant:
- ✅ Se connecter au backend au démarrage
- ✅ Vérifier automatiquement si l'utilisateur est connecté
- ✅ Permettre la connexion via Discord OAuth
- ✅ Afficher les informations de l'utilisateur
- ✅ Permettre la déconnexion

Le tout de manière sécurisée avec signature HMAC et cookies HTTP-only.

---

**Session terminée avec succès** ✅
