# Session 2026-05-25 — Mise à jour de l'intégration Stripe frontend

## Objectif

Aligner le frontend sur les modifications backend de l'implémentation Stripe, en se basant sur `docs/API_ENDPOINTS.md` (section Stripe).

## Problèmes identifiés et corrigés

### 1. `createCheckout` — `guild_id` erroné dans le body

**Avant :** `POST /stripe/create-checkout` envoyait `{ guild_id, plan }`  
**Après :** `POST /stripe/create-checkout` envoie `{ plan }` uniquement

La documentation backend précise que les abonnements Stripe sont liés à l'**utilisateur** (pas au serveur). Le `guild_id` n'est pas un paramètre accepté par cet endpoint.

### 2. `getSubscriptionStatus` — query param `guild_id` inexistant

**Avant :** `GET /stripe/subscription?guild_id=${guildId}`  
**Après :** `GET /stripe/subscription`

L'endpoint retourne le statut premium de l'utilisateur connecté via le cookie de session — aucun paramètre n'est attendu.

### 3. `openBillingPortal` — support du `return_url` optionnel

**Avant :** Appel `POST /stripe/portal` sans body  
**Après :** Accepte un `return_url` optionnel transmis dans le body si fourni

Alignement sur la documentation : `{ "return_url": "..." }` est optionnel mais supporté.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `app/src/services/guilds.ts` | Signature et body de `createCheckout`, `openBillingPortal`, `getSubscriptionStatus` |
| `app/src/pages/PremiumPage.tsx` | Appel de `createCheckout(billingPeriod)` sans `upgradeGuildId` |

## Notes importantes

- La sélection de serveur dans `PremiumPage` reste présente côté UX (le serveur sélectionné est prévu pour le futur ou à des fins d'affichage), mais n'est plus transmis à l'API Stripe.
- L'erreur TypeScript sur `baseUrl` deprecated est préexistante et non liée à ces changements.

## Prochaines étapes suggérées

- Vérifier si la sélection de serveur dans `PremiumPage` doit être conservée ou retirée selon l'évolution produit
- Implémenter `getSubscriptionStatus` dans le `GuildContext` ou un hook dédié si le statut premium user doit être accessible globalement
