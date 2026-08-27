# Session 2026-04-17 — Intégration complète du backend Moddy

## Objectif
Intégrer toutes les fonctionnalités du backend dans le frontend : couche service, routing, pages par serveur, configuration des modules, panel staff, et améliorations UI demandées par l'utilisateur.

---

## Tâches accomplies

### 1. Couche service et types TypeScript
- **`src/types/api.ts`** — Types complets : `GuildListItem`, `GuildDetail`, `Channel`, `Role`, `GuildStats`, configs de tous les modules (`StarboardConfig`, `WelcomeChannelConfig`, `WelcomeDmConfig`, `AutoRoleConfig`, `AutoRestoreRolesConfig`, `InterserverConfig`, `LoggingConfig`), types staff (`GlobalStats`, `UserFullProfile`, `ModerationCase`, `BotStatus`).
- **`src/services/guilds.ts`** — Tous les appels API guilds/modules/logging/stripe avec typage fort.
- **`src/services/staff.ts`** — Appels API staff avec guard `requireStaff`.

### 2. State management — GuildContext
- **`src/contexts/GuildContext.tsx`** — Context React pour le serveur sélectionné, chargement automatique des données (guild, channels, roles, modules, stats) en parallèle via `Promise.all`.
- Synchronisation avec l'URL (`/servers/:guildId`).
- Actions exposées : `selectGuild`, `refreshGuildData`, `updateModule`, `disableModule`.

### 3. Routing imbriqué (react-router-dom v7)
- **`App.tsx`** — Routes imbriquées sous `HomePage` (auth guard) :
  - `/` → `GuildSelectionView`
  - `/servers/:guildId` → `GuildOverviewPage`
  - `/servers/:guildId/modules/starboard` → `StarboardPage`
  - `/servers/:guildId/modules/welcome_channel` → `WelcomeChannelPage`
  - `/servers/:guildId/modules/auto_role` → `AutoRolePage`
  - `/servers/:guildId/modules/logging` → `LoggingPage`
  - `/staff` → `StaffPage` (conditionné sur `is_staff`)
- **`DashboardPage.tsx`** — Refactorisé en layout avec `<Outlet>` + breadcrumb dynamique.
- **`HomePage.tsx`** — Auth guard + fourniture du `GuildProvider`.

### 4. Composants sidebar mis à jour
- **`TeamSwitcher`** — Vrais guilds avec avatars Discord CDN, indicateur du serveur actif, bouton refresh.
- **`AppSidebar`** — Navigation dynamique : items de modules quand un guild est sélectionné, item Staff si `is_staff`, icônes par module.
- **`NavMain`** — Support `Link` react-router (navigation SPA), items disabled, isActive dynamique.
- **`NavUser`** — `@username` + "Compte Discord" en grisé en dessous, lien Panel Staff.
- **`CommandMenu`** — Vrais serveurs avec avatars, callback `onSelectServer`.

### 5. Pages créées

#### Pages guild
- **`GuildSelectionView`** — Grille de cartes des serveurs, carte "Ajouter Moddy".
- **`GuildOverviewPage`** — En-tête guild avec badges (Premium, Beta, Blacklisted), stats (membres, cases, modules actifs), CTA Premium (Stripe checkout), liste des modules avec statut actif/désactivé.

#### Pages modules
- **`StarboardPage`** — Formulaire react-hook-form + zod : salon (select), emoji, nombre de réactions. Toggle enable/disable.
- **`WelcomeChannelPage`** — Formulaire : salon, message template, mention toggle, embed optionnel (titre, corps, color picker).
- **`AutoRolePage`** — Sélection multi-rôles avec badges colorés (couleur du rôle Discord), dirty state manuel.
- **`LoggingPage`** — Salon de logs + 18 événements organisés en groupes (messages, membres, rôles, salons, vocal), toggles groupés.

#### Staff Panel
- **`StaffPage`** — Section accessible uniquement aux `is_staff`, onglets filtrés selon le rôle staff :
  - **Stats** : stats globales + statut bot (Dev/Manager seulement)
  - **Users** : recherche utilisateurs + tableau (attributs, rôles staff, cases)
  - **Guilds** : liste/recherche serveurs (Dev/Manager/Supervisor_Mod)
  - **Cases** : tableau des sanctions avec filtres
