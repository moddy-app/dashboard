# 2026-09-20 — Configuration Tickets : refonte en trois niveaux

## Objectif

La configuration du module Tickets tenait sur **un seul écran** : accordéons de
panneaux, modale à quatre onglets pour chaque catégorie, `Card` autour de chaque
onglet, champs pleine largeur pour un titre de 60 caractères, phrases sans
conséquence pour l'admin. Résultat : on ne savait plus ce qu'on réglait ni dans
quel ordre.

L'écran de configuration est **réécrit**, pas retouché. Les onglets *Réglages*,
*Tickets* (vivants + archives) et *Avis*, ainsi que toute la logique d'API, sont
inchangés.

## Ce qui change

### 1. Hiérarchie en trois niveaux

| Niveau | Contenu |
|---|---|
| Module | État, encarts, quatre onglets, **liste des panneaux**, désactivation |
| Panneau | Publication (nom, salon) → Message publié (titre, description, couleur) → Présentation (style, texte du menu) → Catégories |
| Catégorie | Le bouton → Le salon créé → Qui peut ouvrir → À l'ouverture → Messages → Réglages avancés |

Chaque niveau a son écran, son en-tête avec chemin de retour et ses sections
titrées séparées par des `Separator`. Plus d'accordéon, plus de modale de
configuration, plus de `Card` autour d'un onglet.

**La navigation entre niveaux est locale, jamais routée.** `UnsavedBar` pose un
`useBlocker` sur les changements d'URL : une route par niveau ferait surgir
l'avertissement « modifications non enregistrées » à chaque descente. Les trois
niveaux partagent donc un seul brouillon et une seule sauvegarde — fidèles au
document unique de l'API.

Le défilement vers le champ fautif (validation locale ou `422`) est conservé et
**ouvre maintenant le bon niveau** avant de défiler : l'`id` DOM d'un champ est
sa clé d'erreur (`panelFieldKey()` / `categoryFieldKey()`).

### 2. Émojis résolus, plus jamais en texte

- `EmojiPicker` (`src/components/discord-emoji.tsx`) — popover, onglets
  *Serveur* / *Standard*, recherche, collage d'un émoji quelconque.
- `EmojiView` — rend `<:nom:id>` en image du CDN via l'`emojiCdnUrl()` déjà
  utilisé par le markdown et les transcriptions.
- `useGuildEmojis` — `GET /guilds/{id}/emojis`, cache module-scope (une requête
  par serveur et par session, un échec n'est jamais mis en cache).

La valeur stockée reste la chaîne Discord attendue par l'API ; seul l'affichage
change.

### 3. Composants au lieu de markup maison

`Field` / `FieldLabel` / `FieldDescription` / `FieldError`, `Empty`,
`ToggleGroup` (style de panneau, couleur de bouton), `Popover` + `Command` pour
les salons et les rôles — un `Select` est inutilisable sur plusieurs centaines
de salons. Les 10 permissions d'un rôle tiennent dans un popover, une ligne par
rôle.

### 4. Largeurs et bruit

Les champs sont dimensionnés par ce qu'ils contiennent (`max-w-sm` pour un nom,
`w-20` pour un nombre, `w-28` pour un hex). Les phrases sans conséquence sont
retirées — dont « La sauvegarde peut prendre jusqu'à 25 secondes… », l'id du
panneau, l'ordre des boutons décidé par le bot et « message par défaut du bot
utilisé ».

### 5. Barres de défilement des modales (tout le site)

`index.css` masque les scrollbars de `dialog`, `alert-dialog`, `sheet`,
`drawer` **et de leurs descendants**. Le défilement reste intact.

## Fichiers

**Créés**
- `app/src/components/discord-emoji.tsx`
- `app/src/hooks/useGuildEmojis.ts`
- `app/src/components/tickets/primitives.tsx`
- `app/src/components/tickets/module-home.tsx`
- `app/src/components/tickets/panel-editor.tsx`
- `app/src/components/tickets/category-editor.tsx`

**Supprimés**
- `app/src/components/tickets/panels-tab.tsx`
- `app/src/components/tickets/panel-card.tsx`
- `app/src/components/tickets/category-dialog.tsx`

**Modifiés**
- `app/src/pages/modules/TicketsPage.tsx` (rendu en trois niveaux ; chargement,
  validation et sauvegarde inchangés)
- `app/src/lib/discord-emoji.ts` (+ `customEmojiToken`, `isUnicodeEmoji`)
- `app/src/locales/{en,fr}/translation.json` (`modules.tickets`, `emojiPicker`)
- `app/src/index.css` (scrollbars des modales)
- `CLAUDE.md`

## Ce qui n'a pas changé

`lib/tickets.ts` et `services/tickets.ts` sont intacts : ids stables générés
côté client, `message_id` round-trippé, `buttons` à trois états (`null` ≠ `[]`),
défauts du bot en placeholder uniquement, verrou `409` sans retry automatique,
`_apply` affiché de façon persistante, snowflakes en chaînes. Les onglets
Réglages, Tickets (vivants + archives, transcriptions) et Avis ne sont pas
touchés.

## Note de rebase

La branche `preview` distante avait avancé de dix commits pendant la session
(refonte partielle du module, transcriptions, avis, filtres, réglages du
module). Le travail a été **rebasé** sur cet état plutôt que poussé par-dessus :
rien de ces ajouts n'est perdu, et la refonte ne porte que sur l'écran de
configuration, qui était resté en accordéon + modale.

## Vérifications

- `npx tsc -b --noEmit` : aucune erreur.
- `npm run lint` : 18 erreurs, toutes préexistantes (aucune dans les fichiers
  touchés).
- `npm run build` : OK.
- Couverture i18n : toutes les clés `t("…")` des fichiers du module existent en
  `fr` et en `en`.
- **Pas de test visuel** : la page exige une session authentifiée et un serveur
  Discord, indisponibles dans cet environnement.

## Suites possibles

- Aperçu du panneau tel qu'il apparaîtra dans Discord.
- Réordonnancement des catégories, si le bot cesse d'imposer son ordre.
