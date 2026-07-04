# Session 2026-07-04 — Intégration du système « Cases » (modération)

## Objectif

Intégrer le nouveau système de **cases de modération** de l'API Moddy, qui remplace
l'ancien système (`ModerationCase` / `getCases` dans `services/staff.ts`). Trois vues
partageant **une seule vue détaillée unifiée** (design continu façon tickets Linear) :

1. **Personnel** (`/cases`) — toutes ses sanctions, tous serveurs confondus.
2. **Serveur** (`/servers/:guildId/cases`) — modération d'un serveur (auto-autorisé si admin).
3. **Staff** (onglet Cases du panel staff) — recherche libre + création.

## Tâches accomplies

- Contrats de données complets du nouveau modèle (case / sanction / event / appeal / meta / profils).
- Service `services/cases.ts` couvrant tous les endpoints du guide (`/cases`, `/cases/meta`,
  sanctions, revoke, notes, `/staff/blacklist`, profils user/guild).
- Vue détaillée **unifiée** avec :
  - Timeline chronologique mêlant **commentaires** (composant `Message` + `Bubble`) et
    **historique d'actions** (composant `Marker`) — sanctions, statuts, appels, preuves automod.
  - Panneau latéral de propriétés (sujet, portée, émetteur, groupe, dates) façon Linear.
  - Panneau sanctions (avec révocation) + panneau appels.
  - Composer de commentaire, ajout de sanction, fermeture/réouverture, édition de la raison
    — visibles uniquement pour un **staff modérateur** sur un case `global`/`network`.
- Liste filtrable façon Linear (statut, action, recherche, pagination offset).
- Formulaires **pilotés par `GET /cases/meta`** (types × actions autorisées, temporisables) — rien en dur.
- Résolution des IDs Discord en avatar + nom via `/users/{id}/profile` et `/guilds/{id}/profile`
  (cache module-level partagé, hooks `useProfile`).
- i18n complet EN + FR (`cases.*`), navigation sidebar, breadcrumbs, routes.
- Suppression de l'ancien code cases (`getCases`/`getCase`/`ModerationCase` côté staff).

## Fichiers créés

- `app/src/types/cases.ts` — enums + objets + meta + filtres + profils.
- `app/src/services/cases.ts` — endpoints cases + blacklist + profils (meta cachée).
- `app/src/lib/cases.ts` — permissions (`canModerateCases`), métadonnées d'action (icône/ton),
  formatage (`relativeTime`, `absoluteTime`).
- `app/src/hooks/useCasesMeta.ts`, `app/src/hooks/useProfile.ts`.
- `app/src/components/cases/` : `case-badges`, `entity-ref`, `case-list`, `case-timeline`,
  `case-composer`, `sanctions-panel`, `appeals-panel`, `action-picker`, `add-sanction-dialog`,
  `create-case-dialog`, `case-detail`, `cases-browser`.
- `app/src/pages/MyCasesPage.tsx`, `app/src/pages/GuildCasesPage.tsx`.
- `docs/sessions/2026-07-04_integration-cases.md` (ce fichier).

## Fichiers modifiés

- `app/src/main.tsx` — routes `/cases` et `/servers/:guildId/cases`.
- `app/src/components/app-sidebar.tsx` — entrées « Mes sanctions » et « Modération ».
- `app/src/pages/DashboardPage.tsx` — breadcrumbs des deux routes.
- `app/src/pages/StaffPage.tsx` — onglet Cases réécrit via `CasesBrowser`.
- `app/src/services/staff.ts` — retrait de `getCases`/`getCase`.
- `app/src/locales/{en,fr}/translation.json` — section `cases.*` + `pageTitle.cases`.

## Décisions & règles respectées

- **Vue détail unique** paramétrée par `canModerate` (staff modérateur) et le type de case ;
  l'apparence est identique quel que soit le contexte (perso / serveur / staff).
- **Droits d'écriture** : uniquement staff modérateur ET case `global`/`network`
  (`meta.writable_case_types`). Le back-end reste l'autorité (403/404 gérés).
- **Pas de calcul d'expiration côté front** : on n'affiche « expirée » que si
  `sanction.status === 'expired'`. `status_locked` affiche un cadenas.
- **`payload` défensif** : la timeline ne suppose jamais de schéma fixe.
- **Polling / pas de temps réel** : chaque mutation renvoie le case complet (source de vérité unique).

## Vérification

- `npm run build` (tsc -b + vite build) : ✅
- `npx tsc -b` : ✅
- `npx eslint` sur tous les nouveaux fichiers : ✅ (0 problème)
- Vérification runtime end-to-end non réalisée : l'app est protégée par l'auth Discord et
  requiert le backend `api.moddy.app` (inaccessible depuis cet environnement).

## Prochaines étapes suggérées

- Optionnel : router les cases par URL (`/cases/:reference`) pour des liens partageables.
- Brancher la blacklist staff sur la nouvelle projection `/staff/blacklist` (déjà typée).
- Hovercards de profil au survol des `EntityRef`.
