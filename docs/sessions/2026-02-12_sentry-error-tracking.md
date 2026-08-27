# Session : Intégration Sentry Error Tracking

## Informations
- **Date** : 2026-02-12
- **Objectif** : Intégrer Sentry pour la gestion et le suivi des erreurs en production

## Tâches accomplies

1. **Installation de `@sentry/react`** dans le dossier `app/`
2. **Initialisation de Sentry dans `main.tsx`** — avant le rendu de l'app (best practice)
3. **Ajout d'une section Sentry dans la DebugPage** (`/debug`) avec :
   - Affichage du DSN et du statut d'initialisation
   - Bouton "Throw Test Error" pour tester la capture d'erreurs
   - Bouton "Send Test Message" pour envoyer un message de test via `Sentry.captureMessage()`
4. **Mise à jour de `docs/CLAUDE.md`** — stack, statut, nouvelle section Monitoring

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `app/package.json` | Ajout de `@sentry/react` dans les dépendances |
| `app/src/main.tsx` | Import et initialisation de Sentry avant le rendu |
| `app/src/pages/DebugPage.tsx` | Import Sentry + nouvelle section "Sentry Error Tracking" |
| `docs/CLAUDE.md` | Stack, statut de dev, section Monitoring & Error Tracking |

## Documentation technique

### Initialisation Sentry

```typescript
// main.tsx — initialisé AVANT createRoot()
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: "https://68314945d5389aff0aae69966e2e46fb@o4510617959202816.ingest.de.sentry.io/4510875563196496",
  sendDefaultPii: true,
})
```

### Fonctionnalités Sentry actives
- **Capture automatique** des erreurs JavaScript non gérées
- **sendDefaultPii** : collecte les IP et données utilisateur
- **Debug Panel** : section dédiée dans `/debug` pour tester

### Section Debug Panel
- **DSN** affiché via `Sentry.getClient()?.getDsn()?.toString()`
- **Statut** vérifié via `Sentry.getClient()`
- **Test Error** : `throw new Error(...)` (capture automatique)
- **Test Message** : `Sentry.captureMessage(...)` (envoi manuel)

## Technologies utilisées
- `@sentry/react` — SDK Sentry pour React

## Notes importantes
- Le DSN est en dur dans `main.tsx` (pas dans les variables d'environnement) conformément aux instructions Sentry
- `sendDefaultPii: true` est activé — les données PII (IP, etc.) sont envoyées à Sentry
- Les source maps ne sont pas uploadées (étape optionnelle mentionnée dans la doc Sentry)

## Prochaines étapes suggérées
- **Source maps** : Configurer l'upload des source maps pour un meilleur debugging en production
- **Error Boundary** : Ajouter `Sentry.ErrorBoundary` autour de l'app ou de sections critiques
- **Performance** : Activer le tracing Sentry (`tracesSampleRate`) pour le monitoring de performance
- **Environment** : Configurer `environment` et `release` dans `Sentry.init()` pour mieux filtrer les erreurs
