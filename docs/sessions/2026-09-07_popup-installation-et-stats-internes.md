# 2026-09-07 — Écran de remerciement d'installation & module de statistiques internes

## Objectif

Implémenter les deux sujets du guide `docs/backend-integration/stats-and-install.md` :

1. la **popup de remerciement / d'information** affichée au retour d'une
   installation du bot ;
2. le **module de statistiques internes** du panneau staff, branché sur les
   endpoints `/staff/stats/*`.

Contrainte : n'utiliser que des composants shadcn/ui, **graphiques compris**
(composant `chart`, Recharts v3).

## Tâches accomplies

- Ajout des composants shadcn manquants : `chart`, `alert`, `progress`
  (`npx shadcn@latest add`), plus la dépendance `recharts@3.8.0`.
- Types, service et hook de l'installation ; dialogue de remerciement monté
  dans `DashboardPage`.
- Types, service, helpers de lecture et hooks des statistiques ; panneau à
  cinq onglets branché sur un nouvel onglet staff `?tab=analytics` et sur la
  sidebar.
- Traductions FR + EN complètes des deux fonctionnalités.
- Correction d'un build cassé préexistant (`src/components/ui/form.tsx`).

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `app/src/types/stats.ts` | Types de l'installation **et** des statistiques |
| `app/src/services/install.ts` | `GET /install/latest`, `GET /install/sources`, `buildInstallUrl()` |
| `app/src/services/stats.ts` | Les douze endpoints `/staff/stats/*` |
| `app/src/lib/stats.ts` | Règles de lecture + formats (durées, dollars, fractions, jours) |
| `app/src/hooks/useInstallWelcome.ts` | Détection du retour d'installation |
| `app/src/hooks/useStatsCatalog.ts` | Catalogue de métriques, en cache de session |
| `app/src/hooks/useStatsResource.ts` | Lecture générique d'un endpoint de stats |
| `app/src/components/install/install-welcome-dialog.tsx` | L'écran de remerciement |
| `app/src/components/stats/stats-panel.tsx` | Assemblage des cinq onglets + fenêtre partagée |
| `app/src/components/stats/series-chart.tsx` | Courbe / histogramme d'une métrique |
| `app/src/components/stats/stats-primitives.tsx` | Tuile de chiffre-clé, sélecteur de période, états |
| `app/src/components/stats/stats-health-alert.tsx` | Bandeau de santé de la collecte |
| `app/src/components/stats/stats-overview-tab.tsx` | Vue d'ensemble |
| `app/src/components/stats/stats-acquisition-tab.tsx` | Sources d'installation + installations détaillées |
| `app/src/components/stats/stats-lifecycle-tab.tsx` | Ajouts/départs, rétention, journal brut |
| `app/src/components/stats/stats-explorer-tab.tsx` | Explorateur piloté par le catalogue |
| `app/src/components/stats/stats-ai-tab.tsx` | Consommation IA |
| `app/src/components/ui/chart.tsx` · `alert.tsx` · `progress.tsx` | Composants shadcn ajoutés |

## Fichiers modifiés

- `app/src/pages/DashboardPage.tsx` — montage de `InstallWelcomeDialog`.
- `app/src/pages/StaffPage.tsx` — onglet `analytics`.
- `app/src/components/app-sidebar.tsx` — entrée de navigation staff.
- `app/src/locales/{en,fr}/translation.json` — arbres `install.*` et `stats.*`.
- `app/src/components/ui/form.tsx` — correction d'imports (voir ci-dessous).
- `app/package.json`, `app/pnpm-lock.yaml` — `recharts`.
- `CLAUDE.md` — documentation des deux fonctionnalités.

## Décisions techniques

### Installation

- **Le paramètre `?installed=` est lu comme état initial, pas depuis un effet.**
  Il est retiré de l'URL (`history.replaceState`) au premier montage ; sans ça
  l'écran reviendrait à chaque rafraîchissement.
