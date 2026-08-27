# Session 2026-02-23 — Système de notifications

## Objectif
Intégrer un système de notifications complet avec un panneau responsive (Drawer sur mobile, Dialog sur desktop) déclenché depuis la sidebar footer et le command menu.

## Tâches accomplies

1. **Installation du composant Drawer shadcn/ui** (`vaul` sous le capot)
2. **Création du hook `use-media-query`** — hook React SSR-safe pour réagir aux media queries
3. **Définition des types TypeScript** pour les notifications
4. **Création des données d'exemple** (5 notifications avec différents niveaux de criticité)
5. **Création du composant `NotificationDrawer`** responsive et entièrement i18né
6. **Branchement des boutons existants** (nav-user dropdown, command menu, nouveau bouton sidebar footer)
7. **Gestion de l'état dans `DashboardPage`** (open/close, mark read, mark all read)
8. **Mise à jour des fichiers i18n** (EN + FR)
9. **Mise à jour de `CLAUDE.md`**

## Fichiers créés

| Fichier | Description |
|---------|-------------|
| `app/src/components/ui/drawer.tsx` | Composant shadcn/ui Drawer (vaul) |
| `app/src/hooks/use-media-query.ts` | Hook media query SSR-safe |
| `app/src/types/notification.ts` | Types TypeScript des notifications |
| `app/src/data/notifications.ts` | 5 notifications d'exemple |
| `app/src/components/notification-drawer.tsx` | Composant panneau de notifications responsive |

## Fichiers modifiés

| Fichier | Changements |
|---------|------------|
| `app/src/components/nav-user.tsx` | Ajout prop `onOpenNotifications`, branchement du dropdown item |
| `app/src/components/command-menu.tsx` | Ajout prop `onOpenNotifications`, branchement du command item |
| `app/src/components/app-sidebar.tsx` | Ajout prop `onOpenNotifications`, nouveau bouton Bell dans footer, propagation à NavUser |
| `app/src/pages/DashboardPage.tsx` | État drawer + state notifications, handlers mark read/all, rendu NotificationDrawer |
| `app/src/locales/en/translation.json` | Clés `notifications.*` + `sidebar.notifications` |
| `app/src/locales/fr/translation.json` | Clés `notifications.*` + `sidebar.notifications` |
| `docs/CLAUDE.md` | Mise à jour composants, hooks, statut |

## Architecture technique

### Type `Notification`
```typescript
interface Notification {
  id: string
  title: string
  content: string
  sender: { name: string; avatar?: string }
  criticality: 'info' | 'success' | 'warning' | 'critical'
  timestamp: Date
  read: boolean
  actions?: Array<{ label: string; href?: string; variant?; onClick?() }>
}
```

### Pattern responsive (Dialog/Drawer)
- **≥ 768px (desktop)** → `Dialog` centré (max-w-lg, scrollable)
- **< 768px (mobile)** → `Drawer` depuis le bas (max-h-90dvh, scrollable)
- Détection via `useMediaQuery("(min-width: 768px)")`

### Points d'entrée
- Bouton Bell dans la sidebar footer (nouveau)
- Item "Notifications" dans le dropdown NavUser (existant, désormais branché)
- Item "Notifications" dans le CommandMenu ⌘K (existant, désormais branché)

### Gestion de l'état
L'état est centralisé dans `DashboardPage` :
- `notifications: Notification[]` initialisé avec `EXAMPLE_NOTIFICATIONS`
- `handleMarkRead(id)` — marque une notification comme lue
- `handleMarkAllRead()` — marque toutes les notifications comme lues
- `notificationDrawerOpen` — contrôle l'ouverture du panneau

## Données d'exemple (à remplacer par l'API)
5 notifications de démonstration couvrant tous les niveaux :
1. **warning** — Maintenance programmée (Équipe Moddy)
2. **critical** — Connexion suspecte (Sécurité Moddy)
3. **success** — Nouvelle fonctionnalité rapports (Équipe Moddy)
4. **info** — Rapport hebdomadaire serveur (Community Hub, déjà lue)
5. **warning** — Utilisateur signalé (Gaming Zone, déjà lue)

## Notes importantes

- Les données `EXAMPLE_NOTIFICATIONS` sont dans `src/data/notifications.ts` — à remplacer par un appel API lors de l'intégration backend
- Le hook `use-media-query` est SSR-safe (retourne `false` si `window` est indéfini)
- La criticité `critical` utilise la couleur `destructive` du design system (cohérence)
- Les actions avec `href` s'ouvrent dans un nouvel onglet (`target="_blank"`, `rel="noopener noreferrer"`)
- TypeScript strict : aucune erreur de typage (`tsc --noEmit` : clean)

## Prochaines étapes suggérées

1. **Intégration backend** : Remplacer `EXAMPLE_NOTIFICATIONS` par un hook `useNotifications()` qui appelle l'API
2. **Badge de compteur non-lu** sur le bouton Bell dans la sidebar (indicateur visuel)
3. **Persistance du state** "lu/non-lu" via l'API
4. **Temps réel** : WebSocket ou polling pour les nouvelles notifications
5. **Notifications push** (browser notifications API) en option
