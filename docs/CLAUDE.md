# Moddy Dashboard - Documentation Technique

## Vue d'ensemble du projet

**Moddy Dashboard** est une interface web de gestion moderne pour le bot Discord Moddy. C'est un projet frontend développé avec React 19 et Vite, utilisant TypeScript et Tailwind CSS pour offrir une alternative web aux commandes Discord.

- **Créateur** : juthing
- **Licence** : CC BY-NC-SA 4.0 (Non-commercial)
- **Statut** : En développement actif
- **Branche principale** : `main`

## Architecture du projet

### Structure des dossiers

```
/workspaces/dashboard/
├── api/                    # Serverless Functions Vercel
│   └── backend-proxy.ts   # Proxy sécurisé pour signer les requêtes HMAC
├── app/                    # Application React + Vite principale
│   ├── src/
│   │   ├── components/     # Composants React réutilisables
│   │   │   ├── ui/        # Bibliothèque shadcn/ui
│   │   │   └── *.tsx      # Composants d'exemple
│   │   ├── pages/         # Composants de pages (vide, prêt à être développé)
│   │   ├── layouts/       # Composants de mise en page (vide)
│   │   ├── hooks/         # Hooks React personnalisés (useAuth, etc.)
│   │   ├── services/      # Services API (prêt pour extension)
│   │   ├── lib/          # Fonctions utilitaires (auth, utils)
│   │   ├── assets/       # Ressources statiques
│   │   ├── App.tsx       # Composant racine
│   │   ├── main.tsx      # Point d'entrée React
│   │   └── index.css     # Styles globaux + design tokens
│   ├── public/           # Fichiers statiques publics
│   ├── .env.local        # Variables d'environnement (dev local uniquement)
│   ├── index.html        # Point d'entrée HTML
│   ├── package.json      # Dépendances et scripts
│   ├── vite.config.ts    # Configuration Vite
│   ├── components.json   # Configuration shadcn/ui
│   ├── eslint.config.js  # Configuration ESLint
│   └── tsconfig.*.json   # Configurations TypeScript
├── docs/                 # Documentation
│   ├── CLAUDE.md         # Documentation technique pour Claude (ce fichier)
│   ├── backend-integration/  # Documentation d'intégration API
│   └── sessions/         # Résumés des sessions de développement
│       └── YYYY-MM-DD_description.md  # Un fichier par session
└── README.md            # Documentation du projet
```

## Stack technologique

### Framework principal
- **React 19.2.0** - Bibliothèque UI (dernière version)
- **Vite 7.2.4** - Build tool ultra-rapide et serveur de développement
- **TypeScript 5.9.3** - Type safety strict dans tout le projet

### Styling et Design
- **Tailwind CSS 4.1.17** - Framework CSS utility-first
- **shadcn/ui 3.8.4** - Bibliothèque de composants pré-construits et personnalisables
- **Radix UI 1.4.3** - Composants UI headless (base de shadcn)
- **lucide-react 0.563.0** - Bibliothèque d'icônes (1000+ icônes)
- **Class Variance Authority (CVA) 0.7.1** - Gestion des variantes de composants
- **Tailwind Merge 3.4.0** - Fusion intelligente des classes Tailwind
- **tw-animate-css 1.4.0** - Utilitaires d'animation

### Outils de développement
- **ESLint 9.39.1** - Linting du code avec support TypeScript
- **TypeScript ESLint 8.46.4** - Règles de linting spécifiques à TypeScript
- **Vite React Plugin 5.1.1** - Support JSX dans Vite

### Autres dépendances
- **@base-ui/react 1.1.0** - Composants UI headless légers
- **clsx 2.1.1** - Utilitaire pour classes conditionnelles

> **Typographie** : aucune dépendance npm ni CDN. Google Sans est auto-hébergée
> dans `app/public/fonts/` (voir la section Typographie).

## Fichiers de configuration clés

### `vite.config.ts`
Configuration du build Vite :
- Plugin React pour le support JSX
- Intégration du plugin Tailwind CSS
- Alias de chemin : `@` → `./src`

### `tsconfig.json` & `tsconfig.app.json`
Configuration TypeScript :
- Cible : ES2022 (JavaScript moderne)
- Mode strict activé (tous les checks de type activés)
- Résolution de module : mode bundler
- Alias pour les imports : `@/*` → `./src/*`
- Règles strictes (pas de variables/paramètres non utilisés)

### `components.json`
Configuration shadcn/ui :
- Style : "radix-maia" (système de design basé sur Radix)
- Framework CSS : Tailwind (avec variables CSS pour le theming)
- Bibliothèque d'icônes : lucide-react
- Alias pour les imports de composants :
  - `@/components` → composants
  - `@/lib/utils` → utilitaires
  - `@/components/ui` → composants UI
  - `@/lib` → bibliothèques
  - `@/hooks` → hooks

