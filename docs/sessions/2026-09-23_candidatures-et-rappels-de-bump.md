# 2026-09-23 — Modules Candidatures et Rappels de bump

## Objectif

Intégrer deux nouveaux modules à partir des guides d'intégration backend :

- **Candidatures** (`member_applications`) : configurer le module et consulter les candidatures d'adhésion Discord (lecture seule, les décisions se prennent dans Discord).
- **Rappels de bump** (`bump_reminder`) : rappels d'annuaires (DISBOARD, DSMonitoring…), comptes à rebours en direct et diagnostic.

Consigne : suivre à la lettre le skill `app/.agents/skills/shadcn/SKILL.md` et `CLAUDE.md`.

## Tâches accomplies

1. Lecture du skill shadcn **avec** la commande qu'il injecte (`npx shadcn@latest info --json`) et de la doc des composants utilisés (`npx shadcn@latest docs …`) : base **radix** (`asChild`, toasts `sonner`), `iconLibrary: hugeicons`.
2. Ajout du composant `item` via la CLI (`npx shadcn@latest add item`) après un `--dry-run` + `--diff`.
3. Types, helpers, services et pages des deux modules.
4. Composants partagés : `ChannelPicker`, `RoleMultiPicker`, `UserChip`.
5. Intégration : routes, sidebar, vue d'ensemble (état actif), `ModuleId`, traductions EN/FR.
6. Vérifications : `tsc -b`, ESLint, `npm run build`, et test navigateur (Playwright, API simulée) des deux pages, des sauvegardes et de la validation.

## Fichiers créés

- `app/src/types/member-applications.ts`
- `app/src/types/bump-reminder.ts`
- `app/src/lib/member-applications.ts`
- `app/src/lib/bump-reminder.ts`
- `app/src/services/member-applications.ts`
- `app/src/services/bump-reminder.ts`
- `app/src/components/module-pickers.tsx`
- `app/src/components/user-chip.tsx`
- `app/src/components/member-applications/application-status-badge.tsx`
- `app/src/components/member-applications/application-list.tsx`
- `app/src/components/member-applications/application-detail.tsx`
- `app/src/components/member-applications/application-stats.tsx`
- `app/src/components/bump-reminder/directory-icon.tsx`
- `app/src/components/bump-reminder/live-state.tsx`
- `app/src/components/bump-reminder/reminder-dialog.tsx`
- `app/src/components/ui/item.tsx` (CLI shadcn)
- `app/src/pages/modules/MemberApplicationsPage.tsx`
- `app/src/pages/modules/BumpReminderPage.tsx`

## Fichiers modifiés

- `app/src/main.tsx` — deux routes
- `app/src/components/app-sidebar.tsx` — deux entrées sous « Modules »
- `app/src/pages/GuildOverviewPage.tsx` — cartes + règle d'activité propre à chaque module
- `app/src/types/api.ts` — `ModuleId`
- `app/src/locales/{en,fr}/translation.json` — `modules.member_applications`, `modules.bump_reminder`, `modules.rolePicker`, `common.avatarAlt`
- `CLAUDE.md`

## Notes techniques et décisions

### Candidatures

- `enabled` est un vrai interrupteur, mais le module n'est **actif** qu'avec un salon : le badge d'en-tête et la vue d'ensemble testent `enabled && channel_id`, sur la config **enregistrée**.
- `PUT` avec l'objet complet ; les motifs sont rognés et les lignes vides retirées avant envoi.
- Limites lues dans `/diagnostics` → `limits` ; repli codé seulement si l'appel échoue.
- Deux formes de `422` : Pydantic (rattaché au champ) ou texte Discord (encart + toast, affiché tel quel).
- `/diagnostics` relu après chaque écriture. `checked: false` / `manual_approval_enabled: null` → aucune alerte.
- Liste : filtre par défaut « En attente », sondage 45 s seulement sur ce filtre et onglet visible, réponses obsolètes ignorées via un compteur de requêtes.
- Réponses : `response_label: null` → « réponse inconnue » (jamais l'index) ; type inconnu → libellé + réponse brute.
- Aucune donnée personnelle hors de l'état React.

### Rappels de bump

- Brouillon avec une clé React locale (`key`) distincte de l'`id` : une nouvelle entrée part **sans `id`**, la réponse du `PUT` remplace l'état. Vérifié dans le navigateur.
- `created_by` rempli à la création avec l'id de l'utilisateur connecté.
- Quota recalculé localement ; « premium perdu » → bandeau + badge « hors quota » + sauvegarde bloquée.
- Compte à rebours calculé depuis `due_at` chaque seconde ; `/state` relu à zéro et toutes les 45 s.
- Émojis des annuaires via `https://cdn.discordapp.com/emojis/{id}.webp`, table isolée, repli sur une icône générique.

### shadcn

- Icônes **hugeicons** dans tout le nouveau code (config du projet). Exception : sidebar et vue d'ensemble, dont les props sont typées `LucideIcon`.
- `item.tsx` : l'upstream importe `cn` depuis le paquet npm `cn` ; ramené sur `@/lib/utils`. `separator.tsx` n'a pas été écrasé (seul changement proposé : ce même import).
- `ToggleGroup` : cette version n'a pas de prop `spacing` ; le filtre est en taille par défaut dans un conteneur défilant (pas de `flex-wrap`, qui casse les coins).

## Problèmes rencontrés

- `npm ci` échoue (lockfile npm désynchronisé) → installation avec `pnpm install --frozen-lockfile` (le `pnpm-lock.yaml` est à jour).
- Le CDN Discord est bloqué par le proxy du bac à sable : les émojis n'ont pas pu être vus rendus, seul le repli l'a été.

## Non vérifié

- Comportements du bot (délai de ~2 min, purge des comptes à rebours après `DELETE`) : documentés côté bot, non testables ici.
- Les pages ont été testées contre une API **simulée** d'après le guide, pas contre le vrai backend.

## Prochaines étapes suggérées

- Tester contre l'API réelle (formes d'erreur `422`, `used` du catalogue après sauvegarde).
- Ajouter les deux modules aux outils de Brocoli (`TOOL_META`) si le backend les expose.
- Onglet serveur des candidatures dans la palette ⌘K si besoin.
