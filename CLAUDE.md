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
│   │   │   ├── HomePage.tsx      # Page d'accueil (auth guard + redirect → DashboardPage)
│   │   │   ├── DashboardPage.tsx # Dashboard principal (sidebar + breadcrumb + command menu)
│   │   │   └── DebugPage.tsx     # Page de debug (/debug)
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
│   │   ├── fonts.css     # @font-face Google Sans (auto-généré, ne pas éditer)
│   │   └── index.css     # Styles globaux + design tokens
│   ├── public/           # Fichiers statiques publics
│   │   └── fonts/        # Google Sans woff2 (56 fichiers, self-hostés)
│   ├── .env.local        # Variables d'environnement (dev local uniquement)
│   ├── index.html        # Point d'entrée HTML
│   ├── package.json      # Dépendances et scripts
│   ├── vite.config.ts    # Configuration Vite
│   ├── components.json   # Configuration shadcn/ui
│   ├── eslint.config.js  # Configuration ESLint
│   ├── vercel.json       # Rewrites SPA pour Vercel
│   └── tsconfig.*.json   # Configurations TypeScript
├── vercel.json           # Rewrites SPA pour Vercel (racine)
├── scripts/              # Outillage de build
│   └── build-fonts.py    # Génère les woff2 Google Sans depuis les TTF sources
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
- **Google Sans** - Police self-hostée en woff2 (voir la section Typographie), sans dépendance npm
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
- **Police** : **Google Sans** (self-hostée, aucun CDN)
- **Graisses réelles** : 400 (regular), 500 (medium), 600 (semibold), 700 (bold) + les 4 italiques correspondantes — pas de gras synthétique
- **Convention** : le 600 sert de graisse « gras » par défaut (`font-semibold`), le 700 (`font-bold`) est réservé aux usages plus marqués — le vrai 700 de Google Sans est visuellement lourd en inline
- **Mono** : pas de Google Sans Mono fournie → `--font-mono` pointe vers la stack monospace système (`ui-monospace`, SF Mono, Menlo, Consolas…)

#### Intégration (self-host, façon shadcn/ui)

1. **Fichiers locaux** — `app/public/fonts/google-sans-*.woff2`, jamais de `<link>` vers `fonts.googleapis.com` ni de `@fontsource-*`.
2. **Découpage par plage Unicode** — chaque face est découpée en 7 sous-ensembles (`latin`, `latin-ext`, `greek`, `greek-ext`, `cyrillic`, `cyrillic-ext`, `vietnamese`), exactement comme les feuilles servies par Google Fonts. Soit 8 faces × 7 plages = **56 fichiers, ~716 Ko sur disque**, mais le navigateur ne télécharge que ce qu'il rend réellement (~100 Ko en pratique : latin 400/500/600/700). La couverture cyrillique / grecque reste disponible pour les pseudos Discord non latins.
3. **`@font-face` générés** — `app/src/fonts.css` (56 blocs avec `font-display: swap` + `unicode-range`), importé par `index.css`. **Fichier auto-généré, ne pas éditer à la main.**

#### Polices des « name styles » Discord

Deux familles de polices supplémentaires vivent hors de la typographie du dashboard,
uniquement pour reproduire l'affichage de Discord dans le module Bot Customization :

- **`gg sans`** (`app/public/fonts/gg-sans/`, 4 graisses, ~153 Ko) — la police de
  Discord, passée open source. Elle n'est utilisée **que** sur les surfaces qui
  imitent Discord — la carte d'aperçu du profil (`.dpp-scope`) et les « name
  styles » (`--dns-ui-font`) — jamais dans le châssis du dashboard : sur Discord
  il n'y a pas de Google Sans, l'aperçu doit donc être en `gg sans`, y compris le
  pseudo. C'est désormais une règle de design, plus une contrainte de licence.
  `.dpp-scope` pose `font-family: var(--font-primary)` pour que les nœuds sans
  classe typographique (étiquette APP, initiales de repli) en héritent aussi,
  comme le `<body>` de Discord le fait.
