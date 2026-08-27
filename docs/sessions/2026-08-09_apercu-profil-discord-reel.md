# Session 2026-08-09 (2/2) — L'aperçu devient le vrai profil Discord

Suite directe de `2026-08-09_rendu-name-styles-discord.md`, qui avait rendu
fidèles la police et l'effet du pseudo. Cette session s'attaque à la carte qui
les entoure.

## Objectif

L'aperçu du module Bot Customization était une carte maison (bannière
arrondie, avatar shadcn, bio en `text-muted-foreground`). Elle montrait les
bonnes données dans la mauvaise boîte : rien n'y ressemblait à ce que les
membres du serveur verront réellement.

Le DOM complet du profil Discord de Moddy a été fourni (CSS résolu + polices
embarquées). L'aperçu utilise désormais **ce code-là**, pas une imitation.

En parallèle, un nouvel endpoint `GET /bot/profile` expose le profil **global**
du bot — ce qui permet enfin de montrer les vraies valeurs de repli.

## Tâches accomplies

1. Extraction du dump : CSS Discord verbatim, `gg sans` (4 graisses), badge
   « prend en charge les commandes », tracé du masque squircle.
2. `src/styles/discord-profile.css` — règles Discord **telles quelles**, noms de
   classes hachés compris.
3. `src/components/discord-profile-preview.tsx` — reproduction de l'arbre DOM.
4. `GET /bot/profile` : type, service, hook avec cache.
5. `src/components/discord-markup.tsx` — rendu du markdown des bios.
6. Thème clair/sombre suivant celui du dashboard.
7. Serveurs en commun réels (icônes + total) depuis les guildes de l'utilisateur.
8. i18n EN + FR, `CLAUDE.md`, ce résumé.

## Fichiers créés

| Chemin | Rôle |
|---|---|
| `app/src/styles/discord-profile.css` | CSS Discord verbatim + thème clair + additions Moddy |
| `app/src/components/discord-profile-preview.tsx` | Le popout de profil |
| `app/src/components/discord-markup.tsx` | Rendu du markdown Discord |
| `app/src/services/bot.ts` | `getBotProfile()` |
| `app/src/hooks/useBotProfile.ts` | Cache module, une requête par session |
| `app/public/fonts/gg-sans/*.woff2` | `gg sans` 400/500/600/700 (153 Ko) |
| `app/public/images/discord-badge-supports-commands.png` | Badge du profil (1,5 Ko) |

## Fichiers modifiés

| Chemin | Changement |
|---|---|
| `app/src/pages/modules/BotCustomizationPage.tsx` | `CustomizationPreview` délègue au popout ; l'ancien `DiscordMarkup` local (emoji + gras) est remplacé par le vrai |
| `app/src/components/name-style-preview.tsx` | Prop `plain` — police seule, sans effet ni couleur |
| `app/src/types/api.ts` | `BotProfile` |
| `app/src/index.css` | `@import "./styles/discord-profile.css"` |
| `app/src/locales/{en,fr}/translation.json` | Bloc `preview.*`, `previewDescription`/`previewHint` réécrits, clé morte `fontPreviewLabel` supprimée |
| `CLAUDE.md` | Sections aperçu, `/bot/profile`, markdown, typographie |

## Documentation technique

### Reprendre le CSS, pas le réécrire

Premier jet : les règles avaient été **retapées** en classes `dpp-*` propres.
Résultat correct à l'œil, mais c'est une copie manuelle — chaque valeur est une
occasion de se tromper, et la prochaine mise à jour du dump ne se rediffe plus.

Le fichier final colle donc les règles Discord telles quelles, `.outer_c0bea0`
et `.displayNameRow__26b1f` compris. Le composant React s'aligne sur **ces**
noms. Trois adaptations, listées en tête du fichier :

1. **`gg sans` self-hostée** (`/fonts/gg-sans/`) au lieu d'être en base64 —
   mêmes woff2, mêmes graisses.
2. **Le bloc de variables passe de `:root` à `.dpp-scope`.** Non négociable :
   Discord y définit `--radius-lg`, `--radius-sm`, `--text-default`,
   `--font-primary`… qui écraseraient les tokens du dashboard sur toute la page.
3. **Un bloc `.theme-light`** — seule invention du fichier, cf. plus bas.

