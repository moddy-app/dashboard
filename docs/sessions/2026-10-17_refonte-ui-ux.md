# 2026-10-17 — Refonte UI/UX du dashboard

## Objectif
Uniformiser tout le dashboard : statut et pause des modules partout, sélecteurs refaits, icônes Material Symbols, Automod repensé, corrections page par page (retours de Jules), textes réécrits, règles UI écrites dans CLAUDE.md. Orchestration par Opus, code écrit par des agents Sonnet.

## Réalisé
- **Socle** : Material Symbols Rounded plein via `unplugin-icons` + barrel `src/components/icons.ts` ; `lucide-react` et Hugeicons désinstallés ; `react-colorful`, `emojibase-data`.
- **Modules** : registre `src/lib/modules.ts` (`MODULES`, `getModuleStatus()`), `src/components/module/` (`ModulePage`, `ModuleHeader`, `ModuleStatusBadge`/`Dot`, `ModuleStateControl`, `ResponsiveDialog`). Statut affiché dans chaque en-tête, la sidebar et la vue d'ensemble (groupée par catégorie). Pause/reprise/simulation par la nouvelle route `PUT /guilds/{id}/modules/{id}/state`.
- **Sélecteurs** `src/components/pickers/` : salon, rôle, membre (nouveau service `members.ts`), emoji (serveur + Unicode, `unicodeOnly`), couleur. Popover + Command, liste bornée, recherche. `lib/color.ts` unique.
- **Automod** : 5 onglets (Réglages, Surveillance, Sanctions, Exemptions, Avancé), liste unique des infractions (Moddy + perso) éditées dans un Sheet, `use_precedents`, assistant et onglets « en attente » supprimés.
- **Pages** : Welcome/DM (aperçu rendu dans la liste, plus d'aperçu dans le modal DM), Rôle automatique réécrit (`member_roles`/`bot_roles` — l'ancien `role_ids` n'était jamais lu par le bot), Slowmode en saisie libre, Candidatures en configuration seule, Logs (contour neutre, sans infobulles), Bump (sans « Prochains bumps », enregistrement à la validation du modal), Bot customization (timeout 30 s, erreurs distinguées), AltGuard/Tickets/Social/Starboard sur le châssis et les sélecteurs.
- **Style** : tokens `--success`/`--warning`/`--info`, couleurs brutes et `dark:` retirés hors échelles de sanctions, `Spinner`, `data-icon`, `Alert`/`Empty`.
- **Textes** : 114 clés mortes supprimées, ~115 réécrites (vouvoiement, sans paraphrase ni détails d'implémentation).
- **Docs** : CLAUDE.md (section « Règles UI obligatoires » + modules), `docs/API_ENDPOINTS.md` (route d'état, auto_role, slowmode, `use_precedents`).
- **Contrôle visuel** Playwright avec API simulée : captures dans `docs/sessions/screens-2026-10-17/`.

## Coordination backend
Session backend+bot (branche `claude/stoic-keller-klquag` des dépôts website-backend et moddy) : route d'état, ModuleSpec `auto_role`, délais libres du slowmode, clé `use_precedents`. **À déployer** (bot avant backend) pour que le dashboard fonctionne pleinement.

## Problèmes / points ouverts
- « Impossible de contacter le serveur » sur Bot customization : requête front conforme ; cause probable côté backend/infra (timeout passerelle ou erreur sans en-têtes CORS) — à vérifier dans les logs.
- `lib/cases.ts` / `lib/sanctions.ts` gardent des teintes brutes (5 niveaux que les tokens ne distinguent pas).
- `MemberPicker` prêt mais utilisé par aucune page pour l'instant.
- Lint : 18 erreurs préexistantes (react-refresh, set-state-in-effect), inchangées.
- Bundle principal ~2,5 Mo : découpage par route à prévoir.

## Prochaines étapes
Déployer le backend, tester sur un vrai serveur, découpage du bundle (`lazy` par page), tests automatisés.