- **Les 7 polices de « name styles »** (`app/public/fonts/name-styles/`), décrites
  ci-dessous.

Sept polices supplémentaires vivent dans `app/public/fonts/name-styles/`. Elles n'ont
**rien à voir avec la typographie du dashboard** : elles ne servent qu'à rendre le style
de pseudo Discord dans le module Bot Customization (voir la section dédiée). Familles
namespacées `DNS <x>` pour ne pas polluer l'espace de noms global, `@font-face` déclarés
dans `app/src/styles/discord-name-styles.css`, jamais préchargées. Sous-ensembles latins
uniquement (U+0020–U+0237) : ni cyrillique, ni grec, ni CJK — d'où la pile de repli vers
`--dns-ui-font` (Google Sans), à conserver.

> ⚠️ **Ajouter un caractère hors des plages = fallback système silencieux.** Un codépoint présent dans la police mais couvert par aucun `unicode-range` ne sera jamais téléchargé : il s'affichera dans la police système, au milieu d'un texte en Google Sans. C'est ce qui est arrivé aux flèches `→` / `←` (la plage `latin` de Google ne contient que `U+2191`/`U+2193`, elle a été élargie à `U+2190-2193`). Avant d'introduire un caractère non-ASCII dans l'UI, vérifier qu'il tombe dans une plage déclarée.
>
> Les scripts non couverts par le découpage Google Fonts (hébreu, arménien, géorgien, thaï, indiens, éthiopien, khmer) tombent volontairement en fallback système, comme c'était déjà le cas avec Inter/Geist.
4. **Branchement sur les tokens** — `--font-sans` / `--font-mono` sont redéfinis dans le bloc `@theme inline` de `index.css`, donc **tous** les composants shadcn héritent automatiquement via `font-sans` / `font-mono`, sans toucher un seul composant. Fallback système solide tant que la police n'a pas chargé.
5. **Preload ciblé** — `app/index.html` précharge uniquement `google-sans-400-latin.woff2` et `google-sans-600-latin.woff2` (les deux graisses au-dessus de la ligne de flottaison). Le reste se charge à la demande.

#### Régénérer les woff2

Les TTF sources ne sont pas versionnés. Pour régénérer les fichiers :

```bash
pip install fonttools brotli
python3 scripts/build-fonts.py <dossier-contenant-les-ttf>
```

Le script écrit dans `app/public/fonts/`. Si la liste des faces change, régénérer aussi `app/src/fonts.css` en conséquence.

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

**Composants disponibles** (22 composants) :
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
- `sidebar.tsx` - Sidebar responsive avec collapse/expand (SidebarProvider, Sidebar, SidebarTrigger, etc.)
- `breadcrumb.tsx` - Fil d'Ariane (Breadcrumb, BreadcrumbItem, BreadcrumbLink, etc.)
- `command.tsx` - Palette de commandes (Command, CommandDialog, CommandInput, etc.)
- `collapsible.tsx` - Sections collapsibles (Collapsible, CollapsibleTrigger, CollapsibleContent)
- `avatar.tsx` - Avatars avec fallback (Avatar, AvatarImage, AvatarFallback)
- `tooltip.tsx` - Infobulles (Tooltip, TooltipContent, TooltipProvider, TooltipTrigger)
- `dialog.tsx` - Dialogues modaux (Dialog, DialogContent, DialogHeader, etc.)
- `skeleton.tsx` - Squelettes de chargement
- `sheet.tsx` - Panneaux latéraux (Sheet, SheetContent, etc.)
- `drawer.tsx` - Panneaux tiroirs (Drawer, DrawerContent, DrawerHeader, DrawerFooter, etc.) — via vaul
- `context-menu.tsx` - Menu contextuel (clic droit) — Radix ContextMenu
- `checkbox.tsx` - Case à cocher — Radix Checkbox