### `eslint.config.js`
Qualité du code :
- Règles ESLint recommandées
- Configurations TypeScript ESLint
- Règles React Hooks
- Règles React Refresh pour HMR

## Scripts disponibles

```bash
# Démarrer le serveur de développement
npm run dev

# Build de production (vérification TypeScript + build Vite)
npm run build

# Lancer ESLint
npm run lint

# Prévisualiser le build de production
npm run preview
```

## Système de design

### Palette de couleurs
Le projet utilise l'espace colorimétrique **OKLch** pour une gestion moderne et perceptuelle des couleurs.

Variables CSS définies dans `src/index.css` :
- Support des thèmes clair/dark
- Couleurs principales : Primary (bleu), Secondary, Destructive (rouge), tons Muted
- Couleurs de graphiques (5 couleurs pour la visualisation de données)
- Couleurs spécifiques à la sidebar

### Typographie

- **Police** : **Google Sans**, auto-hébergée — ni CDN, ni `@fontsource`, ni
  `next/font`. Aucune requête vers `fonts.googleapis.com` / `fonts.gstatic.com`.

**Fichiers** : `app/public/fonts/google-sans-{400,500,600,700}[-italic].woff2`

Une face par graisse réelle (400 / 500 / 600 / 700 + italiques) plutôt qu'une
seule graisse épaissie synthétiquement : Google Sans rend nettement mieux avec
ses vraies graisses. Les `.woff2` sont sous-ensemblés en `latin + latin-ext`
(les mêmes plages que sert le CDN Google), ce qui couvre les quatre locales
`en / fr / es / de` et fait tomber chaque face de ~1,9 Mo (TTF) à ~35 Ko.

**Déclaration** : les huit `@font-face` sont écrits à la main en tête de
`app/src/index.css`, avec `font-display: swap` (pas de flash de texte
invisible).

**Branchement shadcn** : le `@theme inline` redéfinit `--font-sans` (et
`--font-mono`, `--font-heading`). Tous les composants shadcn héritent donc de la
police via `font-sans` / `font-mono`, sans toucher un seul composant. Les
fallbacks système restent solides tant que le woff2 n'a pas chargé.

**Preload** : `app/index.html` ne précharge que le 400 et le 600 — les deux
seules graisses au-dessus de la ligne de flottaison. Le 500 et le 700 se
chargent à la demande.

**Convention "gras" = 600** : le vrai 700 de Google Sans est visuellement trop
lourd en inline, donc le 600 (demibold) sert de graisse "gras" par défaut —
`b` et `strong` sont mappés sur `font-semibold` dans la couche `base`. Le 700
(`font-bold`) est réservé aux usages ponctuels plus marqués.

**Cache** : `vercel.json` sert `/fonts/*.woff2` en
`max-age=31536000, immutable`. Les noms de fichiers n'ont pas de hash de
contenu — **remplacer une face impose donc de renommer le fichier**, sinon les
navigateurs garderont l'ancienne version jusqu'à un an.

> **Google Sans Mono** : pas encore fournie. `--font-mono` pointe pour l'instant
> sur la pile monospace système ; il suffira d'ajouter le `@font-face` et de
> changer le token le jour où le fichier arrive.

### Design tokens
Variables CSS complètes pour :
- Couleurs
- Radius (border-radius)
- Bordures
- Inputs
- Rings (focus states)
- Breakpoints responsive Tailwind

## Architecture des composants

### Composants UI (dans `/app/src/components/ui/`)

Le projet utilise **shadcn/ui**, qui sont des composants Radix UI non-stylés et accessibles.

**Caractéristiques** :
- Utilisation de **CVA (Class Variance Authority)** pour gérer les variantes
- Attributs data pour les hooks de styling (`data-slot`, `data-variant`, `data-size`)
- Styling avec Tailwind CSS
- Support de la prop `asChild` via le composant Slot de Radix UI

**Composants disponibles** (13 composants) :
- `button.tsx` - Boutons avec variantes (default, outline, secondary, ghost, destructive, link)
- `card.tsx` - Cartes de contenu
- `field.tsx` - Champs de formulaire avec label et description
- `input.tsx` - Champs de saisie
- `textarea.tsx` - Zone de texte multiligne
- `select.tsx` - Menu déroulant de sélection
- `combobox.tsx` - Combo box avec recherche
- `alert-dialog.tsx` - Dialogues d'alerte modaux
- `dropdown-menu.tsx` - Menus déroulants
- `input-group.tsx` - Groupes d'inputs avec addons
- `badge.tsx` - Badges et étiquettes
- `label.tsx` - Labels de formulaire
- `separator.tsx` - Séparateurs visuels

