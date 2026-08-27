# Session 2026-07-06 — Refonte de l'affichage des cases

## Objectif
Retravailler en profondeur le design de l'affichage des cases (liste + vue détail)
selon les règles de design de base : normalisation, suppression des redondances,
meilleure ergonomie, système de filtres avancé.

## Tâches accomplies

### Part 1 — Liste des cases

**Barre d'outils (nouvelle disposition)**
- Barre de recherche conservée, désormais **branchée sur le paramètre serveur `?q=`**
  (recherche texte libre sur `reference` + `reason`), avec debounce 350 ms.
- Retrait des anciens selects de filtres (statut / action).
- Ajout de boutons **icône seule + tooltip** (variant outline, non-primaires) :
  - Rafraîchir (`refresh-cw`) — recharge les cases (spinner pendant le chargement).
  - Filtres (`list-filter`) — ouvre le menu des filtres disponibles ; devient **bleu**
    (accent distinct du bouton primaire) quand au moins un filtre est renseigné.
  - Sélection multiple (`check-square` / `x`) — active/désactive le mode masse.
- Bouton « nouveau cas » conservé tel quel.

**Système de filtres (chips bleus façon Linear/Notion)**
- Rangée de labels bleus entre la barre d'outils et la liste.
- Chaque chip : icône + **nom en gras** + `:` + valeur (texte normal) + `chevron-down`.
  Clic → popover d'édition (avec bouton « retirer »).
- Bouton texte `+ Ajouter un filtre` en fin de rangée.
- Filtres disponibles : **Utilisateur** (subject_id), **Auteur** (issuer_id),
  **Statut** (open/closed), **Sanction** (action), **Date** (since/until).
- Le filtre imposé par le périmètre (ex. sujet en vue personnelle) est masqué.
- Ajout d'un filtre → ouvre directement son éditeur ; fermeture sans valeur → retrait
  automatique (règle « rien configuré = supprimé »). Commit synchrone du brouillon ID
  pour éviter toute lecture de state périmé.

**Affichage & interactions**
- **Scroll infini** (IntersectionObserver) : chargement automatique en bas de page.
- Masquage du **type de case quand il est évident** (`showType`) : caché en vue serveur,
  affiché en vue personnelle et staff (global + network + serveur).
- Séparateur (point) retravaillé : vrai point plein `size-1`, marges resserrées (`gap-1.5`).
- **Menu contextuel (clic droit)** sur chaque case : ouvrir, copier la référence,
  copier l'ID du sujet, fermer/rouvrir (staff modérateur).

**Sélection de masse**
- Cases à cocher devant chaque ligne en mode masse.
- La sélection **persiste** à travers recherches et filtres.
- Actions de masse (staff) : rouvrir / fermer, avec **popup d'avertissement** pour
  l'action destructive (fermeture).

### Part 2 — Vue détail

- Suppression des infos **évidentes** selon le contexte : sujet (vue perso), type
  (vue serveur), portée (vue serveur) — pilotés par `showSubject`/`showType`/`showScope`.
- Fin des **labels tout en majuscules** (Sentence case, ex. « Sujet » et non « SUJET »).
- **Section « Preuves » dédiée** (hors activité) : galerie images/vidéos, fichiers,
  cartes « message cité », contexte automod — via `GET /cases/{id}/evidence` + events
  automod. La timeline exclut désormais les events `evidence`.
- Suppression des **séparateurs superflus** dans les encadrés (plus de `divide-y`/`border-b`).
- **Typographie normalisée** dans le panneau latéral (labels `text-xs` muted + icône,
  valeurs `text-sm`).
- Onglet sanctions : correction du **double icône** (icône unique + libellé texte).
- **Boutons « copier » (icône + tooltip)** : référence, ID sujet, ID groupe.

### Navigation
- « Mes sanctions » retiré du pied de la sidebar, **déplacé dans le menu utilisateur**
  (dropdown sur l'avatar) → navigue vers `/cases`.

## Fichiers créés
- `app/src/components/ui/context-menu.tsx` — primitive shadcn (Radix ContextMenu).
- `app/src/components/ui/checkbox.tsx` — primitive shadcn (Radix Checkbox).
- `app/src/components/cases/case-filters.ts` — modèle & helpers de filtres (sans JSX).
- `app/src/components/cases/case-filter-bar.tsx` — chips bleus, éditeurs, menu d'ajout.
- `app/src/components/cases/case-evidence.tsx` — section Preuves.

## Fichiers modifiés
- `app/src/components/cases/case-list.tsx` — refonte complète (toolbar, filtres, scroll
  infini, context menu, sélection de masse).
- `app/src/components/cases/case-detail.tsx` — refonte (panneaux normalisés, preuves,
  copie, labels).
- `app/src/components/cases/case-timeline.tsx` — retrait du rendu des preuves.
- `app/src/components/cases/sanctions-panel.tsx` — dédup icône.
- `app/src/components/cases/cases-browser.tsx` — transmission `showType`/`showScope`/`canModerate`.
- `app/src/services/cases.ts` — `getCaseEvidence()`.
- `app/src/types/cases.ts` — types `CaseEvidence` + `isMessageLink`.
- `app/src/lib/cases.ts` — accents bleus filtres, helper `copyText`.
- `app/src/components/nav-user.tsx` + `app-sidebar.tsx` — déplacement « Mes sanctions ».
- `app/src/pages/StaffPage.tsx` — recherche libre (toutes cases) + `showType`.
- `app/src/pages/MyCasesPage.tsx` — `showType`.
- `app/src/locales/{en,fr}/translation.json` — nouvelles clés `cases.toolbar/filters/mass/row/evidence` + `cases.detail.*`.

## Notes techniques
- Le paramètre `q` du endpoint `GET /cases` (mis à jour côté backend) est utilisé pour la
  recherche textuelle serveur (combinable avec les autres filtres, ET logique).
- `react-refresh/only-export-components` : les helpers non-composants ont été isolés dans
  `case-filters.ts`.
- Composants shadcn ajoutés à la main (réseau `ui.shadcn.com` indisponible) en respectant
  le style du projet (`radix-ui` unifié, `rounded-2xl`, `ring-1 ring-foreground/5`, etc.).

## Vérifications
- `tsc -b --noEmit` ✅, `eslint` ✅, `npm run build` ✅.

## Prochaines étapes suggérées
- Résolution live (aperçu profil) dans l'éditeur des filtres Utilisateur/Auteur.
- Éventuel export CSV en action de masse.
