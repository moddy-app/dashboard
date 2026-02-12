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
│   │   ├── pages/         # Pages de l'application
│   │   │   ├── HomePage.tsx   # Page d'accueil (auth guard + redirect)
│   │   │   └── DebugPage.tsx  # Page de debug (/debug)
│   │   ├── layouts/       # Composants de mise en page (vide)
│   │   ├── hooks/         # Hooks React personnalisés (useAuth, etc.)
│   │   ├── services/      # Services API (prêt pour extension)
│   │   ├── lib/          # Fonctions utilitaires (auth, utils, preferences)
│   │   ├── locales/      # Fichiers de traduction i18n
│   │   │   ├── en/translation.json  # Traductions anglais
│   │   │   └── fr/translation.json  # Traductions français
│   │   ├── assets/       # Ressources statiques
│   │   ├── App.tsx       # Routeur principal (react-router-dom)
│   │   ├── main.tsx      # Point d'entrée React (BrowserRouter)
│   │   ├── i18n.ts       # Configuration react-i18next
│   │   └── index.css     # Styles globaux + design tokens
│   ├── public/           # Fichiers statiques publics
│   ├── .env.local        # Variables d'environnement (dev local uniquement)
│   ├── index.html        # Point d'entrée HTML
│   ├── package.json      # Dépendances et scripts
│   ├── vite.config.ts    # Configuration Vite
│   ├── components.json   # Configuration shadcn/ui
│   ├── eslint.config.js  # Configuration ESLint
│   ├── vercel.json       # Rewrites SPA pour Vercel
│   └── tsconfig.*.json   # Configurations TypeScript
├── vercel.json           # Rewrites SPA pour Vercel (racine)
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

### Routing
- **react-router-dom 7.13.0** - Routing côté client (SPA)

### Monitoring & Error Tracking
- **@sentry/react** - Capture et reporting d'erreurs en production (Sentry)

### Internationalisation (i18n)
- **react-i18next** - Intégration React pour i18next (hook `useTranslation`)
- **i18next** - Moteur de traduction (gestion des langues, interpolation, fallback)

### Autres dépendances
- **@base-ui/react 1.1.0** - Composants UI headless légers
- **@fontsource-variable/geist 5.2.8** - Police variable Geist (typographie moderne)
- **clsx 2.1.1** - Utilitaire pour classes conditionnelles

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
- **Police** : Geist Variable (sans-serif moderne et épurée de Vercel)

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

**`src/lib/preferences.ts`** :
- Fonction `getPreferences()` - Lit le cookie `moddy_preferences` et retourne un objet `UserPreferences`
- Fonction `setPreferences()` - Met à jour le cookie avec les nouvelles préférences (merge)
- Fonction `detectBrowserLanguage()` - Détecte la langue du navigateur parmi les langues supportées

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
- **Intégration backend complète (proxy Vercel sécurisé, auth Discord, gestion de session)**
- **Hook useAuth pour la gestion d'état d'authentification**
- **Récupération des informations complètes de l'utilisateur (avatar, email, etc.)**
- **Routing SPA avec react-router-dom** (`/` et `/debug`)
- **Auth guard sur la page d'accueil** (redirect vers `moddy.app/sign-in` si non connecté)
- **Sentry intégré** pour le suivi des erreurs en production (initialisé dans `main.tsx`)
- **Internationalisation (i18n)** avec react-i18next (EN par défaut, FR en fallback, sélecteur de langue dans `/debug`)
- **Page de debug complète** (`/debug`) avec 11 sections : auth, API ping, env, router, browser, performance, cookies, storage, live logs, Sentry, UI showcase
- **Configuration Vercel SPA** (rewrites pour éviter les 404 sur les routes client-side)

### 🚧 Prêt pour le développement
- Layouts de pages (sidebar, header, navigation)
- Logique de changement de thème
- Gestion et validation de formulaires
- Contenu du dashboard (pages fonctionnelles)

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
2. Ajouter la `<Route>` dans `src/App.tsx`
3. Ajouter les layouts nécessaires dans `src/layouts/`
4. **Obligatoire : supporter l'i18n** — Utiliser `useTranslation()` pour tous les textes affichés, ajouter les clés dans `locales/en/translation.json` et `locales/fr/translation.json`

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

## Routing

### Architecture
- **`main.tsx`** — `<BrowserRouter>` wrapping l'app
- **`App.tsx`** — `<Routes>` avec les routes définies
- **`vercel.json`** — Rewrites SPA (`/*` → `index.html`, `/api/*` → serverless)

