# Session du 2026-08-11 — Sanctions globales & page `/violations`

## Objectif

Intégrer côté dashboard le système de **sanctions globales** décrit par
`docs/backend-integration` (guide « Sanctions globales & /violations ») :
connaître le niveau **avant** d'appeler, verrouiller exactement ce qui est
verrouillé (ni plus, ni moins), réagir proprement au `403` de sanction, et
offrir une page `/violations` complète — plus un écran dédié aux comptes
suspendus.

## Tâches accomplies

1. Types complets des sanctions globales (`SubjectSanctionStatus`, `ViolationGroup`,
   `Enforcement`, `SanctionErrorPayload`…).
2. Service `violations.ts` (`/violations/status`, `/violations`, `/violations/{group_id}`).
3. Helpers `lib/sanctions.ts` : sévérité, niveau effectif, tons de couleur,
   détection des `403` de sanction, erreur de blocage côté client, formatage
   d'échéance, dérivation des niveaux par serveur.
4. `SanctionProvider` : statut du compte (amorcé sur `/auth/me`), statut par
   serveur chargé à la demande avec cache 60 s, liste des infractions, bascule
   automatique sur l'écran de suspension, resynchronisation après un `403`.
5. Composants d'affichage : pastilles de niveau/action, référence copiable,
   bloc de compte à rebours, carte + liste d'infractions, vue détail, bandeau
   contextuel du dashboard.
6. Page `/violations` (liste par groupe, filtres de portée, détail via `?group=`)
   et écran de suspension autonome.
7. Verrous d'UI : premium, activation d'un nouveau module, automod IA, sélecteur
   de serveurs, liaison d'un serveur à l'abonnement.
