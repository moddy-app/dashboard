# 2026-08-07 — Module Welcome Messages (welcome_channel v2)

## Objectif

Remplacer l'ancien module « Welcome Channel » (salon unique + embed Discord
optionnel) par le nouveau module **Welcome Messages** reworké côté backend :
une liste de **jusqu'à 5 messages indépendants** (un par salon), sans plus aucun
`discord.Embed` — le bot envoie un Container Components V2 (texte + barre
d'accent uniquement).

## Tâches accomplies

1. Nouveau modèle de config v2 dans `types/api.ts` (`WelcomeMessage`,
   `WelcomeChannelConfig`, `MAX_WELCOME_MESSAGES`, `WELCOME_DEFAULT_ACCENT`).
2. Nouveaux helpers `lib/welcome.ts` (génération d'id, conversions de couleur,
   lecture/écriture de config, état actif, quota).
3. Réécriture complète de `pages/modules/WelcomeChannelPage.tsx` : passage d'un
   formulaire unique avec barre « enregistrer » à un flow **liste + add/manage**
   aligné sur Social Notifications, avec écriture immédiate.
4. Traductions EN/FR entièrement refaites pour `modules.welcome_channel`
   (anciennes clés d'embed supprimées).
5. Détection d'état « actif » du module sur la page d'aperçu du serveur
   (`GuildOverviewPage`).
6. Mise à jour de `docs/FRONTEND_GUIDE.md` (la section `welcome_channel`
   décrivait encore le v1 ; `docs/API_ENDPOINTS.md` était déjà à jour).

## Fichiers créés / modifiés

| Fichier | Nature |
|---|---|
| `app/src/lib/welcome.ts` | **créé** — helpers du module |
| `app/src/types/api.ts` | modifié — `WelcomeChannelConfig` v2 + constantes |
| `app/src/pages/modules/WelcomeChannelPage.tsx` | réécrit — liste + dialog |
| `app/src/pages/GuildOverviewPage.tsx` | modifié — `isModuleEnabled` |
| `app/src/locales/en/translation.json` | modifié — bloc `welcome_channel` |
| `app/src/locales/fr/translation.json` | modifié — bloc `welcome_channel` |
| `docs/FRONTEND_GUIDE.md` | modifié — config `welcome_channel` v2 |

Aucun changement de structure de dossiers, aucune nouvelle dépendance, aucune
nouvelle route (l'URL `/servers/:guildId/modules/welcome_channel` est conservée).

## Contrat API

Endpoints modules génériques déjà utilisés par starboard / adaptive_slowmode —
aucune logique de fetch nouvelle, tout passe par `GuildContext`
(`modules`, `updateModule`, `disableModule`) :

- `GET /guilds/{id}/modules` → la config arrive avec le reste des données du
  serveur ; le backend migre les entrées v1 à la lecture, le front ne voit
  **que** du v2.
- `PUT`/`PATCH /guilds/{id}/modules/welcome_channel` → remplace **toujours** la
  config complète (pas de patch par entrée).
- `DELETE /guilds/{id}/modules/welcome_channel` → désactive le module.

```ts
interface WelcomeMessage {
  id: string                   // "wm_" + 8 hex minuscules, unique dans la guilde
  channel_id: string           // snowflake en string
  message: string              // 1–1500 caractères
  accent_color: number | null  // 0–0xFFFFFF ; null = 0x5865F2
  enabled: boolean
  created_by: string | null    // informatif
  created_at: string | null    // informatif
}
interface WelcomeChannelConfig { version: 2; messages: WelcomeMessage[] }  // max 5
```

## Décisions techniques

### Écriture immédiate + rollback

Il n'y a pas de barre « enregistrer / annuler » globale : ajout, édition,
pause/reprise et suppression déclenchent chacun un PUT de la **liste entière**
via `persist(next)`. La fonction applique d'abord l'état optimiste, puis
restaure l'état précédent si l'appel échoue — l'état local ne peut donc jamais
diverger du backend. Une liste vidée n'envoie pas `{messages: []}` mais un
`DELETE` (module désactivé), symétrique de ce que fait Social Notifications.

### Identifiants

`generateWelcomeId()` tire 4 octets via `crypto.getRandomValues` et vérifie
l'absence de collision avec les entrées existantes (le backend renvoie 422 sur
un id dupliqué ou hors format `^wm_[0-9a-f]{8}$`). Un id n'est jamais réutilisé,
même après suppression d'une entrée.

### Snowflakes

`channel_id` et `created_by` sont normalisés en chaînes à la lecture
(`readWelcomeConfig`) — jamais de `Number()` sur un snowflake.

### Couleur d'accent

L'UI travaille en `#RRGGBB`, l'API en entier décimal. `accentHexToInt` valide le
format avant envoi (regex `^#?[0-9a-f]{6}$`) et `accentIntToHex` reconvertit
avec padding. Le sélecteur natif `<input type="color">` n'accepte qu'un
`#rrggbb` minuscule : tant que la saisie texte est incomplète (`#58`), le swatch
et l'aperçu retombent sur la couleur par défaut au lieu de casser le champ.

### Absence d'interrupteur global

Le backend ignore une clé `enabled` à la racine ; `buildWelcomeConfig` n'en
écrit jamais. L'état « actif » affiché (carte de la page d'aperçu) est dérivé :
au moins un message `enabled: true` **et** rattaché à un salon
(`isWelcomeActive`).

### Aperçu

Rendu fidèle au Components V2 : barre verticale colorée à gauche d'un bloc de
texte. Aucun champ d'embed (pas de titre, description, image, footer,
thumbnail) — ces champs ont disparu du modèle et de l'UI.