### Composants métier (dans `/app/src/components/`)

- `app-sidebar.tsx` - Sidebar principale de l'application (assemble team-switcher, nav-main, nav-projects, nav-user)
- `team-switcher.tsx` - Sélecteur de serveur/équipe dans la sidebar
- `nav-main.tsx` - Navigation principale avec sous-menus collapsibles
- `nav-projects.tsx` - Navigation des projets/raccourcis
- `nav-user.tsx` - Profil utilisateur en bas de la sidebar (avec dropdown : command menu, account, logout, notifications)
- `command-menu.tsx` - Palette de commandes globale (⌘K)
- `notification-drawer.tsx` - Panneau de notifications responsive (Dialog sur desktop, Drawer sur mobile)
- `theme-provider.tsx` - Provider de thème (dark/light/system) avec persistance dans le cookie `moddy_preferences`

### Types et données (dans `/app/src/types/` et `/app/src/data/`)

- `types/notification.ts` - Types TypeScript : `Notification`, `NotificationCriticality`, `NotificationAction`, `NotificationSender`
- `data/notifications.ts` - Données d'exemple de notifications (à remplacer par l'API backend)

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

**`src/hooks/use-media-query.ts`** :
- Hook `useMediaQuery(query)` - Réagit aux media queries CSS (SSR-safe)
- Utilisé par `notification-drawer.tsx` pour le comportement responsive Dialog/Drawer

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
- Bibliothèque complète de composants shadcn/ui (21+ composants)
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

- **Layout dashboard avec sidebar** (AppSidebar, TeamSwitcher, NavMain, NavProjects, NavUser)
- **Palette de commandes** (CommandMenu, raccourci ⌘K)
- **TooltipProvider** wrappant l'app dans `main.tsx`
- **Système de notifications** (NotificationDrawer responsive, types, données exemple, hook use-media-query)
- **Dark mode** (ThemeProvider, cookie `moddy_preferences.theme`, sélecteur dans `/debug`)
- **Module Welcome Messages** (`/servers/:guildId/modules/welcome_channel`) — config **v2** : liste de jusqu'à 5 messages de bienvenue indépendants (un par salon), **plus aucun embed Discord** (Container Components V2 : texte + barre d'accent). Flow liste + add/manage façon Social Notifications, **écriture immédiate** (chaque action renvoie la liste complète via PUT ; liste vidée = DELETE). Pas de clé `enabled` à la racine — le module est actif si au moins un message est activé et rattaché à un salon (`isWelcomeActive`). Ids `wm_xxxxxxxx` générés côté client (jamais réutilisés), snowflakes gardés en chaînes, couleur d'accent hex ↔ entier décimal. Helpers dans `src/lib/welcome.ts`, types dans `src/types/api.ts`, page `src/pages/modules/WelcomeChannelPage.tsx`.
- **Module Social Notifications** (`/servers/:guildId/modules/social_notifications`) — abonnements YouTube/Twitch/Bluesky/RSS (Instagram réservé) : liste, ajout (résolution synchrone via le bot), édition (PATCH partiel), pause/reprise, suppression, quota par plateforme (1 free / 5 premium), éditeur de message avec cheat-sheet de placeholders, couleur d'embed (marque ou custom), toggles avatar/média conditionnels. Métadonnées plateformes dans `src/lib/social-platforms.ts`, services dans `src/services/guilds.ts`.
- **Module Automod IA** (`/servers/:guildId/modules/automod_ai`) — modération IA de contenu : interrupteur principal, salon d'alertes, sévérité 1–5, plafond de sanction (warn/mute/ban), langue, mode simulation (`dry_run`), indications serveur (≤ 3000 car.) avec **contrôle anti-injection debouncé** (`POST /indications/check`), détecteurs rendus **génériquement** depuis la map `features` (exemptions rôles/salons, max 25). Le badge d'état et les avertissements viennent de `GET /status` (`running` ≠ `enabled`), rappelé après chaque sauvegarde. Le PUT envoie l'**objet complet dérivé de celui reçu** (préserve `categories_desactivees`, champ ops sans UI). Snowflakes gardés en chaînes. Budget IA quotidien réservé au staff → onglet `/staff?tab=automod_budget` (`src/components/automod/automod-budget-panel.tsx`). Types dans `src/types/api.ts`, service `src/services/automod.ts`, page `src/pages/modules/AutomodAiPage.tsx`.
- **Système Cases / Modération** — nouveau modèle (case + sanctions + events + appeals) remplaçant l'ancien `ModerationCase`. Trois vues partageant **une vue détail unifiée** (design continu façon tickets Linear) : personnelle (accessible via le menu utilisateur → `/cases`), serveur (`/servers/:guildId/cases`), staff (onglet Cases, recherche libre sur toutes les cases). Liste : barre de recherche serveur (`?q=`), boutons icône (rafraîchir / filtres / sélection multiple) + tooltips, **filtres en chips bleus** (utilisateur, auteur, statut, sanction, date) modèle/helpers dans `case-filters.ts` et UI dans `case-filter-bar.tsx`, **scroll infini**, **menu contextuel** (clic droit), **sélection de masse** avec actions groupées (confirmation destructive). Détail : infos évidentes masquées selon le contexte (`showSubject`/`showType`/`showScope`), **section Preuves** dédiée (`case-evidence.tsx`, `GET /cases/{id}/evidence` + automod), panneaux normalisés sans séparateurs, boutons « copier ». Timeline mêlant commentaires (`Message`/`Bubble`) et historique d'actions (`Marker`), preuves exclues. Formulaires pilotés par `GET /cases/meta`. Écriture réservée au staff modérateur sur les cases `global`/`network`. Types `src/types/cases.ts`, service `src/services/cases.ts`, helpers `src/lib/cases.ts`, composants `src/components/cases/`, profils Discord via `src/hooks/useProfile.ts`.

