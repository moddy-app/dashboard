# Session — Page d'accueil « En travaux » + i18n

- **Date** : 2026-07-03
- **Objectif** : Remplacer la page d'accueil par une page « en travaux » minimaliste et soignée, avec internationalisation, thème clair/sombre automatique, logo Moddy officiel et lien vers le support.

## Tâches accomplies

1. Refonte complète de la page d'accueil (`App.tsx`) avec une mise en page en trois zones : **logo en haut à gauche** (header), **contenu encadré dans une carte centrée** (badge de statut animé, titre, description, séparateur, appel à l'action support), et **sélecteur de langue en bas de page** (footer).
2. Mise en place d'un système d'internationalisation (i18n) léger et maison, sans dépendance externe, supportant **4 langues** : anglais, français, espagnol, allemand.
3. Détection automatique de la langue du navigateur + mémorisation du choix (localStorage).
4. Thème clair/sombre **automatique** selon la préférence système (`prefers-color-scheme`), appliqué avant le premier rendu pour éviter tout flash.
5. **Bouton manuel de bascule clair/sombre** (header, en haut à droite) qui surcharge et mémorise le choix par-dessus la préférence système (hook `useTheme`).
6. Intégration du logo Moddy officiel (wordmark) et remplacement du favicon par la marque Moddy bleue.
7. Ajout de la police **Google Sans** (avec repli sur Geist Variable).
8. Lien de support pointant vers `https://moddy.app/support`.
9. Utilisation exclusive d'icônes (lucide-react), aucun emoji.

## Fichiers créés

- `app/src/i18n/translations.ts` — dictionnaires de traduction (en, fr, es, de) + libellés de langues, typés strictement.
- `app/src/i18n/context.ts` — contexte React et type `I18nContextValue`.
- `app/src/i18n/I18nProvider.tsx` — provider : détection de langue, persistance, helper `t()`.
- `app/src/i18n/useTranslation.ts` — hook d'accès à la traduction.
- `app/src/i18n/index.ts` — barrel d'exports du module i18n.
- `app/src/components/Logo.tsx` — composant du logo Moddy (`fill="currentColor"`, thème-aware).
- `app/src/hooks/useTheme.ts` — hook de gestion du thème (bascule manuelle + synchro système).

## Fichiers modifiés

- `app/src/App.tsx` — nouvelle page « en travaux ».
- `app/src/main.tsx` — enveloppe l'app dans `<I18nProvider>`.
- `app/src/index.css` — token de couleur de marque `--brand` (clair/sombre), `--color-brand`, police `--font-sans` avec Google Sans.
- `app/index.html` — préconnexions + feuille de style Google Sans, script de thème auto, titre et meta description.
- `app/public/favicon.svg` — favicon Moddy (marque bleue `#0046F8`).

## Notes techniques

- **i18n maison** choisi plutôt qu'une librairie pour rester minimaliste et éviter d'alourdir le bundle. Les clés sont typées à partir de la source anglaise (`TranslationKey`), garantissant que toutes les langues restent synchronisées.
- **Couleur de marque** : `#0046F8` en thème clair, éclaircie en `#6E90FF` en thème sombre pour la lisibilité sur fond foncé.
- Le module i18n est découpé en plusieurs fichiers pour respecter la règle ESLint `react-refresh/only-export-components` (un fichier `.tsx` n'exporte qu'un composant).

## Vérifications

- `npm run build` : OK.
- `npm run lint` : aucune nouvelle erreur (seules les 4 erreurs préexistantes du repo subsistent).
- Rendu vérifié via Playwright en thèmes clair et sombre, en français, et en viewport mobile.

## Prochaines étapes suggérées

- Ajouter d'autres langues si besoin (il suffit d'étendre `translations.ts`).
- Réactiver le vrai tableau de bord une fois le développement terminé.
