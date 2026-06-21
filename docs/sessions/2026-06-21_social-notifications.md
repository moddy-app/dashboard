# Session 2026-06-21 — Module Social Notifications

## Objectif
Intégrer côté dashboard le nouveau module **Social Notifications** : suivi de comptes
sociaux (YouTube, Twitch, Bluesky, RSS ; Instagram réservé) avec publication d'une
notification Discord à chaque nouvelle publication.

## Tâches accomplies
- Types TypeScript du module (config globale + abonnements + payloads create/update + résultat résolu).
- Métadonnées par plateforme (couleur de marque, support avatar/média, placeholders, état désactivé).
- Services API (liste, ajout synchrone, PATCH partiel, suppression).
- Page de configuration complète avec liste, dialog ajout/édition, pause/reprise, suppression confirmée.
- Gestion du quota par plateforme (1 free / 5 premium) avec désactivation du bouton + upsell.
- Éditeur de message (max 1500) avec cheat-sheet de placeholders filtré par plateforme.
- Couleur d'embed (couleur de marque par défaut ou personnalisée) + toggles avatar/média conditionnels.
- Mapping des codes d'erreur backend vers des messages clairs (limites, handle_not_found, bot_timeout, etc.).
- Enregistrement : route, item sidebar, carte sur la page Overview, traductions EN + FR.

## Fichiers créés
- `app/src/lib/social-platforms.ts` — métadonnées plateformes + conversion hex/int.
- `app/src/pages/modules/SocialNotificationsPage.tsx` — page principale, ligne d'abonnement, formulaire.
- `docs/sessions/2026-06-21_social-notifications.md` — ce document.

## Fichiers modifiés
- `app/src/types/api.ts` — types `Social*`, ajout de `social_notifications` à `ModuleId` et `ModuleConfig`.
- `app/src/services/guilds.ts` — `getSocialSubscriptions`, `addSocialSubscription`, `updateSocialSubscription`, `deleteSocialSubscription`.
- `app/src/main.tsx` — route `servers/:guildId/modules/social_notifications`.
- `app/src/components/app-sidebar.tsx` — item de navigation du module.
- `app/src/pages/GuildOverviewPage.tsx` — carte module dans la grille.
- `app/src/locales/en/translation.json` & `fr/translation.json` — bloc `modules.social_notifications`.
- `CLAUDE.md` — statut + date de mise à jour.

## Notes techniques
- **Snowflakes** : `channel_id` et `mention_role_ids` sont envoyés en **string** dans les
  payloads. Pydantic coerce string → int sans perte de précision (un `Number()` JS
  arrondirait au-delà de 2^53). Le helper `api()` reconvertit déjà les grands entiers
  des réponses en string.
- **Ajout synchrone** : `POST /subscriptions` attend la réponse du bot (~2-12 s) ; la
  carte est construite avec le `display_name`/`avatar_url`/`target_id` résolus. Un
  spinner est affiché pendant l'appel. Un reload récupère le vrai `id` de DB.
- **Config globale vs abonnements** : le toggle d'activation passe par le endpoint
  générique des modules (`updateModule`/`disableModule` du `GuildContext` avec
  `{ enabled, default_message }`) ; les abonnements ont leurs endpoints dédiés.
- **Pluriels i18next v25** (JSON v4) : clés `rolesCount_one` / `rolesCount_other`.

## Prochaines étapes suggérées
- Aperçu live de l'embed de notification dans le formulaire.
- Combobox avec recherche pour les salons/rôles sur les serveurs volumineux.
- Affichage du `poll_interval` résolu (cadence de vérification) sur chaque carte.