- **Sanctions globales & page `/violations`** — une sanction globale vise un **utilisateur** ou un **serveur** et se résout en un niveau (`none` < `warn` < `limited` < `suspended`). Le niveau qui s'applique à une action dans un serveur est **le plus sévère des deux**. Les verrous d'UI se testent sur le drapeau **`restricted`** (vrai pour `limited` *et* `suspended`), jamais sur `level === 'limited'` : premium (souscrire / lier un serveur), activation d'un module **jamais configuré** (un module en place reste pleinement modifiable, sous-ressources comprises), écriture sur `automod_ai` (qui suit le **serveur**, pas l'utilisateur), et serveurs `suspended` désactivés dans le sélecteur. Un `warn` ne verrouille **rien** et n'affiche aucun bandeau ; le **staff n'est jamais bloqué** (l'API ne le bloque pas non plus). Statut amorcé sur `sanction` de `GET /auth/me`, complété par `GET /violations/status` (cache 60 s, aligné sur le back-end) et par `GET /violations` — un seul appel qui donne le niveau de chaque serveur. Les `403` de sanction se reconnaissent à leur champ `error` **objet** (les autres gardent `{"error": "message"}`) : `asSanctionError()` les normalise, `showSanctionToast()` les rend via `violations.errors.<code>` (jamais le code nu) et déclenche une resynchronisation du statut. Un compte **suspendu** ne voit pas un dashboard grisé mais `SuspendedScreen`, substitué avant même le montage de `GuildProvider`. Page `/violations` : l'unité d'affichage est le **groupe**, jamais la case (une infraction peut viser le compte ET ses serveurs). `enforcement.premium` + `status: pending` = résiliation **sans remboursement** à l'échéance — c'est l'information mise en avant. Aucun endpoint d'appel : les appels sont traités par un humain sur le **serveur de support** (redirection vers `moddy.app/support`), sans rien promettre d'automatique. **Les vues d'infractions sont celles des `cases`, pas les leurs** : `ViolationList` reprend le gabarit de `case-list.tsx` (conteneur `divide-y rounded-xl border`, pastille d'état, méta ponctuée de points, chips + date à droite) et `ViolationDetailView` celui de `case-detail.tsx` (retour + référence + pastille, titre pleine largeur, deux colonnes dont un aside de `PropRow`) — en lecture seule, une infraction ne se modifie pas depuis le dashboard. **Une case `global`/`network` EST une sanction globale** et doit se lire pareil des deux côtés : `lib/cases.ts` porte `isGlobalCaseType()`, `actionLabelKey()` (libellé — « suspension » et non « bannir ») et `actionAppearance()` (ton + icône **du niveau** — une limitation est orange comme « limité », pas violette comme un `restrict` de serveur). `ActionChip` les consomme, donc `case-list`, `case-detail`, `sanctions-panel` et `case-timeline` reçoivent le `caseType` et `GlobalActionChip` n'est qu'`ActionChip` figée sur `global`. Les couleurs viennent de la **même source** : `SANCTION_LEVEL_HUE`/`SANCTION_LEVEL_ICON` vivent dans `lib/cases.ts` (ton `emerald` ajouté pour le niveau sain) et `LEVEL_TONE` en dérive. **Un groupe peut mélanger les niveaux** (avertissement au compte, limitation sur un serveur, suspension sur un autre) : `group.level` n'est qu'un résumé — le plus sévère —, jamais ce qui s'applique à un sujet ; la vue détail affiche le niveau **de chaque sujet** via `levelFromActions()`, et l'écran de suspension montre les mesures visant **le compte** (`/violations/status` filtré par `group_id`) plus une ligne « vise aussi N de vos serveurs ». La ligne de liste annonce ses sujets (« Vise votre compte, Serveur A »), le compte connecté se dit toujours « votre compte » et jamais son pseudo, et la vue détail dit **par qui** la sanction a été prononcée. Les surfaces périphériques réutilisent les mêmes composants — `LevelPill` (sélection de serveurs, seulement si `restricted` : un `warn` ne verrouille rien), `LevelDot` (sélecteur), `ReferenceText` (bandeau) — au lieu de badges recopiés en dur. Le vocabulaire est celui de l'utilisateur, jamais celui du back-office : pas de « dossier » ni de « case » à l'écran, une sanction `ban` s'appelle une **suspension** (`restrict` → « limitation »), `revoked` se dit « levée », et « faire appel » se dit « contester ». Chaque écran rappelle qu'une sanction globale punit un **manquement aux Conditions d'utilisation** et pointe vers `TERMS_URL`. Une référence (`WUD2EW`) se lit **en texte courant**, sans bouton de copie ni monospace (`ReferenceText`) — contrairement aux `cases`, où l'ID s'utilise vraiment. `EnforcementNotice` prend un drapeau `active` : sur une infraction levée il ne rend **rien** (« contestation en cours d'examen » n'a aucun sens quand la sanction n'existe plus). Un verrou de souscription ne se grise pas, il **disparaît** : sous sanction, l'entrée Moddy Max de la sidebar, la carte premium de la vue serveur et le sélecteur « ajouter un serveur » ne sont pas rendus — mais un abonnement déjà payé garde son entrée « Gérer l'abonnement » (tester `is_active` la ferait disparaître, la sanction le mettant à `false`). Rien n'est dit deux fois : le motif n'est écrit **qu'une** fois par écran (la liste de l'écran de suspension ne montre que les sanctions passées), une ligne de liste porte la pastille de niveau *ou* des chips de mesure mais jamais les deux (le niveau résume les mesures actives), la vue détail n'a **pas d'aside** (celui de `case-detail` a de quoi le remplir, une infraction n'a que ses sujets et ses mesures, déjà au centre), « en vigueur » ne s'affiche pas (c'est l'état par défaut — seuls « levée » et « expirée » se disent), et `EnforcementNotice` passe en `variant="inline"` dans un panneau plutôt que d'y empiler un cadre dans un cadre. `SanctionScale` (`src/components/violations/sanction-scale.tsx`) situe le compte sur les quatre paliers, bornée à `max-w-xl` ; elle est partagée par `/violations` (dans le bloc unique « état du compte », qui remplace le duo bandeau + carte) et l'écran de suspension. Ce dernier suit l'ordre des questions qu'on se pose — qu'est-ce qui m'arrive, pourquoi, jusqu'à quand, comment contester — et relègue le reste en périphérie : historique en fin de page, **facturation** en simple bouton de pied de page (`POST /stripe/portal` n'est bloqué par aucune sanction — une sanction ne gèle pas l'argent ; `GET /stripe/subscription` ne sert qu'à masquer la section quand il répond qu'il n'y a rien à gérer, jamais à la conditionner) et dossier en deux sections repliables. L'écran de suspension liste ses infractions **en cours** et **passées** avec le même `ViolationList` — aucune présentation à part pour les actives ; le repli (statut sans réponse de `/violations`) se construit en `ViolationGroup` minimal plutôt que de bifurquer sur une carte différente. Le compte à rebours ne s'affiche que dans la **vue détail** (au clic sur une infraction) — jamais sur l'écran principal, dont le rôle est de faire agir (les deux boutons de recours), pas de répéter ce que le détail dit déjà. Sous suspension, les profils se résolvent quand même : `useProfile` tente `GET /users/{id}/profile` puis retombe sur `GET /users/{id}` (**public**, sans authentification) ; idem `GET /guilds/{id}/profile` → `GET /guilds/{id}` (droits d'admin requis mais plus bloqué par une suspension). Sans ce repli, un compte suspendu ne verrait que des snowflakes là où l'écran parle de lui et de ses serveurs. Types `src/types/violations.ts`, helpers `src/lib/sanctions.ts`, service `src/services/violations.ts`, contexte `src/contexts/SanctionContext.tsx`, composants `src/components/violations/`, pages `src/pages/ViolationsPage.tsx` et `src/pages/SuspendedPage.tsx`, logotype `src/components/moddy-logo.tsx`.

