# Session : Routing SPA, Auth Guard et Page Debug

## En-tête

- **Date** : 2026-02-12
- **Objectif principal** : Mise en place du routing SPA avec react-router-dom, création d'un auth guard sur la page d'accueil, et enrichissement de la page de debug

## Tâches accomplies

### 1. Installation de react-router-dom
- Ajout de `react-router-dom@^7.13.0` comme dépendance
- Problème rencontré avec npm (résidu `.pnpm` dans `node_modules`) — résolu en supprimant le dossier `.pnpm`

### 2. Mise en place du routing SPA
- **`app/src/main.tsx`** — Wrappé l'app avec `<BrowserRouter>`
- **`app/src/App.tsx`** — Configuré les routes :
  - `/` → `HomePage` (avec auth guard)
  - `/debug` → `DebugPage`
- Suppression de l'ancien contenu monolithique de `App.tsx`

### 3. Création de la page d'accueil avec auth guard
- **`app/src/pages/HomePage.tsx`** — Nouvelle page :
  - Vérifie l'authentification via `useAuth()`
  - **Loading** → Spinner centré + "Checking session..."
  - **Non connecté** → Redirect immédiat vers `https://moddy.app/sign-in?url=<URL encodée>`
  - **Connecté** → Affiche "You are logged in"
  - L'URL actuelle est encodée en percent-encoding via `encodeURIComponent()`

### 4. Déplacement du contenu vers la page Debug
- **`app/src/pages/DebugPage.tsx`** — Tout l'ancien contenu de `App.tsx` déplacé ici, enrichi avec de nouvelles sections :
  - **Authentication** — Status, avatar, user info raw JSON, session data
  - **API Connectivity** — Boutons ping pour tester l'API directe et le proxy Vercel (avec latence en ms)
  - **Environment** — Variables `VITE_*`, mode dev/prod
  - **Router** — Pathname, search, hash, origin, full URL
  - **Browser** — User agent, langue, online, cookies activés, CPU cores, écran, timezone
  - **Performance** — DOM load, TTFB, DNS, TCP, transfer size, mémoire JS
  - **Cookies** — Liste des cookies visibles
  - **Storage** — Contenu de localStorage et sessionStorage
  - **Live Logs** — Capture de `console.log`, `console.error` et `console.warn`, bouton clear, compteur
  - **UI Components Showcase** — Replié par défaut
  - Toutes les sections sont repliables (collapsible)

### 5. Configuration Vercel pour SPA routing
- **`vercel.json`** (racine) — Rewrites pour le SPA fallback :
  - `/api/*` → Serverless functions
  - `/*` → `index.html`
- **`app/vercel.json`** — Copie dans `app/` car le Root Directory Vercel est configuré sur `app`

### 6. Passage en anglais
- Tout le texte UI des pages `HomePage` et `DebugPage` est maintenant en anglais

## Fichiers créés

| Fichier | Description |
|---------|-------------|
| `app/src/pages/HomePage.tsx` | Page d'accueil avec auth guard et redirect |
| `app/src/pages/DebugPage.tsx` | Page debug complète (déplacée depuis App.tsx) |
| `vercel.json` | Config Vercel SPA rewrites (racine) |
| `app/vercel.json` | Config Vercel SPA rewrites (copie pour Root Directory) |

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `app/src/App.tsx` | Remplacé par le routeur (Routes + 2 pages) |
| `app/src/main.tsx` | Ajout de `<BrowserRouter>` |
| `app/package.json` | Ajout de `react-router-dom@^7.13.0` |

## Changements structurels

- Création du dossier `app/src/pages/` (était vide auparavant)
- L'application passe d'une app mono-page à une SPA avec routing
- Architecture de routing en place pour ajouter facilement de nouvelles pages

## Technologies ajoutées

- **react-router-dom 7.13.0** — Routing côté client pour React

## Problèmes rencontrés

1. **npm install échoue** — Résidu `.pnpm` dans `node_modules` causait une erreur `Cannot read properties of null (reading 'matches')`. Résolu en supprimant `node_modules/.pnpm`.

2. **Build Vercel échoue** — Le `vercel.json` initial contenait `buildCommand`, `outputDirectory` et `framework` qui entraient en conflit avec la config du dashboard Vercel. Résolu en ne gardant que les `rewrites`.

3. **404 sur /debug en production** — Vercel ne connaît pas les routes client-side et cherche un fichier `/debug`. Résolu avec les rewrites SPA dans `vercel.json`. Le fichier a été copié dans `app/` car le Root Directory Vercel pointe sur `app`.

## Prochaines étapes

- Vérifier que le `vercel.json` dans `app/` résout bien la 404 sur `/debug`
- Construire le vrai contenu du dashboard sur la page d'accueil (une fois connecté)
- Ajouter un layout commun (sidebar, header, navigation)
- Implémenter le thème clair/dark
- Ajouter des pages protégées supplémentaires
