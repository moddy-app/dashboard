# Session 2026-07-11 — Refonte design de la vue d'ensemble serveur

Session de nuit « carte blanche » sur le design. Objectif : élever le rendu visuel des
surfaces principales du dashboard (page d'accueil d'un serveur, sélection de serveur) sans
casser le langage visuel existant (Tailwind + shadcn/ui, OKLch, radius 0.875rem).

## Fichiers modifiés

- `app/src/lib/auth.ts` — nouveau helper `getGuildBannerUrl()`
- `app/src/pages/GuildOverviewPage.tsx` — hero serveur + cartes modules + cartes stats
- `app/src/pages/GuildSelectionView.tsx` — harmonisation du survol des cartes serveur

## Améliorations

### 1. Hero serveur (bannière) — `GuildOverviewPage`

L'ancien en-tête (avatar `size-16` + nom sur fond nu) est remplacé par un **hero façon
profil Discord** :

- **Bandeau** en haut de la carte (`h-24` mobile / `h-32` desktop) :
  - si le serveur possède une bannière Discord (`guildDetail.banner`), elle est affichée en
    `object-cover` via le nouveau `getGuildBannerUrl()` ;
  - sinon, **dégradé de marque** (mesh de radial-gradients bleu → violet en OKLch, cohérent
    avec `--primary` / `--chart-*`) — la surface paraît toujours intentionnelle, jamais vide.
  - Un scrim `bg-gradient-to-t from-card via-card/10 to-transparent` fond le bas du bandeau
    dans la carte pour garantir la lisibilité du contenu placé en dessous (vérifié en clair
    et sombre, bannière réelle et dégradé).
- **Avatar** agrandi (`size-20`/`size-24`), coins `rounded-2xl`, `ring-4 ring-card` pour le
  détourer proprement, chevauchant le bas du bandeau (`-mt-11`/`-mt-12`).
- Nom en `text-xl sm:text-2xl tracking-tight`, badges (vérifié / Moddy Max / niveau de boost
  / Beta / Blacklisted) et infos secondaires (description, vanity URL, boosts) **inchangés**
  dans leur logique — seul le contenant change.
- Robustesse : `onError` masque l'`img` si la bannière ne charge pas (dégradation vers la
  carte, cas rare d'un hash invalide).

### 2. Cartes de modules — `GuildOverviewPage`

- **Correction sémantique** : le lien « Configure » utilisait `ExternalLinkIcon` (icône de
  lien externe) alors qu'il s'agit d'une navigation interne. Remplacé par `ArrowRightIcon`
  qui glisse au survol (`group-hover:translate-x-0.5`).
- **État actif visible** : la pastille d'icône du module prend un accent primaire
  (`bg-primary/10 text-primary`) quand le module est activé, reste `bg-muted` sinon — l'état
  se lit au premier coup d'œil, en plus du badge.
- Icône `size-9 rounded-xl` (au lieu de `size-7 rounded-md`), survol de carte
  `hover:border-primary/30 hover:shadow-sm`, description avec hauteur minimale
  (`min-h-[2.5rem]`) pour aligner les cartes de la grille.

### 3. Cartes de stats — `GuildOverviewPage`

- Survol cohérent ajouté (`hover:border-primary/20`).

### 4. Cartes de serveur — `GuildSelectionView`

- Survol harmonisé avec les cartes de modules (`hover:border-primary/30 hover:shadow-sm` au
  lieu de l'inversion `hover:bg-accent`), padding resserré (`p-6` → `p-5`), flèche qui glisse
  à l'entrée (`-translate-x-1 → 0`). Carte « Ajouter Moddy » alignée.

## Vérification

- Un **harness de prévisualisation** (mock de `GuildContext` + shell sidebar réel) a été monté
  temporairement dans le scratchpad pour rendre les vues authentifiées via Playwright/Chromium
  (l'app est protégée par OAuth Discord, non testable en direct dans le sandbox). Rendu vérifié
  en thèmes clair **et** sombre, avec bannière réelle (image injectée) **et** dégradé de repli.
  Le harness a été retiré ; aucun fichier de preview ni export temporaire n'est resté dans le
  diff.
- `tsc -b`, `eslint` et `npm run build` passent sans erreur.

## Notes

- `getGuildBannerUrl(guildId, hash, size=960)` suit la même convention que `getGuildIconUrl`
  (gestion du préfixe `a_` pour les bannières animées → `.gif`).
- Aucune clé i18n ajoutée (les libellés existants sont réutilisés tels quels).

## Prochaines étapes suggérées

- Étendre le langage « hero + pastilles accentuées » aux pages de modules et à la vue Premium
  (non prévisualisables ici faute d'accès réseau backend).
- Envisager un état de survol/lightbox sur la bannière du hero.
