# Session du 2026-07-29 — Google Sans auto-hébergée

## Objectif

Remplacer le chargement de Google Sans par CDN (`fonts.googleapis.com`) par une
intégration propre, auto-hébergée, branchée sur les tokens de thème shadcn/ui —
sans toucher aux composants un par un.

Les fichiers sources ont été déposés temporairement dans `/google-sans/` à la
racine du dépôt (16 `.ttf`).

---

## Tâches accomplies

### 1. Conversion des sources TTF → WOFF2 sous-ensemblés

Le dossier `/google-sans/` contenait deux familles distinctes :

- `GoogleSans-*.ttf` — la famille par défaut (`Google Sans`)
- `GoogleSans_17pt-*.ttf` — la variante de taille optique 17pt
  (`Google Sans 17pt`)

**Décision** : on retient la famille par défaut `GoogleSans-*`, qui est la
famille canonique. La série `_17pt` aurait imposé de déclarer une seconde
famille pour un gain marginal ; elle reste disponible si l'on veut plus tard
affiner le rendu du petit texte.

Huit faces retenues (les quatre graisses + leurs italiques) :

| Source | Sortie | Graisse |
|---|---|---|
| `GoogleSans-Regular.ttf` | `google-sans-400.woff2` | 400 |
| `GoogleSans-Italic.ttf` | `google-sans-400-italic.woff2` | 400 italic |
| `GoogleSans-Medium.ttf` | `google-sans-500.woff2` | 500 |
| `GoogleSans-MediumItalic.ttf` | `google-sans-500-italic.woff2` | 500 italic |
| `GoogleSans-SemiBold.ttf` | `google-sans-600.woff2` | 600 |
| `GoogleSans-SemiBoldItalic.ttf` | `google-sans-600-italic.woff2` | 600 italic |
| `GoogleSans-Bold.ttf` | `google-sans-700.woff2` | 700 |
| `GoogleSans-BoldItalic.ttf` | `google-sans-700-italic.woff2` | 700 italic |

Conversion via `fontTools.subset` (`--flavor=woff2 --with-zopfli`), en
sous-ensemblant sur les plages Unicode **`latin` + `latin-ext`** — exactement
celles que sert le CDN Google. Les quatre locales du dashboard
(`en / fr / es / de`) sont intégralement couvertes.

**Résultat** : chaque face passe de **~1,9 Mo (TTF) à ~35 Ko (WOFF2)**, soit
~285 Ko pour la famille complète et **~70 Ko réellement préchargés**.

Vérification post-conversion : les 8 fichiers se relisent correctement,
`usWeightClass` conforme, 458 codepoints par face, aucun caractère manquant sur
un échantillon `A Z a z é È ç ñ ü ß œ € " " — · à Ä Ö`.

### 2. Déclaration `@font-face` manuelle

Les 8 `@font-face` sont écrits à la main en tête de `app/src/index.css`, chacun
avec `font-display: swap` pour éviter le flash de texte invisible.

Une face par graisse **réelle** plutôt qu'une graisse unique épaissie
synthétiquement par le navigateur : Google Sans rend nettement mieux avec ses
propres dessins de graisse.

### 3. Branchement sur les tokens shadcn / Tailwind v4

Dans le bloc `@theme inline` :

```css
--font-sans: "Google Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
--font-heading: var(--font-sans);
```

Tous les composants shadcn (boutons, dialogs, menus…) héritent automatiquement
de la police via `font-sans` / `font-mono` : **aucun composant n'a été modifié**.
La pile de fallback système reste solide tant que le WOFF2 n'a pas chargé.

### 4. Preload ciblé

`app/index.html` : suppression des `<link>` vers `fonts.googleapis.com` et des
`preconnect` associés, remplacés par deux preloads seulement :

```html
<link rel="preload" href="/fonts/google-sans-400.woff2" as="font"
      type="font/woff2" crossorigin="anonymous" />
<link rel="preload" href="/fonts/google-sans-600.woff2" as="font"
      type="font/woff2" crossorigin="anonymous" />
```

Seules les deux graisses réellement présentes au-dessus de la ligne de
flottaison sont préchargées (texte courant + gras). Le 500 et le 700 se chargent
à la demande.

### 5. Convention « gras = 600 »

Le vrai 700 de Google Sans est visuellement trop lourd en usage inline. Le 600
(demibold) devient donc la graisse « gras » par défaut du projet, appliquée dans
la couche `base` :

```css
b, strong {
  @apply font-semibold;
}
```

`font-bold` (700) reste disponible pour les usages ponctuels plus marqués.

