# Session : Dashboard Layout avec Sidebar et Command Menu

**Date** : 2026-02-22
**Objectif** : Implémenter le layout principal du dashboard avec sidebar, navigation et palette de commandes

## Tâches accomplies

1. Installation des composants shadcn/ui manquants (sidebar, breadcrumb, command, collapsible, avatar, tooltip, dialog, skeleton, sheet)
2. Création des composants de navigation sidebar (team-switcher, nav-main, nav-projects, nav-user, app-sidebar)
3. Création du composant CommandMenu (palette de commandes avec ⌘K)
4. Création de la page DashboardPage avec layout sidebar + breadcrumb + placeholders
5. Mise à jour de HomePage pour afficher DashboardPage quand l'utilisateur est authentifié
6. Ajout du TooltipProvider dans main.tsx (requis par le composant sidebar)
7. Ajout des traductions i18n (EN/FR) pour les clés dashboard
8. Mise à jour de CLAUDE.md

## Fichiers créés

- `app/src/components/app-sidebar.tsx` — Sidebar principale assemblant tous les sous-composants
- `app/src/components/team-switcher.tsx` — Sélecteur de serveur/équipe
- `app/src/components/nav-main.tsx` — Navigation principale avec sous-menus collapsibles
- `app/src/components/nav-projects.tsx` — Navigation des projets/raccourcis
- `app/src/components/nav-user.tsx` — Profil utilisateur en footer de sidebar
- `app/src/components/command-menu.tsx` — Palette de commandes globale
- `app/src/pages/DashboardPage.tsx` — Page dashboard avec layout complet

## Fichiers modifiés

- `app/src/pages/HomePage.tsx` — Remplace le contenu statique par `<DashboardPage>` quand authentifié
- `app/src/main.tsx` — Ajout de `<TooltipProvider>` wrapper
- `app/src/locales/en/translation.json` — Ajout des clés `dashboard.*`
- `app/src/locales/fr/translation.json` — Ajout des clés `dashboard.*`
- `docs/CLAUDE.md` — Mise à jour composants, pages, structure

## Composants shadcn/ui installés

- `sidebar` (+ dépendances : sheet, skeleton, use-mobile hook)
- `breadcrumb`
- `command` (+ dépendance : cmdk)
- `collapsible`
- `avatar`
- `tooltip`
- `dialog`

## Architecture du dashboard

```
HomePage (auth guard)
└── DashboardPage
    ├── SidebarProvider
    │   ├── AppSidebar
    │   │   ├── SidebarHeader → TeamSwitcher
    │   │   ├── SidebarContent
    │   │   │   ├── NavMain (collapsible menu items)
    │   │   │   └── NavProjects (quick links)
    │   │   ├── SidebarFooter → NavUser (avatar + dropdown)
    │   │   └── SidebarRail
    │   └── SidebarInset
    │       ├── Header (SidebarTrigger + Breadcrumb)
    │       └── Content (placeholder cards)
    └── CommandMenu (⌘K dialog)
```

## Fonctionnalités

- **Sidebar collapsible** : mode icon (3rem) ou expanded (16rem), toggle via bouton ou ⌘B
- **Sidebar responsive** : Sheet/drawer sur mobile, sidebar fixe sur desktop
- **Team switcher** : Sélection de serveur avec dropdown
- **Navigation collapsible** : Menus avec sous-items (Dashboard, Moderation, Bot Settings, Documentation, Settings)
- **User profile** : Avatar + nom + email en bas de sidebar, dropdown avec options (Command Menu, Account, Billing, Notifications, Logout)
- **Command palette** : Ouverte via dropdown user → "Command Menu" ou raccourci ⌘K
- **Logout** : Via dropdown user, appelle `logout()` puis recharge la page

## Technologies utilisées

- shadcn/ui (sidebar, breadcrumb, command, dialog, collapsible, avatar, tooltip, dropdown-menu)
- cmdk (Command Menu primitives)
- Radix UI (primitives headless)
- react-i18next (traductions)
- lucide-react (icônes)

## Notes importantes

- Le contenu du dashboard est actuellement en placeholder (rectangles gris `bg-muted/50`)
- Les données de navigation (navMain, projects, teams) sont en dur dans `app-sidebar.tsx` — à dynamiser plus tard
- Le CommandMenu contient des items placeholder (Calendar, Emoji, Calculator, Profile, Billing, Settings)
- Le TooltipProvider est maintenant au niveau racine dans main.tsx

## Prochaines étapes

- Remplir le contenu du dashboard avec des vraies données (stats, graphiques, etc.)
- Dynamiser la navigation sidebar selon les permissions/serveur sélectionné
- Ajouter le theme switcher (dark/light mode)
- Connecter les items du command menu à de vraies actions
- Ajouter des pages pour chaque section de navigation (Moderation, Bot Settings, etc.)
