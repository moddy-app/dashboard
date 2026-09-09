# 2026-09-09 — Merge `preview` → `main` et badge Beta sur Brocoli

## Objectif

Deux choses :

1. Préparer la fusion de `preview` dans `main` en résolvant les conflits.
2. Marquer Brocoli comme fonctionnalité **Beta** dans l'interface.

## 1. Résolution du merge

### Le problème : une base commune fausse

`git merge-base origin/main preview` renvoyait `0daa968` (2026-08-25), soit une
base bien plus ancienne que la réalité : **24 fichiers en conflit**, dont une
majorité en `add/add` (`AA`) sur des fichiers qui existent depuis longtemps des
deux côtés (`app-sidebar.tsx`, les deux `translation.json`, `API_ENDPOINTS.md`…).

La cause : `main` a reçu le contenu de `preview` par un **squash** —
`8c3432a « Preview (#81) »`. Un squash ne conserve aucun lien de parenté, donc
Git ne pouvait pas voir que ce commit *est* l'état de `preview` au 2026-08-27.

Vérification faite avant toute chose :

```
git diff --stat 0ba16d2 8c3432a   # → vide, les arbres sont identiques
```

### La résolution : rétablir la base commune

Plutôt que de résoudre 24 conflits à la main (avec le risque de perdre du
contenu dans `pnpm-lock.yaml`, 7050 lignes, ou dans les 2717 lignes de chaque
fichier de traduction), on rétablit d'abord l'ancêtre manquant :

```
git merge -s ours 8c3432a   # aucun changement de contenu : les arbres sont égaux
git merge origin/main
```

Le second merge redevient un vrai trois-voies : **4 conflits** au lieu de 24, et
`pnpm-lock.yaml`, `package.json`, `app-sidebar.tsx`, `StaffPage.tsx`,
`API_ENDPOINTS.md` fusionnent tout seuls.

> ⚠️ À retenir pour les prochaines fois : si `main` reçoit `preview` par squash,
> le merge suivant partira toujours d'une base fausse. Soit on fusionne `preview`
> avec un vrai merge commit, soit on repart de `main` après chaque squash.

### Les 4 conflits restants

| Fichier | Nature | Résolution |
|---|---|---|
| `app/src/main.tsx` | les deux côtés ajoutent un import et une route | **les deux** : `BrocoliPage` (preview) + `BillingRedirectPage` (main) |
| `app/src/locales/en/translation.json` | les deux côtés ajoutent une clé racine en fin de fichier | **les deux** : `brocoli` (preview) + `install` / `stats` (main) |
| `app/src/locales/fr/translation.json` | idem | idem |
| `CLAUDE.md` | ligne « Dernière mise à jour » | date du jour, mentionnant les deux apports |

Les deux JSON ont été résolus par script avec **validation `json.loads()`** après
écriture — recoller deux blocs d'objet à la main est exactement le genre
d'endroit où l'on oublie une virgule.

### Vérification

- `pnpm install --frozen-lockfile` → le lockfile fusionné est cohérent.
- `pnpm build` (`tsc -b && vite build`) → OK.
- `pnpm lint` → **20 problèmes, identiques avant et après le merge** (mesuré via
  `git stash`). Tous préexistants, aucun introduit ici.

### Contenu apporté par chaque côté

- **`preview` → `main`** : le module Brocoli (assistant IA de configuration),
  `useViewportHeight`, les correctifs d'UI associés.
- **`main` → `preview`** : l'écran de remerciement d'installation, les
  statistiques internes staff, la route `/billing`, la skill
  `migrate-radix-to-base` et la mise à jour de la skill `shadcn`.

## 2. Badge « Beta » sur Brocoli

Brocoli s'affiche à trois endroits. Le badge est posé aux trois, pour qu'aucun
chemin d'accès ne le présente comme une fonctionnalité stable :

1. **Sidebar** — `app-sidebar.tsx` passe `badge: t("brocoli.beta")` sur l'entrée.
2. **Palette ⌘K** — `command-menu.tsx` rend un `Badge` en fin de ligne.
3. **Fil d'Ariane** — `DashboardPage.tsx`, sur le segment `Brocoli`.

Ce dernier point compte : `BrocoliPage` n'a **pas de titre à l'écran**, le fil
d'Ariane est le seul endroit où le nom de la page apparaît une fois qu'on y est.
Sans lui, le badge disparaissait dès qu'on ouvrait la page.

### Choix d'implémentation

- **Un champ générique, pas un cas particulier Brocoli.** `NavMain` gagne un
  champ optionnel `badge?: string` sur `NavItem` **et** `NavSubItem` ; `Crumb`
  gagne le même. Le prochain module en beta n'aura rien à recâbler.
- **Le badge de sidebar disparaît en mode icônes**
  (`group-data-[collapsible=icon]:hidden`) : il n'y reste plus de titre à
  qualifier, et un badge seul sous une icône ne veut rien dire.
- **`truncate` déplacé sur le titre.** `SidebarMenuButton` porte
  `[&>span:last-child]:truncate` : avec un badge, le dernier `span` n'est plus
  le titre. La classe est donc posée explicitement sur le titre, et le badge
  reçoit `shrink-0` — sans quoi c'est le badge qui aurait été tronqué et le
  titre qui aurait débordé.
- **Le fil d'Ariane ne rend le badge que sur le dernier segment.** Un badge sur
  un segment intermédiaire qualifierait le chemin, pas la page.
- **Clé i18n, pas de littéral.** `brocoli.beta` vaut `Beta` en anglais et
  `Bêta` en français.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/components/nav-main.tsx` | champ `badge` sur `NavItem`/`NavSubItem`, composant `NavBadge` |
| `app/src/components/app-sidebar.tsx` | `badge: t("brocoli.beta")` sur l'entrée Brocoli |
| `app/src/components/command-menu.tsx` | `Badge` sur l'entrée Brocoli |
| `app/src/pages/DashboardPage.tsx` | `badge` sur `Crumb`, rendu sur le dernier segment ; import `Badge` |
| `app/src/locales/{en,fr}/translation.json` | clé `brocoli.beta` + résolution du conflit de merge |
| `app/src/main.tsx` | résolution du conflit (les deux imports/routes) |
| `CLAUDE.md` | section Brocoli : mention du badge ; date de mise à jour |

## Prochaines étapes

- Retirer le badge quand Brocoli sort de beta : trois appels à `brocoli.beta` et
  la clé i18n, rien d'autre.
- Si d'autres modules passent en beta, réutiliser le champ `badge` plutôt que
  d'ajouter un rendu ad hoc.
- Le chunk de build dépasse 500 Ko (2,1 Mo, 624 Ko gzip) : le découpage par
  `import()` dynamique sur les pages de modules mériterait d'être fait.