### Routes actuelles
| Route | Page | Auth requise | Description |
|-------|------|-------------|-------------|
| `/` | `HomePage` | Oui (redirect vers `moddy.app/sign-in`) | Page d'accueil du dashboard |
| `/debug` | `DebugPage` | Non | Panneau de debug complet |

### Auth Guard
La page d'accueil vérifie l'authentification :
- **Loading** → Spinner centré
- **Non connecté** → Redirect vers `https://moddy.app/sign-in?url=<URL actuelle encodée>`
- **Connecté** → Affiche le contenu de la page

## Monitoring & Error Tracking (Sentry)

### Configuration
- **SDK** : `@sentry/react`
- **Initialisation** : Dans `main.tsx`, avant le rendu de l'app
- **DSN** : Configuré en dur (projet Sentry dédié au dashboard Moddy)
- **PII** : `sendDefaultPii: true` (collecte les IP et données utilisateur par défaut)

### Fonctionnement
- Sentry capture automatiquement les erreurs JavaScript non gérées
- Les erreurs sont envoyées au projet Sentry sur `o4510617959202816.ingest.de.sentry.io`
- La DebugPage (`/debug`) contient une section "Sentry Error Tracking" avec :
  - Affichage du DSN et du statut d'initialisation
  - Bouton "Throw Test Error" pour tester la capture d'erreurs
  - Bouton "Send Test Message" pour envoyer un message de test via `Sentry.captureMessage()`

## Internationalisation (i18n)

### Configuration
- **Moteur** : i18next + react-i18next
- **Fichier de config** : `src/i18n.ts` (importé dans `main.tsx` avant le render)
- **Langue de secours** : `en` (anglais)
- **Détection auto** : détecte la langue du navigateur (`navigator.languages`)
- **Cookie de préférences** : `moddy_preferences` (JSON, 1 an, extensible pour futur dark mode etc.)
- **Interpolation** : `escapeValue: false` (React gère l'échappement)

### Logique de résolution de la langue
1. Si le cookie `moddy_preferences` contient une clé `language` → utilise cette langue
2. Sinon, détecte la langue du navigateur parmi les langues supportées (en, fr)
3. Si aucune langue supportée n'est détectée → fallback `en`

### Cookie `moddy_preferences`
- **Format** : JSON encodé (`{ "language": "fr" }`)
- **Durée** : 1 an (`max-age=31536000`)
- **Attributs** : `path=/; SameSite=Lax`
- **Extensible** : prévu pour accueillir d'autres préférences (ex: `theme: "dark"`)
- **Mode Auto** : si l'utilisateur choisit "Auto", la clé `language` est supprimée du cookie
- **Utilitaires** : `src/lib/preferences.ts` (`getPreferences()`, `setPreferences()`, `detectBrowserLanguage()`)

### Structure des traductions
```
src/locales/
├── en/translation.json   # Textes anglais (source)
└── fr/translation.json   # Textes français
```

Les clés sont organisées par page/section :
- `home.*` — Page d'accueil
- `debug.*` — Page de debug (auth, api, router, browser, performance, cookies, storage, logs, sentry, components)
- `common.*` — Textes communs (yes, no, empty, clear)

### Utilisation dans les composants
```tsx
import { useTranslation } from 'react-i18next'

const { t, i18n } = useTranslation()

// Traduction simple
<p>{t('home.loggedIn')}</p>

// Avec interpolation
<p>{t('debug.auth.id', { id: userId })}</p>
<p>{t('debug.storage.localStorage', { count: 5 })}</p>

// Changer la langue
i18n.changeLanguage('fr')
```

### Fichiers traduits
- `HomePage.tsx` — 3 textes traduits
- `DebugPage.tsx` — ~60 textes traduits + sélecteur de langue Auto/EN/FR avec persistance cookie

### Fichiers exclus de la traduction
- `component-example.tsx` — Textes de démonstration (showcase), restent en anglais
- `auth.ts` / `useAuth.ts` — Logs console développeur, restent en anglais

### Conventions i18n
1. **Clés en camelCase** organisées par page puis par section
2. **Interpolation** avec double accolades : `{{variable}}`
3. **Hook `useTranslation()`** dans chaque composant qui affiche du texte
4. **Pas de traduction des logs console** (messages développeur)
5. **Ajouter les nouvelles clés** dans les deux fichiers JSON (en + fr) simultanément

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

*Dernière mise à jour : 2026-02-12 (ajout i18n react-i18next)*