### Exemple de variantes de composant

```typescript
// button.tsx
variants: {
  variant: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
  size: "default" | "xs" | "sm" | "lg" | "icon"
}
```

### Utilitaires

**`src/lib/utils.ts`** :
- Fonction `cn()` - Fusionne intelligemment les classes Tailwind avec clsx et tailwind-merge

**`src/lib/auth.ts`** :
- Fonction `verifySession()` - Vérifie si l'utilisateur est connecté
- Fonction `signInWithDiscord()` - Démarre le flow d'authentification Discord OAuth (via proxy)
- Fonction `logout()` - Déconnecte l'utilisateur
- Fonction `getUserInfo()` - Récupère les informations complètes de l'utilisateur
- Fonction `callBackendProxy()` - Appelle le proxy Vercel pour signer les requêtes

### API Serverless (Vercel Functions)

**`/api/backend-proxy.ts`** :
- Proxy sécurisé pour les requêtes vers le backend Moddy
- Génère les signatures HMAC côté serveur (clé API jamais exposée au client)
- Utilise `crypto` Node.js pour HMAC-SHA256
- Forward les requêtes vers le backend avec signature
- **Sécurité** : La clé API reste côté serveur uniquement

### Hooks personnalisés

**`src/hooks/useAuth.ts`** :
- Hook `useAuth()` - Gère l'état d'authentification de l'utilisateur
- 3 états possibles : `loading`, `authenticated`, `unauthenticated`
- Vérifie automatiquement la session au chargement

## Intégration Backend

### Configuration

Le dashboard communique avec le backend Moddy via l'API `https://api.moddy.app`.

**Variables d'environnement (Vercel) :**

**Publiques** (préfixées par `VITE_`, exposées au client) :
- `VITE_API_URL` - URL de l'API backend (https://api.moddy.app)
- `VITE_DISCORD_CLIENT_ID` - ID client Discord OAuth

**Privées** (côté serveur uniquement, jamais exposées au client) :
- `API_URL` - URL de l'API backend (pour les serverless functions)
- `API_KEY` - Clé partagée pour signer les requêtes HMAC (⚠️ NE JAMAIS préfixer par `VITE_`)

### Authentification

