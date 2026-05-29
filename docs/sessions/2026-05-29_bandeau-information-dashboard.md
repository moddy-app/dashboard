# Session 2026-05-29 — Bandeau d'information dynamique

## Objectif

Intégrer un bandeau d'information en haut du dashboard, alimenté par l'endpoint `GET /banners/active` de l'API Moddy. Le bandeau se rafraîchit automatiquement toutes les 60 secondes et supporte plusieurs types visuels ainsi que le rendu Markdown.

## Tâches accomplies

- Création du service de fetch pour les banneaux
- Création du hook de polling avec filtrage par contexte (dashboard / site vitrine)
- Création du composant `InfoBanner` avec rendu conditionnel selon le type
- Intégration dans `DashboardPage`

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `app/src/services/banner.ts` | Fetch `GET /banners/active`, retourne `Banner | null`, silencieux en cas d'erreur réseau |
| `app/src/hooks/useBanner.ts` | Hook avec polling 60 s ; reçoit `'show_dashboard'` ou `'show_website'` comme clé de filtre |
| `app/src/components/info-banner.tsx` | Composant de rendu du bandeau |

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `app/src/pages/DashboardPage.tsx` | Import + appel de `useBanner('show_dashboard')`, affichage conditionnel de `<InfoBanner>` entre le header et le contenu |

## Fonctionnalités ajoutées

### Service (`banner.ts`)
- Fetch `GET /banners/active` sans authentification (endpoint public)
- Base URL lue depuis `VITE_API_URL` (défaut : `https://api.moddy.app`)
- Retourne `null` si réponse non-ok ou erreur réseau (jamais d'exception propagée)

### Hook (`useBanner.ts`)
- Polling toutes les `60 000 ms` via `setInterval`
- Paramètre `showKey` : `'show_dashboard'` pour le dashboard, `'show_website'` pour la vitrine
- Retourne `null` si la bannière est absente, inactive, ou si `showKey` est `false`
- Cleanup (annulation de l'intervalle et du setState) via le retour du `useEffect`

### Composant (`info-banner.tsx`)

**Mode type** (quand `type !== null`) :
| Type | Icône Lucide | Couleur accent |
|------|-------------|----------------|
| `announcement` | `Megaphone` | `primary` (bleu/violet) |
| `incident` | `AlertOctagon` | `destructive` (rouge) |
| `maintenance` | `Wrench` | `amber` |
| `information` | `Info` | `sky` (bleu clair) |
| `warning` | `TriangleAlert` | `orange` |
| `resolved` | `CheckCircle2` | `emerald` (vert) |

Chaque type utilise une classe de fond semi-transparent + bordure colorée, avec variante `.dark`.

**Mode personnalisé** (quand `type === null`) :
- `icon_svg` injecté via `dangerouslySetInnerHTML` (le SVG provient du backend contrôlé)
- `color` (`#RRGGBB`) appliqué en style inline avec transparence (fond `18` d'opacité hex, bordure `30`)
- Fallback sur gris neutre si `color` est `null`

**Rendu Markdown inline** :
- `**bold**` → `<strong>`
- `*italic*` → `<em>`
- `[texte](url)` → `<a target="_blank" rel="noopener noreferrer">`
- Pas de dépendance externe, parser maison itératif

**Accessibilité** : `role="status"`, `aria-live="polite"`, icône `aria-hidden`

### Intégration dans DashboardPage

Le bandeau s'affiche entre le header (breadcrumb) et la zone de contenu (`<Outlet>`), uniquement si la bannière est non-null :

```tsx
{banner && <InfoBanner banner={banner} />}
```

## Décisions techniques

- **Pas de bibliothèque Markdown** : le Markdown dans un bandeau est limité (pas de blocs, pas d'images), un parser inline maison évite une dépendance supplémentaire.
- **`dangerouslySetInnerHTML` pour le SVG** : acceptable car le contenu vient du backend Moddy (source contrôlée, pas de contenu utilisateur).
- **Couleurs non en variables CSS** : les couleurs des types (amber, sky, emerald, orange) sont des couleurs Tailwind standard, cohérentes avec le reste du projet qui utilise aussi des classes arbitraires.
- **Pas de clés i18n ajoutées** : le composant n'affiche aucun texte UI statique (le message vient de l'API, les icônes sont décoratives).

## Prochaines étapes suggérées

- Bouton de fermeture (dismiss) avec persistance en `sessionStorage` pour ne pas réafficher la même bannière
- Support de la même logique pour le site vitrine (`show_website`) si un composant de vitrine est créé
- Animation d'apparition/disparition lors du changement de bannière
