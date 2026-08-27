# Session 2026-05-16 — Fixes UI/UX majeurs

## Objectif

Passe complète de corrections UI/UX sur le Moddy Dashboard : design, navigation, comportement des formulaires, typographie, et lint.

## Tâches accomplies

### 1. Typographie — Google Sans

- Remplacé la police Geist par **Google Sans** (body) et **Google Sans Code** (monospace)
- Ajout des balises `<link>` Google Fonts dans `index.html`
- Mise à jour des variables `--font-sans` et `--font-mono` dans `index.css`

### 2. Settings dialog

- Supprimé la section badges Discord (ancienne lecture de `user.discord_badges`)
- Supprimé le badge Nitro (`getNitroLabel`)
- Corrigé l'icône Discord : conteneur `size-8 rounded-lg` au lieu de `size-6 rounded-full`
- Ajouté un indicateur "Connecté" (point vert + label)
- Ajouté badge "Staff" rouge si `user.is_staff`
- Ajout clé i18n `settings.account.connected` (EN + FR)

### 3. Navigation Staff Panel

- Supprimé le lien "Staff Panel" du menu dropdown `NavUser`
- Ajouté le Staff Panel dans la palette de commandes (`CommandMenu`) : visible uniquement si `isStaff`
- Passage de `isStaff` et `onNavigateToStaff` depuis `DashboardPage`

### 4. StaffPage — suppression des Tabs internes

- Supprimé `<Tabs>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` (la sidebar gère déjà la navigation par `?tab=`)
- Remplacé par rendu conditionnel direct selon `searchParams.get('tab')`
- Supprimé l'en-tête redondant (titre + icône)
- Corrigé le breadcrumb dans `DashboardPage` pour afficher le nom de l'onglet actif

### 5. GuildOverviewPage

- Avatar du serveur : `rounded-2xl` → `rounded-xl`
- Supprimé le bouton Refresh (déplacé dans la sidebar)
- `ModuleCard` : restructuré pour `<CardContent className="p-4">` avec `CardHeader` supprimé → padding uniforme + gap titre/description réduit
- Premium card : couleurs subtiles `border-amber-300/50 bg-amber-50/40` au lieu du fond plein
- Corrigé un `</div>` en trop qui causait une erreur de parsing ESLint

### 6. AppSidebar — bouton Refresh

- Déplacé le bouton de rafraîchissement des données de guild dans le footer de la sidebar
- Affiché uniquement quand `selectedGuildId` est défini et qu'on n'est pas sur la page staff

### 7. Pages modules (Starboard, AutoRole, WelcomeChannel, Logging)

- Supprimé `max-w-2xl mx-auto` → layout pleine largeur left-aligned
- Supprimé la Card "Activer/Désactiver le module" (actif = a une config, inactif = pas de config)
- Supprimé le `Badge` dans les en-têtes de page
- Supprimé la branche `if (!values.enabled) { disableModule... }` dans `onSubmit` (Starboard, WelcomeChannel)
- **StarboardPage** : champ emoji amélioré (`w-20 text-xl text-center`, `inputMode="text"`, placeholder `⭐`)

### 8. UnsavedBar — refonte complète

- **Page shake** : animation appliquée sur `#root` via classe CSS `page-shake` (pas la popup)
- **Pas de drift** : la popup reste centrée via `style={{ transform: "translateX(-50%)" }}` permanent
- **Annuler = rester sur la page** : `blocker.reset()` au lieu de `blocker.proceed()` dans `handleDiscard`
- **Re-shake** : `blocker.location` comme 2ème dépendance de l'effect → chaque nouvelle tentative de navigation re-déclenche le shake
- **Icône** : `TriangleAlertIcon` en `text-primary` (plus visible que amber)
- **Boutons** : `whitespace-nowrap` pour éviter la troncature du texte "Enregistrer"
- **Highlight sans state** : remplacé `useState(false)` par manipulation directe de classe DOM via `barRef` → élimine l'erreur ESLint "setState in effect"

### 9. Lint — corrections

- `auth.ts` : regex `[:\[,]` → `(?::|,|\[)` pour supprimer l'escape inutile `\[`
- `GuildOverviewPage.tsx` : supprimé `CardHeader` importé mais inutilisé
- `StarboardPage.tsx` : supprimé `Switch` et `Badge` inutilisés

## Fichiers modifiés

| Fichier | Nature du changement |
|---------|---------------------|
| `app/index.html` | Google Fonts preconnect + link |
| `app/src/index.css` | Variables font, animation page-shake |
| `app/src/components/settings-dialog.tsx` | Suppression badges, fix icône Discord, badge Staff |
| `app/src/components/nav-user.tsx` | Suppression lien Staff Panel |
| `app/src/components/command-menu.tsx` | Ajout Staff Panel, props isStaff/onNavigateToStaff |
| `app/src/components/app-sidebar.tsx` | Bouton refresh dans footer |
| `app/src/components/unsaved-bar.tsx` | Refonte complète (shake, drift, cancel, highlight) |
| `app/src/pages/DashboardPage.tsx` | Breadcrumb staff, passage props CommandMenu |
| `app/src/pages/StaffPage.tsx` | Suppression Tabs internes |
| `app/src/pages/GuildOverviewPage.tsx` | Avatar radius, refresh supprimé, ModuleCard, premium card |
| `app/src/pages/modules/StarboardPage.tsx` | Layout full-width, no enable toggle, emoji field |
| `app/src/pages/modules/AutoRolePage.tsx` | Layout full-width, no enable toggle |
| `app/src/pages/modules/WelcomeChannelPage.tsx` | Layout full-width, no enable toggle |
| `app/src/pages/modules/LoggingPage.tsx` | Layout full-width, no enable toggle |
| `app/src/locales/en/translation.json` | Ajout `settings.account.connected` |
| `app/src/locales/fr/translation.json` | Ajout `settings.account.connected` |
| `app/src/lib/auth.ts` | Fix regex useless escape |

## Décisions techniques

- **Shake sur `#root` pas sur `body`** : les éléments `position: fixed` sont positionnés relativement à leur ancêtre transformé. En appliquant le transform sur `#root`, la popup fixe reste à sa position car elle n'est pas enfant de `#root` dans le stacking context. Cela évite le drift sans changer la structure DOM.
- **Highlight via DOM class** : utiliser `barRef.current.classList` au lieu de `useState` évite le problème d'appel de `setState` dans un `useEffect` (erreur ESLint custom rule).
- **`blocker.location` comme dépendance** : chaque tentative de navigation bloquée génère un nouveau `location` object → l'effect se re-déclenche même si `blocker.state` reste `"blocked"`.

## Prochaines étapes suggérées

- Vérifier le padding des cartes serveur dans `GuildSelectionView` (padding inégal signalé)
- Tester le comportement de la UnsavedBar sur mobile (responsive)
- Ajouter des traductions manquantes si nécessaire