8. Toast dédié aux `403` de sanction dans `handleSaveError`.
9. Traductions EN/FR complètes (`violations.*`).

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/types/violations.ts` | Types de l'API sanctions globales |
| `app/src/services/violations.ts` | Appels `/violations*` |
| `app/src/lib/sanctions.ts` | Sévérité, tons, `403` de sanction, formatage |
| `app/src/contexts/SanctionContext.tsx` | Provider + hooks `useSanctions`, `useGuildSanction`, `useSanctionGates` |
| `app/src/components/violations/violation-badges.tsx` | `LevelBadge`, `ActionBadge`, `ReferenceChip`, `EnforcementNotice` |
| `app/src/components/violations/violation-list.tsx` | `ViolationCard`, `ViolationList` |
| `app/src/components/violations/violation-detail.tsx` | `ViolationDetailView` |
| `app/src/components/violations/sanction-banner.tsx` | `SanctionNotice`, `DashboardSanctionBanner` |
| `app/src/pages/ViolationsPage.tsx` | Page `/violations` |
| `app/src/pages/SuspendedPage.tsx` | `SuspendedScreen` (compte suspendu) |

## Fichiers modifiés

- `app/src/lib/auth.ts` — champ `sanction` sur `User` (renvoyé par `/auth/me`).
- `app/src/lib/handle-error.ts` — `showSanctionToast()` + branchement dans `handleSaveError`.
- `app/src/main.tsx` — route `/violations`.
- `app/src/pages/HomePage.tsx` — `SanctionProvider` **au-dessus** de `GuildProvider`.
- `app/src/pages/DashboardPage.tsx` — bandeau contextuel + fil d'Ariane `/violations`.
- `app/src/contexts/GuildContext.tsx` — chargement du statut du serveur sélectionné,
  refus client de la **création** d'un module sous sanction.
- `app/src/pages/GuildOverviewPage.tsx` — cartes de module verrouillées, CTA premium désactivé.
- `app/src/pages/GuildSelectionView.tsx`, `app/src/components/team-switcher.tsx` — serveurs sanctionnés marqués, suspendus désactivés.
- `app/src/components/settings-dialog.tsx` — liaison de serveur verrouillée, abonnement « suspendu par une sanction ».
- `app/src/pages/PremiumPage.tsx`, `app/src/components/app-sidebar.tsx` — entrées de souscription verrouillées.
- `app/src/pages/modules/AutomodAiPage.tsx` — écriture refusée quand le **serveur** est sanctionné.
- `app/src/components/nav-user.tsx`, `app/src/components/command-menu.tsx` — accès à `/violations`.
- `app/src/types/api.ts` — `SubscriptionData.blocked_by_global_sanction`.
- `app/src/locales/{en,fr}/translation.json` — bloc `violations.*`.

## Documentation technique

### Les trois niveaux, un seul drapeau

`none` < `warn` < `limited` < `suspended`. Le niveau qui s'applique à une action
dans un serveur est **le plus sévère** entre le compte et le serveur
(`effectiveStatus()`). Les verrous se testent sur `restricted` — vrai pour
`limited` **et** `suspended` — jamais sur `level === 'limited'`.

### Ce qui est verrouillé

| Élément | Condition | Où |
|---|---|---|
| Souscrire à Moddy Max | compte `restricted` | `PremiumPage`, `AppSidebar`, `GuildOverviewPage` |
| Lier un serveur à l'abonnement | compte **ou** serveur `restricted` | `SettingsDialog`, `GuildOverviewPage` |
| Activer un module **jamais** configuré | niveau effectif `restricted` | `GuildOverviewPage` (verrou), `GuildContext.updateModule` (refus) |
| Écrire sur `automod_ai` | **serveur** `restricted` | `AutomodAiPage` |
| Serveur dans le sélecteur | serveur `suspended` | `TeamSwitcher`, `GuildSelectionView` |

Un module **déjà configuré** n'est jamais verrouillé — la règle porte sur la
création, pas sur l'édition, sous-ressources comprises. Un `warn` ne verrouille
rien et n'affiche aucun bandeau : ce serait un faux positif visible. Le staff
(`is_staff`) est exempté de bout en bout — l'API ne le bloque pas, l'UI non plus.

### Chargement du statut

- `/auth/me` renvoie déjà le statut du compte sous `sanction` : aucun appel
  supplémentaire au premier chargement. `sanction === undefined` (back-end plus
  ancien) déclenche un `GET /violations/status`.
- `GET /violations` (une fois) fournit le niveau de **chaque** serveur, ce qui
  évite un `/violations/status?guild_id=` par guilde pour marquer le sélecteur.
- Le statut détaillé d'un serveur est chargé à l'entrée dessus, avec un cache
  client de 60 s aligné sur celui du back-end — un polling plus serré ne
  rafraîchirait rien.
- Pas de WebSocket ni de SSE : un changement met jusqu'à une minute à apparaître.

### `403` de sanction

Reconnaissable à son champ `error` **objet** (les autres `403` gardent
`{"error": "message"}`). `asSanctionError()` le normalise, `showSanctionToast()`
l'affiche (message du back-end, sinon clé i18n par code — jamais le code nu) et
émet `moddy:sanction-refresh`, que le provider écoute pour recharger le statut :
l'UI se réaligne toute seule sur une sanction posée entre-temps.

Les blocages décidés côté client réutilisent la même forme
(`sanctionBlockedError()`) et traversent donc `handleSaveError` sans cas
particulier.

### Page `/violations`

L'unité d'affichage est le **groupe**, jamais la case : une infraction peut
viser le compte ET ses serveurs, les séparer donnerait l'illusion de plusieurs
sanctions. Chaque carte porte ses `subjects`, ses `references`, ses actions
(actives et révoquées, ces dernières barrées) et son compte à rebours.

`enforcement.premium` est mis en avant tant que `status = pending` : c'est ce qui
mène à une résiliation **sans remboursement**, donc ce qui pousse à faire appel à
temps. Il n'existe aucun endpoint d'appel — le dashboard redirige vers
`moddy.app/support` et ne promet rien d'automatique.

### Écran de suspension

Un compte suspendu ne voit **pas** un dashboard grisé : `SanctionProvider`
substitue `SuspendedScreen` aux enfants, avant même que `GuildProvider` ne monte
(tous ses appels renverraient `403`). L'écran n'utilise que les endpoints encore
autorisés : `/violations*` et `/auth/logout`.

## Notes & décisions

- `subject_id` reste une **string** partout (snowflakes) — aucun `Number()`.
- « Premium sanctionné ≠ premium absent » : `blocked_by_global_sanction` affiche
  « abonnement suspendu par une sanction », jamais « aucun abonnement ». Le
  portail Stripe reste ouvert — on ne bloque pas une résiliation.
- Un échec de chargement du statut ne ferme jamais le dashboard : l'UI reste
  ouverte, le back-end fait foi via ses `403`.

## Prochaines étapes suggérées

- Section « Sanctions » dans `/debug` (la page vit hors des providers : elle
  devrait appeler `getViolationStatus()` directement).
- Vue staff des infractions (le staff voit tout via `GET /violations`, la page
  actuelle n'expose pas encore les filtres `subject_type` / `subject_id`).