- Rôles gérés : `Dev`, `Manager`, `Supervisor_Mod/Com/Sup`, `Moderator`, `Support`, `Communication`

### 6. Composants UI ajoutés
- **`UnsavedBar`** — Barre flottante Discord-style : apparaît quand il y a des modifications non enregistrées, boutons Save/Discard, animation `shake` si tentative de navigation sans sauvegarder (via `useBlocker` react-router).
- **`SettingsDialog`** — Dialog de paramètres : onglet Compte (avatar Discord, badges), Apparence (thème clair/sombre/auto, langue EN/FR/auto), Facturation (lien Stripe portal).

### 7. Corrections UI demandées
- `@username` dans la sidebar nav-user
- Email/label "Compte Discord" en grisé sous le pseudo
- Barre de recherche 404 fonctionnelle (filtre les pages connues)
- Panel de paramètres au clic sur le profil

### 8. Composants shadcn/ui installés
- `switch` — Toggle enable/disable des modules
- `table` — Staff panel tableaux
- `tabs` — GuildOverview + Staff + Settings
- `form.tsx` — Créé manuellement (wrapper react-hook-form)

### 9. Dépendances ajoutées
- `react-hook-form` — Formulaires de configuration des modules
- `@hookform/resolvers` — Intégration zod
- `zod` — Validation des formulaires

### 10. i18n (EN + FR)
Nouvelles clés : `guildSelection.*`, `guildOverview.*`, `teamSwitcher.*`, `modules.*` (tous les 8 modules), `staff.*`, `unsavedBar.*`, `settings.*`.

---

## Fichiers créés
- `src/types/api.ts`
- `src/services/guilds.ts`
- `src/services/staff.ts`
- `src/contexts/GuildContext.tsx`
- `src/pages/GuildSelectionView.tsx`
- `src/pages/GuildOverviewPage.tsx`
- `src/pages/modules/StarboardPage.tsx`
- `src/pages/modules/WelcomeChannelPage.tsx`
- `src/pages/modules/AutoRolePage.tsx`
- `src/pages/modules/LoggingPage.tsx`
- `src/pages/StaffPage.tsx`
- `src/components/unsaved-bar.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/form.tsx`

## Fichiers modifiés
- `src/App.tsx` — Routes imbriquées
- `src/pages/HomePage.tsx` — GuildProvider wrap
- `src/pages/DashboardPage.tsx` — Layout Outlet + breadcrumb dynamique
- `src/pages/NotFoundPage.tsx` — Recherche fonctionnelle
- `src/components/app-sidebar.tsx` — Nav dynamique + refresh
- `src/components/team-switcher.tsx` — Vrais guilds
- `src/components/nav-main.tsx` — Link react-router + disabled
- `src/components/nav-user.tsx` — @username, settings dialog
- `src/components/command-menu.tsx` — onSelectServer callback
- `src/locales/en/translation.json` — Nouvelles clés
- `src/locales/fr/translation.json` — Nouvelles clés

---

## Architecture de navigation
```
HomePage (auth guard + GuildProvider)
  └─ DashboardPage (layout sidebar + Outlet)
       ├─ /              → GuildSelectionView
       ├─ /servers/:id   → GuildOverviewPage
       ├─ /servers/:id/modules/starboard      → StarboardPage
       ├─ /servers/:id/modules/welcome_channel → WelcomeChannelPage
       ├─ /servers/:id/modules/auto_role      → AutoRolePage
       ├─ /servers/:id/modules/logging        → LoggingPage
       └─ /staff          → StaffPage
```

## Prochaines étapes suggérées
1. Pages modules restants : `welcome_dm`, `auto_restore_roles`, `interserver`, `youtube_notifications`
2. Vraies notifications depuis le backend (endpoint dédié à créer)
3. Panel de paramètres utilisateur plus complet (commandes interdites, etc.)
4. Optimisation du bundle (code-splitting par route)
5. Gestion des cases de modération utilisateur (page "Mes sanctions")
6. Intégration complète Stripe (retour après paiement, affichage statut)