Le système utilise :
- **Discord OAuth2** pour l'authentification
- **HMAC-SHA256** pour signer les requêtes API vers `/api/website/*`
- **Proxy Vercel** qui signe les requêtes côté serveur (la clé API n'est jamais exposée au client)
- **Cookies HTTP-only** (`moddy_session`) pour la gestion de session
- Le **backend gère la création des cookies**, le frontend ne fait que vérifier

### Flow d'authentification

1. User clique sur "Se connecter avec Discord"
2. Frontend → `POST /api/backend-proxy` (proxy Vercel)
3. Proxy Vercel → Signe la requête avec HMAC côté serveur
4. Proxy → `POST /api/website/auth/init` vers le backend Moddy
5. Backend → Retourne un `state` token
6. Frontend → Redirige vers Discord OAuth avec le `state`
7. Discord → User autorise l'application
8. Discord → Redirige vers le backend `/auth/discord/callback`
9. Backend → Crée la session et pose le cookie `moddy_session`
10. Backend → Redirige vers la page d'origine
11. Frontend → Vérifie la session avec `GET /auth/verify`

### Sécurité

- **Clé API jamais exposée** : La clé API reste côté serveur (proxy Vercel)
- **Signature HMAC côté serveur** : Les requêtes vers `/api/website/*` sont signées par le proxy
- **Cookies sécurisés** : `HttpOnly`, `Secure`, et `SameSite=Lax`
- **CORS strict** : Le backend n'accepte que les requêtes depuis `moddy.app`
- **Credentials include** : Le frontend utilise `credentials: 'include'` pour envoyer les cookies
- **Rate limiting** : Protection contre le spam (à implémenter côté backend)

## Statut du développement

### ✅ Actuellement implémenté
- Bibliothèque complète de composants shadcn/ui (13+ composants)
- Configuration Tailwind CSS avec design tokens
- Configuration ESLint pour la qualité du code
- TypeScript en mode strict
- Showcase de composants d'exemple
- **Intégration backend complète (HMAC, auth Discord, gestion de session)**
- **Hook useAuth pour la gestion d'état d'authentification**
- **Test de connexion au démarrage de l'application**

### 🚧 Prêt pour le développement
- Routing des pages et navigation
- Layouts de pages
- Logique de changement de thème
- Gestion et validation de formulaires
- Pages protégées nécessitant l'authentification

## Guidelines de développement

### Conventions de code

1. **TypeScript strict** : Toujours typer correctement, pas de `any`
2. **Composants fonctionnels** : Utiliser les functional components avec hooks
3. **Props interfaces** : Définir des interfaces pour toutes les props de composants
4. **CSS Modules** : Préférer Tailwind, éviter le CSS inline
5. **Imports** : Utiliser les alias `@/` pour les imports relatifs

### Ajout de nouveaux composants shadcn/ui

```bash
# Depuis le dossier /app
npx shadcn@latest add [component-name]
```

### Ajout de nouvelles pages

1. Créer le composant dans `src/pages/`
2. Configurer le routing (à venir)
3. Ajouter les layouts nécessaires dans `src/layouts/`

### Ajout de services API

1. Créer le service dans `src/services/`
2. Utiliser des hooks personnalisés pour la gestion d'état
3. Gérer les erreurs de manière cohérente

### Bonnes pratiques

- **Composition** : Composer les composants plutôt que créer des monolithes
- **Accessibilité** : Radix UI fournit l'accessibilité de base, la maintenir
- **Responsive** : Utiliser les breakpoints Tailwind (`sm:`, `md:`, `lg:`, etc.)
- **Performance** : Lazy loading pour les pages, memo pour les composants lourds
- **Tests** : À implémenter (React Testing Library recommandé)

## Intégration Git

### Workflow Git
- Branche principale : `main`
- Commits récents montrent l'ajout progressif de composants UI
- Messages de commit en français

### Commits récents
1. Documentation technique et instructions de build
2. Correction de la commande de démarrage
3. Ajout de composants UI (forms, input groups, selects)
4. Ajout du projet shadcn Vite de base
5. Ajout du sous-projet Vite

## Notes importantes pour Claude

### Documentation de session (OBLIGATOIRE)

**À la fin de chaque session de travail**, Claude doit créer un fichier de résumé dans `/docs/sessions/` :

**Format du nom de fichier** : `YYYY-MM-DD_nom-descriptif.md`

**Contenu requis** :
1. **Date et objectif** de la session
2. **Tâches accomplies** (liste détaillée)
3. **Fichiers créés/modifiés** avec leurs chemins complets
4. **Changements dans la structure** du projet
5. **Fonctionnalités ajoutées** avec explication technique
6. **Documentation technique** (flow, algorithmes, etc.)
7. **Technologies utilisées**
8. **Notes importantes** et décisions prises
9. **Problèmes rencontrés** et solutions
10. **Prochaines étapes** suggérées

**Exemple** : `/docs/sessions/2026-02-12_integration-backend.md`

Ce fichier sert de :
- Historique du développement
- Documentation pour les futures sessions
- Référence pour comprendre les décisions passées
- Guide pour reprendre le travail

### Lors de modifications de code

1. **Toujours lire les fichiers avant de les modifier**
2. **Respecter les patterns existants** (CVA pour les variantes, Radix UI pour l'accessibilité)
3. **Maintenir la cohérence TypeScript** (mode strict activé)
4. **Suivre la structure des dossiers** établie
5. **Utiliser les alias d'imports** (`@/components`, `@/lib`, etc.)
6. **Mettre à jour CLAUDE.md** si la structure ou les conventions changent

### Lors de l'ajout de fonctionnalités

1. Vérifier si un composant shadcn/ui existe déjà
2. Créer des composants réutilisables dans `components/`
3. Placer la logique métier dans `services/`
4. Créer des hooks personnalisés dans `hooks/` pour la logique réutilisable
5. Ajouter les pages dans `pages/`

### Styling

- Utiliser **Tailwind CSS** en priorité
- Utiliser les **variables CSS** définies dans `index.css` pour les couleurs
- Respecter le **design system** (palette de couleurs, espacements, etc.)
- Utiliser **CVA** pour les variantes de composants

### TypeScript

- Mode strict activé : tous les checks de type sont obligatoires
- Pas de variables ou paramètres non utilisés
- Toujours typer les props des composants
- Utiliser les types Radix UI fournis pour les composants UI

## Ressources

- [Documentation shadcn/ui](https://ui.shadcn.com)
- [Documentation Radix UI](https://www.radix-ui.com)
- [Documentation Tailwind CSS](https://tailwindcss.com)
- [Documentation Vite](https://vitejs.dev)
- [Documentation React](https://react.dev)

## Contact et licence

- **Créateur** : juthing
- **Licence** : CC BY-NC-SA 4.0 (Attribution - Pas d'utilisation commerciale - Partage dans les mêmes conditions)
- **Projet** : Non-commercial uniquement

---

*Dernière mise à jour : 2026-07-29*