- **`confirmed: false` n'est pas un échec.** Le bot pose `confirmed_at` quand la
  passerelle Discord lui livre l'événement. L'écran s'affiche immédiatement et
  relit `/install/latest` **une seule fois** ~3 s plus tard — pas de sondage.
- **Le nom et l'icône du serveur viennent de `/auth/me`**, la réponse
  d'installation ne portant que des ids. La correspondance se fait par chaîne.
- **`manageable: false`** grise « Configurer » et propose
  `POST /auth/refresh-guilds` plutôt que de masquer le remerciement.
- **Acquittement en `localStorage`** (`moddy_install_ack`) : `/install/latest`
  répond pendant 30 minutes, sans mémoire locale fermer puis recharger
  rouvrirait l'écran. C'est un confort d'affichage : un stockage indisponible
  dégrade sans casser.
- `buildInstallUrl()` ne prend qu'une `source` **typée** : le vocabulaire est
  fermé, une valeur inventée tombe sous `other` et devient incomparable.

### Statistiques

- **Tout part du catalogue.** Métriques, filtres (`dims`), portées (`scopes`),
  unités, additivité et approximation en viennent — c'est aussi l'allowlist du
  backend. Mis en cache pour la session, mais **un échec n'est jamais mis en
  cache**.
- **Les quatre règles de lecture vivent dans `src/lib/stats.ts`**, pas dans les
  écrans : jamais de total sur une métrique non additive, journée en cours
  séparée en série distincte (`toChartRows()`), `null` laissé en trou, valeurs
  de dimension forcées en chaînes.
- **La journée en cours est dessinée à part.** Pour une courbe, la série
  pointillée inclut le dernier jour clos comme point d'ancrage — sinon le
  pointillé serait détaché. Pour un histogramme, une seule série avec un `Cell`
  atténué : deux séries de barres se partageraient la largeur de la journée.
- **L'infobulle des courbes est portée par une série transparente.** Les deux
  séries visibles portent `tooltipType="none"` (que `ChartTooltipContent`
  filtre) : sans ça, la journée en cours afficherait une ligne vide, son trait
  plein valant `null`.
- **Les snowflakes restent des chaînes** partout : saisie, requêtes, affichage.
  Aucun `Number()`, y compris sur les ids renvoyés par `/top-guilds`.
- **`conversion_pct` et `retention_pct` sont côte à côte mais annotés** : le
  premier porte sur la fenêtre, le second sur toute l'histoire. Les en-têtes du
  tableau le disent, la comparaison naïve serait fausse.
- **`clicks` best-effort** : un `null` généralisé déclenche un encart plutôt
  qu'un affichage de zéros.

## Problèmes rencontrés

- Les fichiers générés par `npx shadcn@latest add` importent `cn` depuis `"cn"`
  au lieu de `"@/lib/utils"` — corrigé sur les trois composants ajoutés.
- **Build cassé avant cette session** : `src/components/ui/form.tsx` importait
  `@radix-ui/react-label` et `@radix-ui/react-slot`, deux paquets absents du
  `package.json` (le projet dépend du parapluie `radix-ui`). `npm run build`
  échouait sur `main`. Les imports pointent désormais vers `radix-ui`, comme
  tous les autres composants du dossier.

## Vérifications

- `npx tsc -b` : aucune erreur.
- `npx eslint` sur tous les fichiers touchés : aucune erreur (le seul
  avertissement restant, `set-state-in-effect` dans `DashboardPage`, est
  antérieur et concerne `?openSettings=`).
- `npx vite build` : succès (il échouait avant la correction de `form.tsx`).

## Prochaines étapes suggérées

- Brancher les vues serveur des notifications (`/guilds/{id}/notifications`),
  déjà exposées en service mais sans écran.
- Découper le bundle : il dépasse 2 Mo, Recharts y contribue — un `import()`
  dynamique du panneau staff serait le premier gain.
- Exposer un générateur de liens d'installation (source + UTM) dans le panneau
  staff, en s'appuyant sur `buildInstallUrl()` et `GET /install/sources`.
