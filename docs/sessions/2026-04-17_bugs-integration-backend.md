# Session 2026-04-17 (suite) — Bugs d'intégration backend & corrections

## Contexte

Continuation de la session principale d'intégration. Après déploiement sur `preview.moddy.app`, plusieurs bugs ont été découverts en test réel.

---

## Problèmes identifiés & corrections apportées

### 1. `useBlocker` crash — "must be used within a data router"

**Symptôme :** Page blanche dès qu'on ouvre une page module. Console : `Uncaught Error: useBlocker must be used within a data router`.

**Cause :** `useBlocker` (utilisé dans `UnsavedBar`) nécessite un **data router** (`createBrowserRouter`). L'app utilisait `<BrowserRouter>` (legacy router).

**Fix :** Migration de `BrowserRouter` vers `createBrowserRouter` dans `main.tsx`. Les routes sont maintenant définies directement dans le router au lieu de `App.tsx`.

**Fichiers modifiés :** `app/src/main.tsx`, `app/src/App.tsx`

---

### 2. `GET /guilds/:id/discord` → 404 systématique

**Symptôme :** Toutes les pages serveur affichent une erreur. Console : `Failed to load resource: 404` sur `/guilds/{id}/discord`.

**Cause identifiée :** L'endpoint retourne 404 quand le guild n'est pas en base de données (`in_database: false`), OU quand le bot n'est plus dans le serveur. De plus, le vrai fichier `API_ENDPOINTS.md` (ignoré dans un premier temps) révèle que `/guilds/:id/discord` retourne `guild.id` (string) tandis que les autres endpoints retournent `guild_id` (number) → incohérence.

**Fix frontend :** 
- Fallback dans `GuildContext.loadGuildData` : si `/discord` retourne 404, essaie `/guilds/:id` puis les endpoints séparés `/channels` et `/roles`
- Normalisation dans `getGuildDiscordData()` : mappe `guild.id` → `guild_id` pour cohérence interne
- `Promise.allSettled` pour modules et stats (ne bloque pas si l'un échoue)

**Fix backend à demander :** Retourner les données Discord même quand `in_database: false`. Standardiser `guild_id` vs `id`.

**Fichiers modifiés :** `app/src/services/guilds.ts`, `app/src/contexts/GuildContext.tsx`

---

### 3. Guild ID inexistant — session périmée

**Symptôme :** Toutes les requêtes utilisent l'ID `845083371607687200` qui retourne 404.

**Cause :** La session Redis (TTL 30j) mémorise la liste des guilds au moment du login. Si le bot est retiré d'un serveur après le login, la session contient encore ce guild mais les appels API échouent.

**Fix frontend :**
- Ajout de `refreshGuildList()` dans le `GuildContext` → appelle `POST /auth/refresh-guilds` et redirige vers `/` pour forcer un rechargement depuis `/auth/me`
- Bouton "Rafraîchir mes serveurs" affiché dans l'état d'erreur 404
- Message d'erreur plus clair : "Moddy a peut-être été retiré de ce serveur"

**Fichiers modifiés :** `app/src/contexts/GuildContext.tsx`, `app/src/components/error-state.tsx`

---

### 4. Crash `Cannot read properties of null (reading 'slice')`

**Symptôme :** Crash complet de l'app sur la vue d'ensemble d'un serveur. Stack trace pointe vers un `.slice()`.

**Cause :** Le backend peut retourner `guild.name = null` (notamment pour les guilds en erreur ou non configurés). Le code appelait `.slice(0, 2)` directement sans vérifier null.

**Emplacements corrigés :**
- `GuildOverviewPage.tsx` → `guildDetail.name?.slice(0, 2)?.toUpperCase() ?? '??'`
- `GuildSelectionView.tsx` → `guild.name?.slice(0, 2)?.toUpperCase() ?? '??'`
- `TeamSwitcher.tsx` → `guild.name?.slice(0, 2)?.toUpperCase() ?? '??'`
- `NavUser.tsx` → `user.name?.slice(0, 2)?.toUpperCase() ?? '??'` (x2)
- `SettingsDialog.tsx` → `displayName?.slice(0, 2)?.toUpperCase() ?? '??'`

**Fichiers modifiés :** Les 5 fichiers ci-dessus.

---

### 5. Messages d'erreur — doublon + position incohérente

**Symptôme :** "Une erreur est survenue" + "Ressource Discord introuvable" s'affichaient ensemble (redondant). Position différente selon la page (centré ou non).

**Cause :**
- `getKind()` ne reconnaissait pas les messages d'erreur français de l'API → tombait en `generic` → affichait titre générique + message API = doublon
- Positionnement géré par `className` passé en prop → inconsistant selon le contexte parent

**Fix :**
- `ErrorState` simplifié : plus de titre redondant, juste icône + message
- `getKind()` étendu aux mots-clés français : "introuvable", "accès refusé", "connexion", "non disponible"
- Suppression de la prop `className` sur `ErrorState`
- Nouveau composant `ErrorPage` : wrapper centrant standard, utilisé dans TOUTES les pages
- Les formulaires de modules n'affichent rien si `guildError` est défini (avant : le squelette puis l'erreur)

