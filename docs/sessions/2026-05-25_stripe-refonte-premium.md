# 2026-05-25 — Stripe : refonte page premium et intégration facturation

## Objectif

Refondre l'expérience premium/Stripe : supprimer la page de présentation des plans, la remplacer par une redirection directe vers Stripe Checkout, gérer les retours avec des toasts Sonner, et exposer le portail Stripe depuis le menu compte et les paramètres.

## Tâches accomplies

1. **Suppression de la page premium existante** — la page avec les plans Free/Max, FeatureRow, sélecteur de serveur, etc. a été entièrement supprimée.
2. **Nouvelle PremiumPage — page de redirection** — lit les query params et agit en conséquence :
   - `/premium?monthly` → lance le checkout Stripe avec `plan: "monthly"`
   - `/premium?yearly` → lance le checkout Stripe avec `plan: "yearly"`
   - `/premium?premium=success` → toast de succès + redirect vers `/`
   - `/premium?premium=cancel` → toast info "Paiement annulé" + redirect vers `/`
3. **return_url dynamique** — `createCheckout` calcule `return_url = window.location.origin + '/premium'` automatiquement (compatible multi-domaines).
4. **openBillingPortal** — signature simplifiée, utilise `window.location.href` comme return_url automatiquement.
5. **nav-user.tsx** — bouton "Facturation" ouvre directement le portail Stripe (avec état de chargement).
6. **command-menu.tsx** — prop `onOpenBilling` ajouté, l'item "Facturation" déclenche le portail Stripe.
7. **DashboardPage.tsx** — handler `handleOpenBilling` ajouté et passé au CommandMenu.
8. **Traductions** — clés `premium.toast.*` ajoutées en EN et FR.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/pages/PremiumPage.tsx` | Réécriture complète — page de redirection |
| `app/src/services/guilds.ts` | `createCheckout` + `openBillingPortal` avec return_url auto |
| `app/src/components/nav-user.tsx` | Bouton Facturation → portail Stripe |
| `app/src/components/command-menu.tsx` | Prop `onOpenBilling`, item Facturation fonctionnel |
| `app/src/pages/DashboardPage.tsx` | Handler `handleOpenBilling` + passage au CommandMenu |
| `app/src/locales/en/translation.json` | Clés `premium.toast.*` |
| `app/src/locales/fr/translation.json` | Clés `premium.toast.*` |

## Fonctionnement technique

### Flow nouvel abonnement
1. Depuis n'importe où, on navigue vers `/premium?monthly` ou `/premium?yearly`
2. `PremiumPage` détecte le param et appelle `createCheckout(plan)`
3. Le service envoie `POST /stripe/create-checkout` avec `{ plan, return_url: window.location.origin + '/premium' }`
4. Le backend construit `success_url = return_url + '?premium=success'` et `cancel_url = return_url + '?premium=cancel'`
5. Le frontend reçoit l'URL Stripe et redirige avec `window.location.href = url`
6. Après paiement, Stripe redirige vers `/premium?premium=success` (ou cancel)
7. `PremiumPage` affiche le toast approprié et redirige vers `/`

### Flow portail de facturation
1. Clic sur "Facturation" dans le menu compte ou le command menu
2. Appel `POST /stripe/portal` avec `{ return_url: window.location.href }`
3. Redirect vers le portail Stripe, retour à la page actuelle

## Décisions prises

- La présentation des features premium sera faite sur une autre page plus tard (pas dans `/premium`)
- Le toast d'annulation utilise `toast.info` (pas `toast.error`) car ce n'est pas une erreur
- `openBillingPortal` n'accepte plus de paramètre external, le return_url est toujours automatique
