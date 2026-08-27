# Langue du serveur — un seul réglage, quatre sélecteurs retirés

**Date** : 2026-08-26
**Objectif** : brancher le nouveau réglage `guilds.data.settings.language` sur le
dashboard et retirer les quatre sélecteurs de langue par module, désormais morts.

## 1. Le modèle mental

Il n'y a plus qu'**un** réglage de langue par serveur. Il décide de ce que Moddy
dit **collectivement** : bienvenue, panneau AltGuard, panneaux et salons de
tickets, logs, DM et cartes automod, notifications sociales, transcriptions,
starboard, raisons IA.

Ce qui ne le suit pas : tout ce qui s'adresse à une personne en privé (réponses
éphémères, `/config`, erreurs) reste dans la langue Discord de cette personne, et
le dashboard reste dans la langue de l'utilisateur connecté. **Ne jamais choisir
la langue de l'UI avec ce réglage.**

Deux valeurs à ne pas confondre :

| Champ | Sens |
|---|---|
| `language` | ce qui est **stocké** (le choix de l'admin), peut valoir `auto` |
| `effective_language` | ce que le bot **parle**, toujours une des 5 locales, jamais `auto`, **`null` si Discord est injoignable** |

## 2. Ce qui a été ajouté

### Route `/servers/:guildId/settings`

Nouvel écran « Réglages du serveur », premier hôte de réglages hors modules.
Entrée dans la sidebar (icône engrenage, en fin de la nav serveur) et branche de
fil d'Ariane dédiée dans `DashboardPage` — placée **avant** la branche
`/servers/:guildId` générique, qui l'avalerait sinon.

### `GET`/`PUT /guilds/{id}/settings/language`

`src/services/guild-settings.ts`. Trois décisions portées par le code :

1. **Aucun cache.** Un admin peut changer la langue depuis `/config` dans
   Discord et **rien n'est publié vers le dashboard dans ce sens** : un cache
   client afficherait une valeur périmée indéfiniment. On relit à chaque
   ouverture de la page.
2. **La réponse du `PUT` est le payload du `GET`**, déjà rafraîchi
   (`effective_language` recalculé) : elle remplace l'état local, sans `GET`
   derrière.
3. **Jamais `PATCH /guilds/{id}/settings`** pour la langue : cet endpoint fait un
   merge de premier niveau dans `data`, donc un body qui ne porte que
   `{settings: {language}}` **écrase tout le nœud `settings`** et efface les
   autres réglages que `/config` peut y écrire. `PUT .../settings/language`
   écrit clé par clé (`jsonb_set`).

### L'écriture est optimiste, la restauration est obligatoire

Le sélecteur bouge tout de suite, mais la valeur précédente est gardée et
**restaurée** sur erreur (422 comme 500) : un `<select>` ne doit jamais afficher
un choix qui n'a pas été enregistré. Un `404` renvoie à la liste des serveurs ;
le `403` de sanction est déjà traité globalement (la page serveur entière est
inaccessible), `handleSaveError` s'en charge.

### L'explication contextuelle — le vrai sujet de l'écran

`src/lib/guild-language.ts` réduit l'état à quatre cas (`languageNotice()`) :

| Cas | Affichage |
|---|---|
| `language !== 'auto'` | rien — le choix est explicite |
| `auto` + `is_community: true` | « Moddy suit la langue de votre serveur Discord : X » |
| `auto` + `is_community: false` | **avertissement ambre** : Moddy parlera anglais, la langue Discord du serveur n'est qu'un défaut de compte |
| `auto` + `is_community: null` | « Impossible de contacter Discord » |

Le cas non-Communauté est le changement de comportement le plus visible de la
livraison : sans cette ligne, les admins concernés croiront à un bug.

Le badge « langue effective » ne s'affiche que sur `auto` **et** avec une
`effective_language` connue (`showsEffectiveBadge()`) : ailleurs il répète le
sélecteur, ou invente une valeur. `effective_language === null` masque le badge
plutôt que d'afficher un repli — la lecture n'est pas en échec pour autant, le
`PUT` fonctionne normalement.

La liste du sélecteur vient de **`choices`**, jamais des 6 valeurs en dur.
`GUILD_LANGUAGE_CHOICES` n'est qu'un repli pour ne pas rendre un `<select>` vide
si l'API ne sert pas le champ. Les libellés sont des **endonymes** (« Deutsch »,
pas « Allemand ») — convention d'un sélecteur de langue ; seul `auto` est
traduit, puisqu'il ne nomme pas une langue. Un code inconnu s'affiche tel quel.

