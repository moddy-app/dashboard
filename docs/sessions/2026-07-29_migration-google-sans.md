# Session 2026-07-29 — Migration typographique vers Google Sans

## Objectif

Remplacer proprement la police du dashboard (Inter / Geist, chargées via `@fontsource-*`)
par **Google Sans**, en self-hosting complet, branchée sur les tokens de thème shadcn/ui
pour que tous les composants en héritent sans modification individuelle.

Les TTF sources avaient été déposés temporairement dans `/google-sans/` à la racine.

## Tâches accomplies

1. Analyse des TTF sources (8 faces utiles + 8 doublons optiques `_17pt` écartés).
2. Écriture d'un script de build `scripts/build-fonts.py` (fontTools + brotli).
3. Génération de 56 woff2 sous-ensemblés par plage Unicode dans `app/public/fonts/`.
4. Génération de `app/src/fonts.css` (56 blocs `@font-face`).
5. Rebranchement des tokens `--font-sans` / `--font-mono` dans `app/src/index.css`.
6. Preload ciblé des deux graisses critiques dans `app/index.html`.
7. Suppression des dépendances `@fontsource-variable/geist` et `@fontsource-variable/inter`.
8. Suppression du dossier temporaire `/google-sans/`.
9. Vérification navigateur (Playwright) + build + lint.
10. Mise à jour de `CLAUDE.md`.

## Fichiers créés

| Chemin | Rôle |
|---|---|
| `scripts/build-fonts.py` | Génère les woff2 depuis les TTF sources |
| `app/src/fonts.css` | 56 déclarations `@font-face` (auto-généré) |
| `app/public/fonts/google-sans-*.woff2` | 56 fichiers de police (~716 Ko au total) |
| `docs/sessions/2026-07-29_migration-google-sans.md` | Ce fichier |

## Fichiers modifiés

| Chemin | Changement |
|---|---|
| `app/src/index.css` | Imports `@fontsource-*` → `./fonts.css` ; `--font-sans` et `--font-mono` redéfinis |
| `app/index.html` | Ajout de 2 `<link rel="preload">` woff2 |
| `app/package.json` | Retrait de `@fontsource-variable/geist` et `@fontsource-variable/inter` |
| `CLAUDE.md` | Section Typographie réécrite, arborescence, stack |

## Fichiers supprimés

- `google-sans/` (16 TTF, ~31 Mo) — dépôt temporaire des sources, plus nécessaire une
  fois les woff2 générés.

## Documentation technique

### Pourquoi le découpage par `unicode-range`

Les TTF sources font ~2 Mo chacun (7 424 glyphes, 3 281 points de code : latin, latin
étendu, grec, cyrillique, vietnamien). Converties telles quelles en woff2, les 8 faces
pèsent **~3,7 Mo** — inacceptable pour un chargement de page.

La solution retenue reproduit exactement ce que sert `fonts.googleapis.com` : chaque face
est découpée en 7 sous-ensembles, et chaque `@font-face` déclare son `unicode-range`. Le
navigateur ne télécharge un fichier que s'il doit effectivement rendre un caractère de sa
plage.

| Sous-ensemble | Taille (face 400) |
|---|---|
| latin | 25,1 Ko |
| latin-ext | 15,3 Ko |
| greek | 6,8 Ko |
| greek-ext | 7,4 Ko |
| cyrillic | 11,8 Ko |
| cyrillic-ext | 12,8 Ko |
| vietnamese | 6,3 Ko |

**Résultat mesuré** sur `/debug` : 4 fichiers téléchargés (latin 400/500/600/700), soit
~100 Ko au lieu de 3,7 Mo — tout en conservant la couverture cyrillique et grecque pour
les pseudos Discord non latins, qui se chargent à la demande.

L'alternative « subset latin uniquement » aurait été plus légère sur disque mais aurait
fait retomber les pseudos non latins sur la police système, avec un rendu incohérent.

### Branchement sur les tokens shadcn

```css
@theme inline {
    --font-sans: "Google Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI",
        Roboto, Helvetica, Arial, sans-serif;
    --font-mono: ui-monospace, "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
    --font-heading: var(--font-sans);
}
```

Le bloc `@layer base` existant applique déjà `font-sans` sur `html` et `body`, donc aucune
classe supplémentaire n'a été nécessaire côté markup : tous les composants shadcn
(boutons, dialogs, menus, sidebar…) héritent automatiquement.

### Preload

Seuls le 400 et le 600 en latin sont préchargés — les deux graisses réellement présentes
au-dessus de la ligne de flottaison. Le 500 et le 700 se chargent à la demande. Tous les
`@font-face` utilisent `font-display: swap` : le texte s'affiche immédiatement dans la
police de fallback puis bascule, pas de FOIT.

## Technologies utilisées

- **fontTools 4.63** + **brotli 1.2** — `pyftsubset` pour le subsetting et l'encodage woff2
- **Tailwind CSS v4** — tokens `@theme inline`
- **Playwright / Chromium** — vérification du rendu et des requêtes réseau réelles

## Notes et décisions

- **Faces `_17pt` écartées** : les sources contenaient deux jeux identiques en nombre de
  glyphes (`GoogleSans-*` et `GoogleSans_17pt-*`), variantes de taille optique. Les masters
  texte (`GoogleSans-*`) ont été retenus.
- **Pas de Google Sans Mono** : aucun fichier mono n'était fourni. `--font-mono` pointe donc
  vers une stack système. Les nombreux `font-mono` du projet (IDs Discord, JSON de debug…)
  restent lisibles. À rebrancher si la mono est fournie plus tard.