- **Module Bot Customization** (`/servers/:guildId/modules/bot_customization`) — apparence de Moddy dans la guilde : pseudo, bio, avatar, bannière (**premium**) + style du pseudo police/effet/couleurs (**toujours**). Formulaire **piloté par `limits`** (longueurs, types et taille d'image, `font_ids`, `effect_ids`, `gradient_effect_id`) : rien n'est codé en dur. Écriture en **diff strict** (clé absente = inchangé, `null` = reset) — jamais de sérialisation complète du formulaire. Sur une guilde qui n'a **jamais** configuré de style, `styleToDraft()` **amorce** le brouillon sur le style global du bot (pop, `#1C98EB`, identifiant relu depuis `limits.effect_ids`) : le menu déroulant ouvre donc sur Pop. L'amorce passe des deux côtés du diff, donc un formulaire non touché n'est pas « modifié ». Symétriquement, « Aucun effet » est *vraiment* aucun effet : il vide aussi les couleurs et se sérialise en `style: null`, et l'aperçu ne retombe plus sur un style de secours — il rend exactement l'état du formulaire. Images uploadées **au moment du save** (`POST .../uploads`, URL valable 15 min), aperçu local via `URL.createObjectURL`. Sans premium, les champs premium sont verrouillés avec CTA mais leur **réinitialisation reste permise**. Bio = partie serveur seule (≤ `bio_max_length`) ; `bio_attribution` affichée en aperçu non éditable (emoji animé + gras rendus) **uniquement quand une bio de serveur est saisie** — le bot n'appose l'attribution que sur ce qu'il écrit, une bio héritée du profil global n'en porte pas, donc l'aperçu la tait dès qu'il retombe sur le global. Erreurs : `{"error": "<code>"}` mappé sur `modules.bot_customization.errors.<code>` (jamais le code nu) ; **`bot_timeout` (504) n'est jamais rejoué**. `updated_by` reste une chaîne (profil via `useUserProfile`). Types dans `src/types/api.ts`, helpers `src/lib/bot-customization.ts`, service `src/services/bot-customization.ts`, page `src/pages/modules/BotCustomizationPage.tsx`.

- **Rendu des « name styles » Discord** — l'aperçu du style de pseudo utilise le **vrai moteur de rendu Discord** (CSS + 7 polices extraits du build web d'août 2026), pas une approximation. CSS repris tel quel dans `src/styles/discord-name-styles.css` (importé par `index.css`) : **ne pas le « nettoyer »**, chaque marge négative et chaque keyframe vient du CSS réel. Trois adaptations Moddy seulement (familles namespacées `DNS <x>`, `url()` vers `/fonts/name-styles/`, `gg sans` servie via `--dns-ui-font` depuis `/fonts/gg-sans/`), **plus une correction** : `pop` dimensionne sa copie colorée à `width: calc(100% - stroke)`, soit 2 px de moins que le texte. Chez Discord le popout est large, ça ne se voit pas ; ici la boîte est toujours ajustée au texte (ligne de pseudo en flex, option de `Select`), donc `overflow: hidden` rognait la copie — dernière lettre renvoyée à la ligne et coupée en `wrap` (l'effet manquait sur le « y » de Moddy), ellipse en `nowrap`. Les 2 px sont rendus en `padding-inline-end` et repris en marge négative : la boîte peinte s'élargit, la mise en page ne bouge pas. **Deuxième correction** : `.dns-animated.dns-loop > *` ne pèse que deux classes (`*` n'ajoute rien), soit le poids de `.dns-animated .dns--pop` qui suit et dont la propriété raccourcie `animation` remet le compteur à 1 — à spécificité égale l'ordre tranche, donc les effets ne jouaient qu'une fois. La règle est réaffirmée après les règles d'animation. Pas d'`animation-delay` : il ne vaudrait que pour le premier passage ; la pause entre deux boucles (~2 s) est déjà dans les keyframes, qui tiennent l'effet immobile sur la seconde moitié du cycle. Discord ne transmet qu'**une couleur de base** : les 6 autres variables (`--dns-light-1`, `--dns-dark-2`, `--dns-toon-stroke-color`, `--dns-neon-stroke`…) sont dérivées en HSL par `derivePalette()` (`src/lib/discord-name-styles.ts`) — formules recalées sur 4 palettes réelles, 24 valeurs sur 24 exactes. Le dégradé est le seul effet qui n'utilise **pas** la palette dérivée (deux arrêts explicites). La correspondance `font_id`/`effect_id` → classe CSS est **isolée dans deux tables** (`FONT_ID_TO_SLUG`, `EFFECT_ID_TO_SLUG`) : c'est le seul endroit du code qui connaît les identifiants, un id inconnu retombe silencieusement sur `default`/`solid`. Le dégradé est relu depuis `limits.gradient_effect_id`, jamais codé en dur. Composants `src/components/name-style-preview.tsx` (`NameStylePreview` par slugs, `NameStyleFromIds` par identifiants d'API). `data-dns-text` doit rester **strictement identique** au contenu du span (effets `toon` et `pop` dupliquent le texte dans un `::before`).

- **Aperçu du profil Discord** (module Bot Customization) — l'aperçu n'est plus une carte maison : c'est le **vrai popout de profil Discord**, CSS et polices repris du DOM du client web (août 2026). `src/styles/discord-profile.css` contient les règles Discord **verbatim**, noms de classes hachés compris (`.outer_c0bea0`, `.body__5be3e`, `.displayNameRow__26b1f`…) — `src/components/discord-profile-preview.tsx` reproduit l'arbre DOM et s'aligne sur ces classes, il ne décide d'aucun style. **Trois adaptations seulement**, listées en tête du CSS : `gg sans` self-hostée au lieu d'être en base64, le bloc de variables déplacé de `:root` vers `.dpp-scope` (Discord y définit `--radius-lg`, `--text-default`, `--font-primary`… qui écraseraient les tokens du dashboard), et un bloc `.theme-light` — **seule invention du fichier**, le dump n'ayant été capturé qu'en « midnight » ; il réutilise l'échelle `--neutral-*` en miroir. Le thème suit celui du dashboard via la classe `theme-dark`/`theme-light` sur la carte, c'est-à-dire le mécanisme de Discord lui-même. Les additions Moddy sont regroupées en fin de fichier et se limitent à `font-family: var(--font-primary)` sur `.dpp-scope` (Discord pose `gg sans` sur son `<body>` : sans cette règle, les nœuds sans classe typographique — étiquette APP, initiales de repli — retombaient sur Google Sans au milieu d'une carte en `gg sans`), à des replis (pas d'avatar, pas d'icône de serveur) et au déclampage de la bio. ⚠️ Les variables de découpe de la bannière (`--custom-cutout-*`) sont posées **en style inline** sur `.fill_b83360`, comme chez Discord : sans elles le `mask-image` est invalide et la bannière passe derrière l'avatar.