## 3. Ce qui a été retiré

Quatre sélecteurs, morts depuis la livraison backend : plus lus, plus validés,
retirés de la config à la lecture comme avant chaque écriture.

| Module | Clé supprimée |
|---|---|
| `altguard` | `panel_locale` |
| `automod_ai` | `langue_serveur` |
| `logs` | `locale` |
| `tickets` | `categories[].locale` |

**Le piège** : Pydantic ignore les extras, donc une écriture qui porte encore une
de ces clés **n'est pas rejetée** — elle est sans effet et la clé n'est pas
repersistée. Un formulaire qui les envoie encore semble marcher tout en ne
réglant rien. D'où le nettoyage complet : types, normalisation, corps des
requêtes, formulaires, constantes (`ALTGUARD_PANEL_LOCALES`, `AutomodLanguage`,
`TICKET_LOCALES`, `LOGS_DEFAULT_LOCALE`) et clés i18n.

`saveAutomodConfig()` porte en plus un retrait explicite : la config automod a
une index signature (elle reconduit les champs ops inconnus), donc une
`langue_serveur` héritée d'une ancienne config repartirait dans le body sans ce
`delete`.

À la place, `ServerLanguageNote` (`src/components/server-language-note.tsx`) :
une ligne « Les textes de ce module suivent la langue du serveur → *Réglages* »
qui pointe vers `/servers/:guildId/settings`, posée dans les quatre écrans.

### Autres retraits

- `POST .../automod_ai/indications/check` : le body perd `langue_serveur` — il ne
  l'envoyait déjà pas, rien à changer. La langue de la `reason` est celle du
  serveur.
- `GET .../logs/catalog` : `locales` ne contient plus `auto`. Le champ reste dans
  le type (il sert à résoudre les `locale_keys`) mais n'alimente plus aucun
  sélecteur, et `validateLogsBody()` ne valide plus `body.locale`. Le repli de
  `normalizeLogsCatalog()` passe de `['auto']` à `['en-US']`.

## 4. Fichiers

**Créés**

- `app/src/pages/GuildSettingsPage.tsx`
- `app/src/services/guild-settings.ts`
- `app/src/lib/guild-language.ts`
- `app/src/components/server-language-note.tsx`

**Modifiés**

- `app/src/types/api.ts` — `GuildLanguageSettings`, `GUILD_LANGUAGE_CHOICES` ;
  retrait des 4 champs et de leurs constantes
- `app/src/main.tsx` — route `servers/:guildId/settings`
- `app/src/pages/DashboardPage.tsx` — branche de fil d'Ariane
- `app/src/components/app-sidebar.tsx` — entrée « Réglages du serveur »
- `app/src/lib/altguard.ts`, `app/src/services/altguard.ts`,
  `app/src/pages/modules/AltGuardPage.tsx`
- `app/src/services/automod.ts`, `app/src/pages/modules/AutomodAiPage.tsx`
- `app/src/lib/logs.ts`, `app/src/pages/modules/LogsPage.tsx`
- `app/src/lib/tickets.ts`, `app/src/components/tickets/category-dialog.tsx`
- `app/src/locales/{en,fr}/translation.json` — bloc `guildSettings`, retrait des
  clés mortes

## 5. Vérifications

- `npx tsc -b --noEmit` : propre
- `npm run lint` : 20 problèmes, **strictement identiques au baseline** (aucun
  dans les fichiers touchés)
- `npm run build` : OK

## 6. Prochaines étapes

- `/servers/:guildId/settings` est aujourd'hui mono-réglage : c'est l'endroit où
  poser les prochains réglages hors modules (fuseau horaire, rôles staff…).
- Les libellés endonymes vivent sous `guildSettings.language.choices` : une
  6ᵉ langue côté bot n'a besoin que d'une entrée là, `choices` fait le reste.
