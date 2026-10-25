# 2026-10-25 — Auto Role : rôles du tag du serveur

## Objectif
Ajouter au module Rôle automatique la troisième liste `tag_roles` : rôles donnés tant
qu'un membre affiche le tag du serveur, retirés quand il l'enlève (réconciliés par le bot).

## Tâches accomplies
- Section « Tag du serveur » sur `AutoRolePage` (même carte + `RoleMultiPicker` que
  les deux autres listes), incluse dans le brouillon, le diff, l'`UnsavedBar` et le `PUT`.
- Visibilité : `GET /guilds/{id}/modules/auto_role/tag` → `supported` ; `null` retombe
  sur `guildDetail.features` (`GUILD_TAGS`). La section reste **toujours** visible si
  des `tag_roles` existent, sinon impossible de les retirer.
- Description avec le texte du tag quand l'utilisateur connecté le porte (`tag`).
- Plafond passé de 20 à 25 rôles par liste (aligné sur le bot).
- Nouveau code d'erreur traduit `auto_role_missing_permission`.
- `isActive` du registre `MODULES` compte `tag_roles`.

## Fichiers
- `app/src/pages/modules/AutoRolePage.tsx`
- `app/src/services/auto-role.ts` (créé)
- `app/src/types/api.ts` (`AutoRoleConfig.tag_roles`)
- `app/src/lib/modules.ts`
- `app/src/locales/{en,fr}/translation.json` (`tagTitle`, `tagDescription`,
  `tagDescriptionWithTag`, `errors.auto_role_missing_permission`, `emptyHint`)
- `CLAUDE.md`

## Notes
- Les clés i18n du bot (`modules.auto_role.config.tag_roles.*`) ne sont pas reprises
  telles quelles : le dashboard a ses propres clés camelCase ; seules en/fr existent ici.
- Échec de `/tag` silencieux (log `warn`) : on retombe sur les features.

## Vérifications
`tsc -b` et `eslint` OK. Pas de test visuel (écran derrière l'authentification Discord).

## Prochaines étapes
- Déployer le bot (qui lit `tag_roles`) avant le backend.