- **Convention 600 = gras** documentée dans `CLAUDE.md`, mais **les utilitaires Tailwind
  n'ont pas été remappés** : `font-semibold` reste 600 et `font-bold` reste 700. Remapper
  `font-bold` sur 600 aurait cassé la sémantique de l'échelle de graisses et dépassait le
  périmètre de la tâche. Le passage des `font-bold` inline vers `font-semibold` est un
  chantier de design à part.
- **`fonts.css` est généré** : l'en-tête du fichier le signale, toute modification manuelle
  serait écrasée au prochain build.

## Problèmes rencontrés

- **fontTools et brotli absents** de l'environnement → installés via pip ; le prérequis est
  documenté dans le docstring de `scripts/build-fonts.py` et dans `CLAUDE.md`.
- **Poids des faces complètes** (3,7 Mo) → résolu par le découpage `unicode-range` décrit
  plus haut.

## Vérifications

- `npm run build` : OK
- `npm run lint` : 15 erreurs, toutes préexistantes (`react-refresh/only-export-components`
  dans les fichiers shadcn) — aucune introduite par cette session
- Rendu navigateur : `getComputedStyle(document.body).fontFamily` renvoie bien
  `"Google Sans", …`, 4 faces chargées, 56 `@font-face` présents dans le CSS buildé,
  les 56 woff2 copiés dans `dist/fonts/`

## Audit post-intégration (même session)

Une passe de vérification a été demandée après le premier commit, suite à des affichages
« un peu bizarres ». Deux défauts réels ont été trouvés et corrigés.

### Défaut 1 — flèches `→` / `←` en fallback système (visible)

La plage `latin` de Google Fonts ne contient que `U+2191` et `U+2193` (flèches haut/bas),
**pas** `U+2190`/`U+2192` (gauche/droite). Ces deux caractères existent pourtant dans
Google Sans : n'étant dans aucune plage déclarée, ils n'étaient jamais téléchargés et
s'affichaient dans la police système au milieu d'un texte en Google Sans.

Rendu concerné : `appeals-panel.tsx:53`, `AdaptiveSlowmodePage.tsx:172` et `:452`.

Correctif : plage `latin` élargie de `U+2191,U+2193` à `U+2190-2193`.

### Défaut 2 — subsets `cyrillic-ext` et `greek-ext` manquants

Seuls 5 des 7 sous-ensembles standards de Google Fonts avaient été générés. Les alphabets
cyrilliques étendus (kazakh, bachkir, slavon — `U+0460-052F`) et le grec polytonique
(`U+1F00-1FFF`) tombaient donc en fallback système, ce qui est plausible sur des pseudos
Discord.

Correctif : ajout de `greek-ext` et `cyrillic-ext`. On passe de 40 à **56 fichiers**
(~716 Ko sur disque), sans changement sur le volume réellement téléchargé.

### Méthode de vérification

1. **Analyse de couverture** — comparaison du `cmap` de la police (3 281 codepoints) avec
   l'union des `unicode-range` déclarés, puis croisement avec tous les caractères non-ASCII
   réellement présents dans `app/src` (55 distincts). C'est ce croisement qui a isolé les
   deux flèches.
2. **Rendu réel via CDP** — `CSS.getPlatformFontsForNode` (Chrome DevTools Protocol) sur une
   page de test, pour lire la police *effectivement* utilisée par glyphe plutôt que de juger
   à l'œil :

| Contenu testé | Police résolue |
|---|---|
| texte latin | Google Sans |
| flèches `→` `←` | Google Sans ✅ *(corrigé)* |
| latin accentué | Google Sans |
| cyrillique | Google Sans |
| cyrillique étendu | Google Sans ✅ *(corrigé)* |
| grec / grec polytonique | Google Sans ✅ *(corrigé)* |
| vietnamien | Google Sans |
| gras 600 | Google Sans **SemiBold** (vraie face, pas de gras synthétique) |
| italique | Google Sans Italic (vraie face) |
| `font-mono` | Liberation Mono (stack système, attendu) |
| hébreu | DejaVu Sans (fallback assumé, hors périmètre) |

### Autres points vérifiés (aucun problème)

- Aucune `font-family` codée en dur dans `app/src`
- Aucun usage de `font-extrabold` / `font-black` (800/900 → auraient été synthétisés)
- Aucun reliquat d'import Inter/Geist
- Les caractères `─` (7 702 occurrences) ne sont que des bannières de commentaires dans le
  code source, jamais rendus
- Les emoji et `⌘`/`⇧` sont absents de Google Sans : fallback système normal et inchangé

### Correctif annexe

`scripts/__pycache__/` avait été committé par inadvertance au premier commit (généré lors de
la génération du CSS). Retiré de l'index et ajouté à un `.gitignore` racine.

## Prochaines étapes suggérées

1. Fournir **Google Sans Mono** (variable 400–700) et rebrancher `--font-mono`.
2. Décider si la convention « 600 comme gras par défaut » doit être appliquée au markup
   existant (remplacement des `font-bold` inline par `font-semibold`).
3. Vérifier le rendu sur les vues denses (tableaux Staff, timeline des Cases) — Google Sans
   a des métriques différentes d'Inter, quelques alignements peuvent demander un ajustement.
4. Ajouter un `Cache-Control: public, max-age=31536000, immutable` sur `/fonts/*` dans la
   configuration Vercel (les noms de fichiers sont stables, pas de hash — à faire seulement
   si les faces ne changent plus).