### Placeholders

Aide-mémoire informatif uniquement (substitution littérale côté bot, un token
inconnu ne casse jamais le rendu) : `{server}`, `{user}`, `{display_name}`,
`{username}`, `{member_count}`, `{timestamp}`. Ils sont injectés dans le
`MessageEditor` réutilisable (le même que Social Notifications : surlignage +
insertion en un clic), en tokens `{…}` bruts — c'est sur cette forme que
`RichTextEditor` fait correspondre la coloration. L'aide sous l'éditeur suggère
`<t:{timestamp}:R>` pour afficher l'arrivée en date relative. Aucune validation
stricte côté client.

Message prérempli d'une nouvelle entrée (adapté à la langue de l'utilisateur) :

```
Welcome {user} to **{server}**!
-# They are the **{member_count}**th member
```

## Problèmes rencontrés

- **Interpolation i18next `count`** : le libellé « X messages sur 5 » utilisait
  `count`, qui déclenche la machinerie de pluriel d'i18next (recherche de
  `key_one` / `key_other`). Renommé en `used` pour rester une simple
  interpolation.
- **`ᵉ` du message par défaut FR** : CLAUDE.md avertit qu'un caractère hors des
  `unicode-range` déclarés retombe silencieusement en police système. Vérifié :
  U+1D49 est couvert par la plage `latin-ext` (`U+1D00-1DBF`) — l'ordinal est
  donc sûr.
- **Repo backend** : la config v2 était déjà documentée dans
  `docs/API_ENDPOINTS.md` de ce repo ; seul `docs/FRONTEND_GUIDE.md` décrivait
  encore le v1, corrigé.

## Vérifications

- `npm run build` (tsc -b + vite build) : OK.
- `npm run lint` : aucun nouveau problème sur les fichiers touchés (les 15
  erreurs restantes sont préexistantes et concernent d'autres fichiers).

## Prochaines étapes suggérées

- Rendu markdown de l'aperçu (gras, `-#` subtext) pour coller au rendu Discord
  exact — aujourd'hui l'aperçu affiche le texte brut.
- Étendre le même traitement à `welcome_dm`, qui utilise encore un modèle à
  embed.
- Bouton « tester l'envoi » si le backend expose un jour un endpoint de preview.