Les additions Moddy sont regroupées en fin de fichier : replis (pas d'avatar,
pas d'icône de serveur), déclampage de la bio, et les éléments markdown absents
de la capture (la bio dumpée ne contenait ni citation, ni titre, ni bloc de code).

### Le thème clair

Le dump a été capturé en « midnight ». Le thème clair réutilise la même échelle
`--neutral-*` en miroir — fonds 1/4, textes 91/83/47 — plutôt que d'inventer des
couleurs hors palette. Il est activé par la classe `theme-light` sur la carte,
c'est-à-dire **le mécanisme de Discord lui-même** : les règles qui testent
`.theme-dark` (bordure de la bulle de statut, overlay du gradient) cessent
naturellement de s'appliquer. `system` est résolu en JS, parce que ces règles
testent une classe et non une media query.

### `gg sans`, et pas Google Sans

Réflexe corrigé en cours de route : la carte avait d'abord hérité de Google Sans
via `--font-sans`. Mais sur Discord il n'y a pas de Google Sans — un aperçu qui
se veut fidèle doit être en `gg sans`. Les 4 graisses viennent du dump ; la pile
de repli est celle de Discord, verbatim.

### Repli sur le profil global

`GET /bot/profile` donne le profil Discord **global** de l'application. Chaque
champ vide du module retombe dessus, exactement comme Discord affiche le profil
global là où aucune personnalisation de guilde ne s'applique :

| Champ du module | Vide → |
|---|---|
| `nickname` | `profile.username` |
| `bio` | `profile.bio` (peut être `null` : RPC best-effort) |
| `avatar` (vide ou réinitialisé) | `profile.avatar_url` |
| `banner` (vide ou réinitialisé) | `profile.banner_url`, sinon `accent_color` en aplat |

La ligne du nom d'utilisateur montre toujours le nom **global** : sur Discord un
pseudo de guilde ne change que le nom affiché.

### Serveurs en commun

Les icônes et le total viennent des guildes de l'utilisateur (`user.guilds`),
pas d'un décor : 3 icônes maximum puis le total, comme Discord. Masque squircle
repris du dump, initiales en repli quand un serveur n'a pas d'icône.

### Markdown des bios

Couvre ce que Discord rend réellement : gras, italique, souligné, barré,
spoiler, code inline et bloc, citations, titres `#`/`##`/`###`, petit texte
`-#`, liens `[texte](url)`, liens nus, émojis custom.

⚠️ **Le piège qui a fait planter l'onglet.** Le parseur est récursif (le contenu
d'un `**gras**` est re-parsé). La `RegExp` globale était définie au niveau
module : l'appel imbriqué réinitialisait son `lastIndex`, la boucle extérieure
repartait en arrière, et le rendu tournait à l'infini — Chromium tuait l'onglet
(« Target crashed », sans message d'erreur). Les regex globales sont désormais
instanciées à chaque appel. À ne pas « optimiser » en les remontant.

### Découpe de la bannière

`--custom-cutout-radius/x/y` sont posées **en style inline** sur `.fill_b83360`,
comme chez Discord. Sans elles le `mask-image` est invalide et la bannière passe
derrière l'avatar au lieu d'être trouée autour. Symptôme discret, cause non
évidente.

## Technologies utilisées

React 19, TypeScript strict, react-i18next (pluriels), CSS `mask-image` radial,
`foreignObject` + masque SVG, tokens Discord en HSL.

## Notes et décisions

- **Le statut « 🔗 moddy.app » est écrit en dur.** Aucun endpoint ne l'expose et
  le module ne le configure pas, mais il fait partie du profil réel et la bulle
  structure la mise en page. Constante unique, facile à retirer.
- **Pas de discriminateur** sous le pseudo : le dump montrait `#3735`,
  `/bot/profile` ne le renvoie pas. Afficher le seul `username` plutôt
  qu'inventer.
- **Bio déclampée.** Discord coupe à 3 lignes ; pendant qu'on édite sa bio on
  veut la voir en entier. Seule entorse visuelle volontaire, isolée dans une
  classe.
- **Nœuds décoratifs non rendus** : mesures cachées du statut, bouton « ajouter
  une note » (`opacity:0`), conteneur de boutons vide, cible de focus.
- **Licences à vérifier avant mise en production.** `gg sans` est propriétaire
  Discord et n'est pas redistribuable ; le badge PNG et les 7 polices de name
  styles sont dans le même cas. Fidélité maximale en interne, mais c'est une
  décision à assumer explicitement avant un déploiement public.
- Le `rem` du dashboard vaut 17px (`font-size: 106.25%` sur `html`) contre 16px
  chez Discord. Sans effet ici : la carte est en `px`, et les rares valeurs en
  `rem` sont écrasées par `text-sm/normal_cf4812` (14px).

## Vérifications

- `npm run build` (tsc -b + vite build) : OK.
- `npm run lint` : rien sur les fichiers ajoutés ou modifiés (15 erreurs
  préexistantes, toutes `react-refresh/only-export-components`).
- **Rendu vérifié au navigateur** (Chromium/Playwright, API mockée) : carte
  complète en thème clair **et** sombre — découpe de la bannière, bulle de
  statut et ses deux satellites, étiquette APP alignée, 3 icônes de serveurs en
  squircle + total, `gg sans` chargée.
- **Markdown vérifié sur une bio de torture** : titres, gras/italique/souligné/
  barré, spoiler, code inline et bloc, citation multi-lignes, petit texte,
  liens et liens nus, gras imbriquant de l'italique — tout rend, sans blocage.

## Prochaines étapes suggérées

- Câbler `GET /bot/profile` sur le vrai backend (l'intégration front est prête,
  seul le mock a été testé) et vérifier le rendu avec une vraie bannière animée.
- Décider du sort des polices propriétaires avant déploiement public.
- Réutiliser `DiscordMarkup` partout où une bio ou un message Discord est
  affiché (cases, notifications) — il est autonome et sans dépendance à la carte.