**Fichiers modifiés :** `app/src/components/error-state.tsx`, toutes les pages modules, `GuildOverviewPage.tsx`

---

### 6. Mauvaise lecture de l'API — fichier `FRONTEND_GUIDE.md` confondu avec `API_ENDPOINTS.md`

**Symptôme :** Message backend incorrect envoyé (accusait faussement le backend d'un bug de "integer overflow" sur les IDs Discord).

**Cause :** Le vrai fichier `API_ENDPOINTS.md` (documentation backend interne) n'avait pas été lu. Seul `FRONTEND_GUIDE.md` (guide frontend identique) avait été utilisé.

**Ce que la vraie doc révèle :**
- `GET /auth/me` retourne BEAUCOUP plus de champs : `global_name`, `avatar_url` (URL déjà construite), `email`, `locale`, `discord_badges`, `premium_type`, `banner_url`, etc.
- `GET /guilds/:id/discord` retourne `guild.id` (string), les autres endpoints utilisent `guild_id` (number)
- Les IDs dans les exemples de la doc sont des petits nombres (pas des vrais snowflakes > 2^53), donc le problème de précision JS n'est pas avéré

**Fixes frontend :**
- `User` interface étendue avec tous les nouveaux champs
- `getAvatarUrl()` utilise `avatar_url` fourni par l'API si disponible
- `getDisplayName()` préfère `global_name`
- `SettingsDialog` affiche badges Discord, Nitro, email, locale
- `WelcomeChannelPage` complétée avec les 4 champs embed manquants (`embed_footer`, `embed_image_url`, `embed_thumbnail_enabled`, `embed_author_enabled`)
- `GuildOverviewPage` enrichi : boost tier, features Discord, présence_count, vanity URL

---

## Message backend à envoyer (version corrigée)

**Seuls vrais bugs backend :**
1. `GET /guilds/:id/discord` retourne 404 quand `in_database: false` → devrait retourner les données Discord
2. Incohérence `guild.id` (string, endpoint /discord) vs `guild_id` (number, autres endpoints)
3. `GET /guilds/:id/modules` et `/stats` retournent probablement 404 aussi sur guilds non configurés

**Pas de bugs :**
- Les IDs Discord dans la session → l'ID `845083371607687200` est correct, le problème est que le bot n'est plus dans ce serveur
- Email → disponible dans `/auth/me` (confirmé par le vrai fichier API_ENDPOINTS.md)

---

## Fichiers créés/modifiés dans cette session

**Modifiés :**
- `app/src/main.tsx` — migration vers `createBrowserRouter`
- `app/src/App.tsx` — routes déplacées vers main.tsx
- `app/src/lib/auth.ts` — interface User complète, getAvatarUrl étendu
- `app/src/services/guilds.ts` — normalisation /discord response
- `app/src/contexts/GuildContext.tsx` — fallback 404, refreshGuildList
- `app/src/components/error-state.tsx` — refonte complète + ErrorPage wrapper
- `app/src/pages/GuildOverviewPage.tsx` — enrichissement données, null guards
- `app/src/pages/GuildSelectionView.tsx` — null guard
- `app/src/pages/modules/WelcomeChannelPage.tsx` — 4 champs embed ajoutés
- `app/src/components/team-switcher.tsx` — null guard, nettoyage polymorphisme
- `app/src/components/nav-user.tsx` — null guards
- `app/src/components/settings-dialog.tsx` — badges, Nitro, null guard
- `app/src/locales/en/translation.json` + `fr/translation.json` — nouvelles clés

---

## Prochaines étapes

1. **Backend** : Fix des 404 sur guilds non configurés, standardisation guild_id
2. **Frontend** : Tester avec des guilds fonctionnels une fois le backend corrigé
3. **UX** : Le bouton "Rafraîchir mes serveurs" devrait fonctionner en production
