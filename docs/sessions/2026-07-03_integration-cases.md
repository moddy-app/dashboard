# Session — Intégration des Cases (modération)

**Date** : 2026-07-03
**Branche** : `claude/cases-integration-api-g48lb1`

## Objectif

Intégrer le nouveau système de **Cases** de l'API Moddy (`https://api.moddy.app`),
qui remplace l'ancien système de sanctions, dans le dashboard React. Trois
contextes d'utilisation, partageant **la même vue détaillée** :

1. **Personnel** (`/me`) — toutes ses cases, tous serveurs réunis.
2. **Serveur** (`/servers/:guildId`) — cases scopées sur un serveur administré, avec filtres.
3. **Staff** (`/staff/cases`, `/staff/blacklist`) — recherche transversale + création + blacklist.

Contraintes explicites : design « hyper soigné » inspiré des tickets Linear,
100 % shadcn/ui, responsive, cohérent, et capable de tenir **des milliers de cases**.

## Ce qui a été fait

### Fondations
- Ajout de `react-router-dom` (routing SPA) et `@tanstack/react-virtual`
  (virtualisation des listes pour tenir des milliers de lignes).
- Providers montés dans `main.tsx` : `ViewerProvider`, `ProfileCacheProvider`,
  `ToastProvider`, `BrowserRouter`.

### Couche données (`src/services/`)
- `cases-types.ts` — types complets du domaine (Case, Sanction, Event, Appeal,
  Meta, Blacklist, Profils, enums) alignés sur le contrat API.
- `cases.ts` — client `fetch` (`credentials: 'include'`) : `getCasesMeta`,
  `listCases`, `getCase`, `createCase`, `patchCase`, `addSanction`,
  `revokeSanction`, `addNote`, `listBlacklist`, `getUserProfile`, `getGuildProfile`.
  Gestion d'erreurs typée (`ApiError` avec `status`/`detail`).

### Hooks (`src/hooks/`)
- `useViewer` — identité + statut staff/modérateur du visiteur (via `/auth/verify`
  + `/users/{me}/profile`), pour le gating de navigation.
- `useProfiles` — cache client (dédup + partage) des profils user/guild pour
  hovercards et avatars.
- `useCasesMeta` — meta mise en cache (source de vérité des formulaires).
- `useCasesList` — pagination offset incrémentale (page de 50, fin détectée
  quand `page.length < limit`), anti-race par identifiant de requête.
- `useCaseDetail` — détail + injection des réponses de mutation (les POST/PATCH
  renvoient la case complète → pas de re-fetch).
- `useTheme` — bascule clair/sombre persistée (localStorage).

### Composants UI shadcn ajoutés (`src/components/ui/`)
`avatar`, `tabs`, `tooltip`, `hover-card`, `skeleton`, `dialog`, `popover`,
`scroll-area`, `sheet`, `spinner`, `toast` — tous dans le style radix-maia existant.

### Composants Cases (`src/components/cases/`)
- `case-badges` — glyphe de statut (esprit Linear), badges type/action/statut,
  points d'action colorés.
- `actor` / `profile-hovercard` — références inline (utilisateur/serveur/système/
  automod/staff) avec hovercard de profil.
- `case-row` + `case-list` — ligne façon Linear + liste **virtualisée** avec
  infinite-scroll, états loading/erreur/vide.
- `case-filters` + `cases-screen` — barre de filtres (statut, type, action,
  recherche ID sujet, ID portée) pilotée par la meta, et coquille de liste
  réutilisée par les 3 contextes (cohérence garantie).
- `case-detail-view` — **vue détaillée partagée** : en-tête (retour, référence,
  actions), titre/motif, panneau **Sanctions** (révocation), panneau **Appels**,
  **Activité** (timeline), et sidebar **Propriétés**. S'adapte à la permission
  (composer et actions masqués hors modérateur ; commentaires/notes absents en
  vue « sujet » car l'API les retire).
- `case-timeline` — commentaires + actions **mélangés chronologiquement** avec
  markers ; rendu défensif des `payload` (comment/note/evidence/sanction_*/
  status_change).
- `message-composer` — nouveau composant de message pour les commentaires
  (auto-grow, ⌘/Ctrl+↵).
- Dialogs : `add-sanction-dialog`, `revoke-sanction-dialog`, `create-case-dialog`,
  `edit-reason-dialog` — formulaires pilotés par la meta (validation type × action).

### Layout & pages
- `layout/app-shell` + `layout/sidebar-nav` — sidebar sectionnée (Personnel /
  Serveurs / Staff), topbar avec « aller à une référence », menu utilisateur
  (thème, déconnexion), sheet mobile.
- `pages/` — `personal-cases-page`, `server-cases-page` (+ landing/guild picker),
  `staff-cases-page`, `blacklist-page`, `login-page`.
- `App.tsx` — routes + gating auth/staff ; `main.tsx` — providers.

## Vérification
- `npm run build` (tsc + vite) : **OK**.
- Test navigateur (Chromium + API mockée) sur les 5 vues, light & dark :
  **0 erreur console**, rendu conforme, virtualisation OK sur 137 cases.

## Notes / décisions
- Les endpoints Cases utilisent l'auth par **cookie de session** (comme
  `/auth/*`), donc appelés en direct avec `credentials: 'include'` — pas via le
  proxy HMAC (réservé à `/api/website/*`).
- Aucune liste de serveurs de l'utilisateur n'étant exposée par l'API, la vue
  serveur passe par une saisie d'ID (+ récents en localStorage).
- **Déploiement** : `vercel.json` redirige encore `/` et `/index.html` vers la
  page 503 « dashboard indisponible ». Pour mettre le dashboard en ligne, il
  faudra retirer ce gate et ajouter un rewrite SPA (`/(.*) → /index.html`).
  Non modifié ici (décision produit).

## Prochaines étapes suggérées
- Ouvrir le dashboard (retrait du gate 503 + rewrite SPA) quand souhaité.
- Ajouter un lien profond vers un `group_id` (regrouper les cases d'une affaire).
- Polling léger du détail (pas de temps réel côté API).
