# API Serverless Functions (Vercel)

Ce dossier contient les serverless functions Vercel qui s'exécutent côté serveur.

## 🎯 Objectif

Les fonctions API servent de **proxy sécurisé** entre le frontend et le backend Moddy. Elles permettent de :

1. **Cacher la clé API** - La clé API n'est jamais exposée au client
2. **Signer les requêtes** - Les signatures HMAC sont générées côté serveur
3. **Protéger contre les abus** - Seules les requêtes valides sont forwardées au backend

## 📁 Structure

```
/api/
├── backend-proxy.ts    # Proxy pour signer les requêtes vers le backend Moddy
├── package.json        # Dépendances pour les fonctions API
└── README.md          # Ce fichier
```

## 🔐 backend-proxy.ts

### Fonctionnalité

Cette fonction serverless reçoit les requêtes du frontend, les signe avec HMAC-SHA256, puis les forward vers le backend Moddy.

### Endpoint

```
POST /api/backend-proxy
```

### Body

```json
{
  "endpoint": "/api/website/auth/init",
  "body": {
    "current_page": "https://moddy.app/dashboard"
  }
}
```

### Réponse

Retourne la réponse du backend Moddy sans modification.

### Flow

```
1. Frontend → POST /api/backend-proxy
   {endpoint: "/api/website/auth/init", body: {...}}

2. Serverless Function:
   - Génère un request_id unique (UUID)
   - Génère la signature HMAC avec la clé API secrète
   - Forward vers https://api.moddy.app + endpoint

3. Backend Moddy:
   - Vérifie la signature HMAC
   - Traite la requête
   - Retourne la réponse

4. Serverless Function → Frontend
   Retourne la réponse du backend
```

### Sécurité

✅ **Clé API jamais exposée** - Reste côté serveur uniquement
✅ **Signature HMAC-SHA256** - Utilise `crypto` Node.js
✅ **CORS configuré** - Accepte uniquement les requêtes depuis moddy.app
✅ **Validation** - Vérifie que l'endpoint est fourni

## 🌍 Variables d'environnement

Les fonctions API ont accès aux variables d'environnement **non préfixées par `VITE_`**.

**Variables requises** :

```bash
API_URL=https://api.moddy.app
API_KEY=your-shared-api-key-here
```

⚠️ **Important** : Sur Vercel, configurez ces variables dans **Settings > Environment Variables**.

## 🚀 Déploiement

Les fonctions API sont automatiquement déployées par Vercel lorsque le projet est pushé.

**Vercel détecte automatiquement** :
- Les fichiers `.ts` dans `/api/` comme des serverless functions
- L'endpoint `/api/backend-proxy` sera disponible

**Pas besoin de configuration supplémentaire** !

## 🧪 Test local

Pour tester les fonctions API en local :

```bash
# Installer Vercel CLI
npm i -g vercel

# Lancer le dev server (depuis la racine du projet)
vercel dev
```

Les fonctions seront disponibles sur `http://localhost:3000/api/backend-proxy`.

## 📚 Documentation Vercel

- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js)

---

**Note** : Ces fonctions ne sont PAS utilisées en développement local avec `npm run dev` dans `/app/`. Elles sont uniquement pour la production sur Vercel.

En dev local, les requêtes vers `/api/backend-proxy` échoueront à moins d'utiliser `vercel dev`.