### 6. Cache HTTP

`vercel.json` sert désormais `/fonts/*.woff2` en
`Cache-Control: public, max-age=31536000, immutable`. Sans cela, l'auto-hébergement
aurait été une régression face au CDN Google, qui cachait déjà les faces un an.

### 7. Nettoyage

- Suppression du dossier temporaire `/google-sans/` (16 TTF, ~31 Mo).
- Suppression de la dépendance `@fontsource-variable/geist` et de son `@import` :
  Geist n'était plus référencée nulle part dans le code.

---

## Fichiers créés

- `app/public/fonts/google-sans-400.woff2`
- `app/public/fonts/google-sans-400-italic.woff2`
- `app/public/fonts/google-sans-500.woff2`
- `app/public/fonts/google-sans-500-italic.woff2`
- `app/public/fonts/google-sans-600.woff2`
- `app/public/fonts/google-sans-600-italic.woff2`
- `app/public/fonts/google-sans-700.woff2`
- `app/public/fonts/google-sans-700-italic.woff2`
- `docs/sessions/2026-07-29_google-sans-auto-hebergee.md` (ce fichier)

## Fichiers modifiés

- `app/src/index.css` — 8 `@font-face`, tokens `--font-sans` / `--font-mono` /
  `--font-heading`, règle `b, strong`, suppression de l'import Geist
- `app/index.html` — CDN Google Fonts retiré, deux preloads locaux ajoutés
- `app/package.json` — dépendance `@fontsource-variable/geist` retirée
- `app/pnpm-lock.yaml` — régénéré
- `vercel.json` — en-tête `Cache-Control` pour `/fonts/*.woff2`
- `docs/CLAUDE.md` — section Typographie réécrite, liste des dépendances mise à
  jour, date de dernière mise à jour
- `docs/sessions/README.md` — index mis à jour

## Fichiers supprimés

- `google-sans/` (16 fichiers `.ttf`, dossier de dépôt temporaire)

---

## Vérifications

- `pnpm build` : ✅ passe (`tsc -b && vite build`, 1717 modules).
- Les 8 `.woff2` sont bien copiés dans `dist/fonts/`.
- `dist/index.html` : **0** occurrence de `fonts.googleapis` ou `gstatic`.
- Le CSS compilé référence bien les 8 `url(/fonts/…)`.
- `pnpm lint` : 4 erreurs, toutes **préexistantes** et dans des fichiers non
  touchés par cette session (`components/ui/combobox.tsx`, `lib/auth.ts`).

---

## Notes importantes

### Le cache immutable impose de renommer en cas de remplacement

Les noms de fichiers ne portent pas de hash de contenu. Avec
`max-age=31536000, immutable`, **remplacer une face sans renommer le fichier**
laisserait les navigateurs sur l'ancienne version jusqu'à un an. Si une face est
re-générée, renommer (ex. `google-sans-400.v2.woff2`) et mettre à jour le
`@font-face` + le preload.

### Google Sans Mono absente

Le brief mentionnait un `google-sans-mono.woff2` en variable weight (400–700),
mais il ne figurait pas dans `/google-sans/`. `--font-mono` pointe donc pour
l'instant sur une pile monospace système. Pour l'ajouter plus tard : déposer le
fichier dans `app/public/fonts/`, écrire un `@font-face` avec
`font-weight: 400 700`, et faire pointer `--font-mono` sur `"Google Sans Mono"`.

### `api/homepage-503.ts`

Ce handler sert `app/index.html` (la source, pas le build) pour la page « en
travaux ». Il hérite donc automatiquement des nouveaux preloads : aucune
modification nécessaire.

---

## Technologies utilisées

- **fontTools 4.63** (`fontTools.subset`) + **Brotli** / **zopfli** — conversion
  et sous-ensemblage TTF → WOFF2
- **Tailwind CSS v4** — `@theme inline`, `@layer base`
- **shadcn/ui** — tokens `--font-sans` / `--font-mono`
- **Vite 7** — copie de `public/` vers `dist/`
- **Vercel** — en-têtes `Cache-Control` via `vercel.json`

---

## Prochaines étapes suggérées

1. **Ajouter Google Sans Mono** quand le fichier sera disponible (voir ci-dessus).
2. **Évaluer la variante `17pt`** pour le petit texte d'interface : elle avait
   été livrée dans les sources et pourrait affiner le rendu sous ~14 px, au prix
   d'une seconde famille et de 8 fichiers supplémentaires.
3. **Nettoyer les 4 erreurs ESLint préexistantes**, hors périmètre de cette
   session.
