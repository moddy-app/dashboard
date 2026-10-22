# 2026-10-22 — Page « API indisponible » en iframe

## Objectif
Quand l'API ne répond plus du tout, afficher `https://moddy.app/down` en iframe plein écran au lieu de boucler sur le login.

## Tâches accomplies
- `useAuth` distingue un nouvel état `down` : erreur réseau (`status 0`) ou 5xx sur `GET /auth/me`. Avant, tout échec retombait sur `unauthenticated` et redirigeait vers `/auth/login`, servi par la même API en panne.
- Tant que l'état est `down`, `/auth/me` est relu toutes les 30 s ; au retour de l'API, le dashboard reprend sans rechargement.
- Nouveau composant `ApiDownScreen` : iframe `fixed inset-0` vers `moddy.app/down`.

## Fichiers
- `app/src/hooks/useAuth.ts` (modifié)
- `app/src/components/api-down-screen.tsx` (créé)
- `app/src/pages/HomePage.tsx` (modifié)
- `app/src/locales/{en,fr}/translation.json` (clé `apiDown.title`, titre accessible de l'iframe)

## Notes
- Seul l'échec de `/auth/me` au chargement déclenche l'écran ; une panne en cours de session continue de passer par les erreurs de chaque écran.
- `/transcripts/:key` (hors du châssis) n'est pas concerné.
- Au moment de la session, `www.moddy.app/down` répond `404` : la page doit exister côté site. Aucun `X-Frame-Options` n'empêche l'intégration.
