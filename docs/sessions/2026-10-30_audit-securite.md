# 2026-10-30 — Audit de sécurité du dashboard

## Objectif

Traiter les constats de l'audit de sécurité (`web/dashboard` : DASH-01 à DASH-04, SITE-05) et
adapter le dashboard au nouveau contrat de `api.moddy.app` après ses propres correctifs.
Chaque constat a été vérifié dans le code avant correction.

## Adaptations au contrat du backend

| Point | Constat dans le code | Action |
|---|---|---|
| Bot Customization : `avatar_url`/`banner_url` | Déjà conforme : `diffDraft()` n'écrit la clé que pour une image `clear` (→ `null`) ; une image neuve est uploadée **au moment du save** puis envoyée aussitôt ; une image inchangée (`keep`) n'envoie rien | Ajout du code `invalid_image_url` (liste des codes + `en`/`fr`) |
| Langue : `PATCH /guilds/{id}/settings` | La langue passe déjà par `PUT …/settings/language` ; `updateGuildSettings()` (`services/guilds.ts`) n'avait **aucun appelant** | Fonction morte supprimée (elle aurait renvoyé 422 au premier usage) |
| Slowmode : 503 / 422 | `upsertSlowmodeChannel` / `deleteSlowmodeChannel` tombaient dans `handleSaveError()` générique | `handleChannelError()` dans `AdaptiveSlowmodePage` : 503 → « Discord ne répond pas, réessayez dans un instant » ; 422 en chaîne → « salon introuvable, s'il vient d'être créé réessayez dans deux minutes ». Les 422 de validation (tableau) gardent le traitement générique. `saveAdaptiveSlowmodeConfig()` n'a aucun appelant |
| `GET /users/{id}` : 429 / 404 | Appelé par `getPublicUser()` en repli de `useUserProfile` | `ApiError.retryAfter` (lu sur `Retry-After`) + `isRateLimited` ; sur 429, attente du délai puis un réessai (le profil reste « en chargement ») ; un 404 reste en cache module (plus de nouvel essai dans la session) |

## Constats de l'audit

- **DASH-01 / DASH-02 (Critique / Élevée) — corrigé.** `api/backend-proxy.ts` confirmé : signature
  HMAC de toute requête, sans authentification, `endpoint` concaténé à `API_URL`, CORS réfléchi avec
  credentials, `API_KEY` vide par défaut. Aucun appelant dans `app/src`. Fichier supprimé,
  `api/README.md` réécrit. Écart avec le rapport : la version actuelle ne transmettait pas le cookie
  (l'extrait du rapport le montre), et le pré-vol `OPTIONS` n'était jamais servi (405 avant) — le
  fond du constat reste vrai.
- **DASH-03 (Moyenne) — corrigé.** `icon_svg` n'est plus injecté : il sert de masque CSS
  (`data:image/svg+xml`), peint dans la couleur d'accent — un SVG chargé comme image n'exécute ni
  script ni `onload` (vérifié dans Chromium). Pas de dépendance DOMPurify ajoutée. Les liens de
  `inline-markdown.ts` passent par `isSafeInlineHref()` (`http(s)://` ou `/chemin`, pas `//hôte`) ;
  sinon le libellé est rendu en texte.
- **DASH-04 (Faible) — corrigé.** `DebugPage` est chargée en `lazy()` derrière `DebugRoute`
  (dev ou staff, sinon `NotFoundPage`) : l'interception de `console.*` ne s'exécute plus pour
  tout le monde. `logger` n'écrit plus les charges utiles en production (sauf `?debug`), les
  erreurs et avertissements gardent leur détail. L'envoi d'événements Sentry depuis `/debug`
  n'est pas un vrai risque à part : le DSN est public par nature.
- **SITE-05 (annexe) — corrigé.** En-têtes ajoutés sur `/(.*)` dans `vercel.json` et
  `app/vercel.json`.

## Fichiers

- Supprimé : `api/backend-proxy.ts`
- Créés : `app/src/pages/DebugRoute.tsx`, ce fichier
- Modifiés : `api/README.md`, `vercel.json`, `app/vercel.json`, `CLAUDE.md`,
  `app/src/main.tsx`, `app/src/lib/{auth,logger,inline-markdown,bot-customization}.ts`,
  `app/src/components/info-banner.tsx`, `app/src/hooks/useProfile.ts`,
  `app/src/services/guilds.ts`, `app/src/pages/modules/AdaptiveSlowmodePage.tsx`,
  `app/src/locales/{en,fr}/translation.json`

## Tests

Le dépôt n'a pas de lanceur de tests. `isSafeInlineHref()` / `parseInlineMarkdown()` ont été
vérifiés par un script jetable (esbuild + node), le masque SVG dans Chromium (Playwright).
`tsc -b`, `eslint .` et `vite build` passent.

## Prochaines étapes

- Retirer `API_KEY` / `API_URL` du projet Vercel du dashboard et **renouveler `API_KEY`** côté backend.
- Vérifier la forme exacte du 422 « salon hors serveur / trop récent » du slowmode : s'il porte un
  code dédié, le distinguer des autres 422 en chaîne.
- Mettre en place Vitest pour pérenniser les tests des fonctions pures.
