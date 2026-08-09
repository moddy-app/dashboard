# Session 2026-08-09 — Module Bot Customization

## Objectif

Implémenter la page dashboard du module `bot_customization` : personnalisation de
l'apparence de Moddy dans une guilde (pseudo, bio, avatar, bannière, style du pseudo).
Le backend (`api.moddy.app`) était déjà en place — aucun changement côté API.

## Tâches accomplies

1. Types TypeScript du module (état, limites, corps d'écriture, réponse d'upload).
2. Helpers métier : conversion couleurs, règles de slots de couleurs, diff du
   brouillon, validation d'image, mapping des codes d'erreur, état « actif ».
3. Service API : `GET`, `PATCH`, `DELETE`, `POST .../uploads`.
4. Support `multipart/form-data` dans le client `api()` (jusqu'ici toujours JSON).
5. Page complète `/servers/:guildId/modules/bot_customization` avec aperçu du rendu.
6. Câblage : route, entrée de sidebar, carte sur la vue d'ensemble du serveur.
7. Traductions EN + FR (formulaire, aides, confirmations, 21 codes d'erreur).
8. Mise à jour de `CLAUDE.md`.

## Fichiers créés

| Chemin | Rôle |
|---|---|
| `app/src/lib/bot-customization.ts` | Helpers : couleurs, slots, diff, validation image, codes d'erreur |
| `app/src/services/bot-customization.ts` | Appels API du module (dont l'upload multipart) |
| `app/src/pages/modules/BotCustomizationPage.tsx` | Page du module (aperçu + formulaire) |
| `docs/sessions/2026-08-09_module-bot-customization.md` | Ce résumé |

## Fichiers modifiés

| Chemin | Changement |
|---|---|
| `app/src/types/api.ts` | `BotCustomization*` (style, config, limites, état, update, upload) ; `bot_customization` ajouté à `ModuleId` et à l'union `ModuleConfig` |
| `app/src/lib/auth.ts` | `api()` ne force plus `Content-Type: application/json` sur un corps `FormData` |
| `app/src/main.tsx` | Route `servers/:guildId/modules/bot_customization` |
| `app/src/components/app-sidebar.tsx` | Entrée de navigation (icône `PaletteIcon`) |
| `app/src/pages/GuildOverviewPage.tsx` | Carte du module + état « activé » spécifique |
| `app/src/locales/{en,fr}/translation.json` | Bloc `modules.bot_customization` (+ sous-bloc `errors`) |
| `CLAUDE.md` | Description du module dans « Actuellement implémenté » |

## Documentation technique

### Modèle de permission

| Champ | Condition |
|---|---|
| `nickname`, `bio`, `avatar_url`, `banner_url` | guilde **premium** |
| `style` (police / effet / couleurs) | **toujours** |

Le gating vient de la réponse : `is_premium` + `premium_fields` (jamais une liste codée
en dur côté front). Sans premium, les champs premium sont **visibles mais verrouillés**,
avec un bandeau CTA vers `/premium` — et un bouton « Effacer » reste actif sur chaque
champ déjà renseigné : envoyer `null` sur un champ premium est accepté sans premium, une
guilde qui perd le premium doit pouvoir nettoyer.

### Écriture en diff strict

Le `PATCH` (identique au `PUT`) est piloté par la **présence des clés** :

| Cas | Effet |
|---|---|
| clé absente | champ inchangé |
| clé à `null` | champ réinitialisé |
| clé avec valeur | champ appliqué |

`diffDraft()` compare le brouillon à l'état chargé et ne produit que les clés modifiées.
Sérialiser tout le formulaire aurait effacé les champs laissés vides. Corollaire : quand
le diff est vide, il n'y a pas de sauvegarde possible — la barre « modifications non
enregistrées » ne s'affiche même pas, ce qui évite le `422 empty_update`.

### Images

`ImageDraft` a trois états : `keep` (clé absente), `clear` (`null`), `file` (nouvelle
image). **L'upload n'a lieu qu'au moment du save** : l'URL renvoyée par
`POST .../uploads` n'est valable que 15 min, la produire à la sélection du fichier
exposerait à un `image_download_failed` si l'utilisateur laisse le formulaire ouvert.
L'aperçu immédiat passe par `URL.createObjectURL` (URLs révoquées au démontage).

La validation locale (type dans `image_content_types`, taille ≤ `image_max_bytes`) donne
un retour immédiat ; les erreurs serveur restent gérées.

`api()` a dû être adapté : il posait systématiquement `Content-Type: application/json`,
ce qui empêche le navigateur d'écrire le `boundary` du multipart.

### Bio et attribution

Le champ `bio` ne contient **que la partie serveur** (compteur sur `bio_max_length`). Le
bot ajoute lui-même `limits.bio_attribution` en dernière ligne : elle est affichée sous
le champ en aperçu non éditable, rendue (composant `DiscordMarkup`) avec l'emoji animé
`<a:name:id>` en `<img>` CDN et le `**gras**` en `<strong>` — jamais du markup brut, et
jamais incluse dans la valeur envoyée.

### Style du pseudo

Règles rejouées côté client pour éviter l'aller-retour serveur (`colorSlots()`) :

- `effect_id === limits.gradient_effect_id` → **exactement 2 couleurs** ;
- tout autre effet → **exactement 1 couleur** ;
- sans effet → 0 ou 1 couleur.

Changer d'effet réajuste immédiatement la liste (`fitColors()`). Les couleurs sont
manipulées en `#RRGGBB` (le backend normalise) et relues en entiers 24-bit
(`intToHex()`). Un style entièrement vide est envoyé en `style: null` (reset).

Les polices/effets sont rendus depuis `limits.font_ids` / `limits.effect_ids`, avec un
libellé i18n par identifiant (`fonts.<id>` / `effects.<id>`) et un repli générique
« Police n° 7 » : la liste peut bouger côté backend sans toucher au code. Seul le
dégradé est nommé, parce que le backend l'identifie explicitement
(`gradient_effect_id`). Une valeur enregistrée qui ne serait plus proposée reste
affichée en option désactivée plutôt que d'être effacée en silence.

L'aperçu applique les couleurs (une couleur → `color`, dégradé → `background-clip:
text`) ; les polices Discord ne sont pas distribuées, elles ne sont donc pas simulées —
l'aperçu le dit explicitement.

### Erreurs

Le corps d'erreur est toujours `{"error": "<code>"}` et **le code est une clé i18n** :
`botCustomizationErrorCode()` l'extrait, la page le mappe sur
`modules.bot_customization.errors.<code>`. Un code inconnu retombe sur la gestion
générique (`handleSaveError`) — le code nu n'est jamais affiché.

Deux cas particuliers :

- **`bot_timeout` (504)** : la requête **n'est pas rejouée**. La tâche reste dans la file
  du bot et sera appliquée à son redémarrage ; message explicite (toast d'avertissement,
  12 s) invitant à recharger plus tard.
- **`rate_limited` (429)** : limite Discord sur le changement de pseudo/avatar d'un bot —
  message explicite, pas de retry automatique.

### Divers

- `updated_by` est un snowflake 64 bits **en chaîne** : jamais de `Number()`. L'auteur du
  dernier changement est résolu via `useUserProfile` (cache partagé).
- Après une écriture réussie, l'état est **relu via le `GET`** plutôt que déduit de la
  réponse du `PUT` (résultat brut du bot) : l'aperçu récupère ainsi les hashes frais,
  `updated_at`/`updated_by` et `is_premium` dans la forme documentée.
- Les écritures passent par le bot (téléchargement de l'image puis appel Discord,
  timeout serveur 25 s) : le formulaire entier est désactivé pendant l'envoi et la barre
  d'enregistrement affiche un état de chargement.

## Technologies utilisées

React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui (Card, Select, Input, Textarea,
Avatar, AlertDialog, Badge, Button, Label, Skeleton), react-router-dom, react-i18next,
sonner, lucide-react.

## Notes et décisions

- **Aucune donnée codée en dur** : longueurs, types d'image, taille max, polices, effets
  et identifiant du dégradé viennent tous de `limits`.
- `GET .../schema` n'est pas utilisé : le formulaire est écrit à la main pour garder
  l'aperçu, les libellés traduits et les règles de slots de couleurs.
- Le module n'a pas d'interrupteur : `isBotCustomizationActive()` considère le module
  actif dès qu'un champ est renseigné (le bloc stocké peut valoir `{}`), ce qui pilote le
  badge « Activé » de la vue d'ensemble.

## Problèmes rencontrés

- `api()` forçait `Content-Type: application/json`, incompatible avec l'upload
  multipart → exception explicite pour les corps `FormData` (le navigateur pose alors
  lui-même l'en-tête avec le `boundary`).
- L'URL d'upload expire en 15 min alors qu'un formulaire peut rester ouvert longtemps →
  upload différé au moment du save plutôt qu'à la sélection du fichier.

## Vérifications

- `npm run build` (tsc -b + vite build) : OK.
- `npm run lint` : aucune erreur ni avertissement sur les fichiers ajoutés/modifiés
  (les 15 erreurs restantes sont préexistantes et sans rapport).

## Prochaines étapes suggérées

- Ajouter les libellés réels des polices/effets Discord (`fonts.<id>` / `effects.<id>`)
  dès qu'un catalogue officiel est disponible — aucun changement de code nécessaire.
- Recadrage/redimensionnement de l'avatar côté client avant upload.
- Afficher un rappel du quota de changements Discord (rate limit) avant l'envoi.