- **Profil global du bot** (`GET /bot/profile`) — profil Discord **global** de l'application (avatar, bannière, `accent_color`, bio, username), à ne pas confondre avec le module `bot_customization` qui personnalise le bot **par guilde**. Sert de **valeur de repli à chaque champ vide** de l'aperçu, exactement comme Discord affiche le profil global là où aucune personnalisation de guilde ne s'applique. `bio` peut être `null` (RPC Discord best-effort). Service `src/services/bot.ts`, hook `src/hooks/useBotProfile.ts` (cache module, une requête par session, échec silencieux — l'aperçu doit rester utilisable sans).

- **Markdown Discord** (`src/components/discord-markup.tsx`) — rendu du markdown des bios : gras, italique, souligné, barré, spoiler, code inline et bloc, citations, titres `#`/`##`/`###`, petit texte `-#`, liens `[texte](url)`, liens nus et émojis custom. ⚠️ Le parseur est **récursif** : les `RegExp` globales sont instanciées à chaque appel, jamais partagées au niveau module — un `lastIndex` écrasé par un appel imbriqué produit une boucle infinie qui fait planter l'onglet.

### 🚧 Prêt pour le développement
- Gestion et validation de formulaires
- Contenu du dashboard (pages fonctionnelles, remplir les placeholders)

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
| `/` | `HomePage` → `DashboardPage` | Oui (redirect vers `moddy.app/sign-in`) | Dashboard avec sidebar, breadcrumb et command menu |
| `/violations` | `ViolationsPage` | Oui | Infractions & sanctions globales (compte + serveurs) |
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
- **Cookie de préférences** : `moddy_preferences` (JSON, 1 an, contient `language` et `theme`)
- **Interpolation** : `escapeValue: false` (React gère l'échappement)

### Logique de résolution de la langue
1. Si le cookie `moddy_preferences` contient une clé `language` → utilise cette langue
2. Sinon, détecte la langue du navigateur parmi les langues supportées (en, fr)
3. Si aucune langue supportée n'est détectée → fallback `en`

### Cookie `moddy_preferences`
- **Format** : JSON encodé (`{ "language": "fr" }`)
- **Durée** : 1 an (`max-age=31536000`)
- **Attributs** : `path=/; SameSite=Lax`
- **Clés** : `language` (langue) et `theme` (`"light"` | `"dark"` | absent = system)
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

*Dernière mise à jour : 2026-08-16 (refonte de l'écran de suspension)*
