# 2026-08-06 — Correction : sélecteurs vides et faux « modifications non enregistrées » à l'arrivée directe

## Objectif

Corriger le bug signalé : en arrivant **directement par le lien** sur une page de
configuration de module (ex. `/servers/:guildId/modules/welcome_channel`), les
sélecteurs de salons apparaissent vides alors qu'une configuration existe, et la
barre « modifications non enregistrées » s'affiche immédiatement.

## Cause

`GuildContext` initialisait `isLoadingGuild` à `false` et ne lançait le
chargement des données (`channels`, `roles`, `modules`) que dans un `useEffect`.
Le tout premier rendu passait donc pour « chargé » : les pages de module
montaient leur formulaire avec `channels = []` et `modules = {}`.

Conséquences :

1. `useForm({ defaultValues })` n'est évalué **qu'au premier rendu** —
   `channel_id` était figé à `''` comme valeur par défaut.
2. La ré-hydratation reposait sur un `useEffect` (`form.reset(...)`) protégé par
   `if (form.formState.isDirty) return`. Dès que l'état du formulaire divergeait
   de ses `defaultValues` vides, la ré-hydratation était **définitivement
   sautée** : le sélecteur restait vide et le formulaire était considéré comme
   modifié.

En navigation interne (depuis la sidebar) le bug n'apparaissait pas : les
données du serveur étaient déjà en mémoire, donc les `defaultValues` étaient
correctes dès le montage.

## Correctif

### 1. `GuildContext` — état de disponibilité explicite

- `isLoadingGuild` démarre à `true` quand l'URL cible déjà un serveur
  (`/servers/:guildId/...`), au lieu de `false`.
- Nouvel état interne `loadedGuildId`, positionné dans le `finally` de
  `loadGuildData` (succès **ou** erreur).
- Nouvelle valeur exposée `isGuildReady` :
  `selectedGuildId !== null && loadedGuildId === selectedGuildId`.
  Elle reste `false` pendant un changement de serveur, ce qui évite aussi de
  monter un formulaire sur les données du serveur précédent.

### 2. Pages de module — garde de chargement avant le montage du formulaire

Un `return` anticipé ne suffisait pas : les hooks (`useForm`, `useState`)
s'exécutent avant lui. Chaque page concernée a donc été scindée en deux
composants :

| Page | Composant garde | Composant contenu |
|------|-----------------|-------------------|
| `StarboardPage.tsx` | `StarboardPage` | `StarboardForm` |
| `WelcomeChannelPage.tsx` | `WelcomeChannelPage` | `WelcomeChannelForm` |
| `AutoRolePage.tsx` | `AutoRolePage` | `AutoRoleForm` |
| `LoggingPage.tsx` | `LoggingPage` | `LoggingForm` |

Le composant garde affiche l'erreur ou un `Skeleton` tant que
`isLoadingGuild || !isGuildReady`, et ne rend le composant de contenu qu'ensuite.
Ce dernier s'initialise donc systématiquement sur des données complètes.

`AdaptiveSlowmodePage` et `SocialNotificationsPage` (pas d'état dérivé de la
config au montage) reçoivent seulement la garde `isGuildReady` sur leur écran de
chargement et sur le déclenchement de leur fetch dédié.

### 3. Corrections annexes

- `StarboardPage` / `WelcomeChannelPage` : le `form.reset(...)` de
  ré-hydratation utilise désormais `resolveChannelId(...)` au lieu de
  `String(config.channel_id)`, comme les `defaultValues`. Un identifiant de
  salon renvoyé en nombre JSON (perte de précision sur les snowflakes) est ainsi
  ramené sur l'identifiant réel de la liste.
- `LoggingPage` : sa configuration vient d'un endpoint dédié
  (`getLoggingConfig`). Nouvel état `isConfigLoading` (initialisé à `isEnabled`,
  remis à `false` dans un `.finally()`) pour ne pas afficher le formulaire —
  salon vide compris — pendant cette requête.

## Fichiers modifiés

- `app/src/contexts/GuildContext.tsx`
- `app/src/pages/modules/StarboardPage.tsx`
- `app/src/pages/modules/WelcomeChannelPage.tsx`
- `app/src/pages/modules/AutoRolePage.tsx`
- `app/src/pages/modules/LoggingPage.tsx`
- `app/src/pages/modules/AdaptiveSlowmodePage.tsx`
- `app/src/pages/modules/SocialNotificationsPage.tsx`

## Vérifications

- `npm run build` (tsc + vite) : OK.
- `npm run lint` : 15 erreurs / 3 avertissements, strictement identiques à la
  baseline avant modification (toutes pré-existantes, hors périmètre).
- Pas de test automatisé dans le projet : la correction n'a pas été validée par
  un test d'intégration.

## Notes

- L'effet de ré-hydratation et son garde `isDirty` sont conservés : ils servent
  toujours après un rafraîchissement manuel des données du serveur. Ils ne sont
  simplement plus le seul rempart contre un montage prématuré.
- Effet de bord positif : `GuildOverviewPage` et `GuildCasesPage`, qui ne
  testent que `isLoadingGuild`, affichent maintenant leur squelette dès le
  premier rendu au lieu d'un contenu vide.

## Prochaines étapes suggérées

- Envisager de factoriser la garde de chargement dans un composant partagé
  (`<GuildDataGate>`) pour éviter la répétition dans chaque page de module.
