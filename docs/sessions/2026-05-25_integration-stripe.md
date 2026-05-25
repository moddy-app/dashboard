# Session 2026-05-25 — Intégration Stripe (issue #9)

## Objectif

Mettre en place le système d'abonnement Stripe avec une page produit dédiée, permettant de lancer un paiement et d'accéder au portail de facturation.

---

## Tâches accomplies

1. Ajout des clés i18n EN + FR pour la page premium (`premium.*`, `pageTitle.premium`)
2. Création de `PremiumPage.tsx` — page produit complète
3. Ajout de la route `/premium` dans `main.tsx`
4. Ajout d'un lien "Moddy Max" stylisé (amber) dans le footer de la sidebar
5. Gestion du breadcrumb `/premium` dans `DashboardPage.tsx`

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `app/src/pages/PremiumPage.tsx` | Créé |
| `app/src/main.tsx` | Modifié — import + route `/premium` |
| `app/src/components/app-sidebar.tsx` | Modifié — entrée Moddy Max dans le footer |
| `app/src/pages/DashboardPage.tsx` | Modifié — breadcrumb `/premium` |
| `app/src/locales/en/translation.json` | Modifié — clés `premium.*` + `pageTitle.premium` |
| `app/src/locales/fr/translation.json` | Modifié — clés `premium.*` + `pageTitle.premium` |

---

## Fonctionnalités ajoutées

### Page `/premium`

- **Toggle mensuel / annuel** : bascule entre les deux périodes de facturation avant le checkout Stripe.
- **Comparaison de plans** : deux cartes côte à côte — Free (désactivé) et Max (amber).
  - Free : 3 fonctionnalités de base (modules standard, limites IA standard, support communautaire)
  - Max : 7 fonctionnalités premium (personnalisation bot, jusqu'à 5 serveurs, app perso, IA augmentée, accès anticipé, rôle premium, support prioritaire)
- **Section upgrade serveur** : sélecteur de serveur (peuplé depuis `GuildContext.guilds`) + bouton "Upgrade to Max" → `POST /stripe/create-checkout` → redirect vers Stripe Checkout.
- **Section portail de facturation** : bouton "Manage subscription" → `POST /stripe/portal` → ouvre le portail Stripe dans un nouvel onglet.
- **Détection premium** : si le serveur actuellement chargé est déjà premium (`guildDetail.attributes.PREMIUM` ou `stats.is_premium`), le bouton d'upgrade affiche "Already on Max" (désactivé).

### Sidebar

- Nouvelle entrée "Moddy Max" avec `CrownIcon` dans le footer, stylisée en amber.
- Marquée active quand on est sur `/premium`.

### Breadcrumb

- Route `/premium` → breadcrumb "Dashboard > Moddy Max".

---

## Technologies utilisées

- `createCheckout(guildId, plan)` — déjà présent dans `services/guilds.ts`
- `openBillingPortal()` — déjà présent dans `services/guilds.ts`
- Composants shadcn/ui : `Card`, `Button`, `Badge`, `Select`, `Separator`, `Avatar`
- i18next / react-i18next pour toutes les chaînes

---

## Notes importantes

- Les services Stripe (`createCheckout`, `openBillingPortal`, `getSubscriptionStatus`) étaient déjà implémentés dans `services/guilds.ts` depuis une session précédente.
- Le portal Stripe s'ouvre dans un nouvel onglet (`window.open`) — ne pas faire de `window.location.href` pour le portal car l'utilisateur doit pouvoir revenir au dashboard.
- Le checkout redirige dans le même onglet (`window.location.href`) car Stripe gère lui-même les retours via `success_url` / `cancel_url` configurés côté backend.
- Le statut premium des serveurs non chargés n'est pas vérifié (évite les appels API supplémentaires) — seul le serveur actuellement sélectionné dans `GuildContext` est contrôlé.

---

## Prochaines étapes suggérées

- Configurer les URLs de retour Stripe (`success_url` / `cancel_url`) côté backend pour rediriger vers la page `/premium` avec un message de confirmation.
- Afficher un badge "Max" sur les serveurs premium dans le sélecteur de la page.
- Gérer le retour post-paiement (paramètre `?success=true` dans l'URL) pour afficher une confirmation à l'utilisateur.
