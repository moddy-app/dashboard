# Automod : état du module, sanctions par actions, sanctions en attente

**Date** : 2026-10-16
**Objectif** : suivre la refonte backend (PR #99) — `state` à la place de `enabled`/`dry_run`, sanctions par actions cumulables, politiques effectives, validation par un modérateur, suppression des indications — et renommer le module « Automod ». Corriger au passage un crash de l'écran.

## Tâches accomplies

### Correctif : crash `draft.indications.length`
Après la PR #99 l'API ne sert plus `indications` : les configs lues n'en ont plus et `draft.indications.length` plantait l'onglet Réglages. Le champ, son compteur et son contrôle anti-injection (`POST .../indications/check`, supprimé côté backend) ont été retirés ; `normalizeAutomodConfig()` écarte aussi `enabled`, `dry_run`, `indications`, `rules` de l'état local et `stripDeadConfigKeys()` les retire de tout corps de requête.

### Couche données (commit précédent)
- `types/api.ts` : `ModuleState`, `AutomodAction`, `AutomodPolicy`, `AutomodPendingApproval(s)`, `AutomodActionRule`, `AutomodCatalogAction`, `AutomodSanction` (`actions`, `timeout_seconds`, `require_approval`, `by_gravity`).
- `lib/automod.ts` : `readModuleState`, `normalizeActions`, `effectiveActions`, `timeoutBounds`, `canRequireApproval`, `applySanctionChanges` (écrire `actions` supprime `by_gravity`, `crans` jamais réécrit), `applyAutomodPreset`, `automodErrorKey`.
- `services/automod.ts` : `getAutomodPolicies`, `listAutomodPendingApprovals`, statut avec `state` ; `services/guilds.ts` : `setModuleState`.

### UI (cette session)
1. **Sélecteur d'état** (`settings-tab.tsx`) : `ToggleGroup` Actif / En pause / Simulation avec description, remplace les deux interrupteurs. `state` n'entre dans le brouillon que si l'utilisateur le change.
2. **Éditeur de sanctions** (`scale-tab.tsx`, reconstruit) : mode Moddy/perso ; en perso, cases d'actions (libellés du catalogue, repli i18n), actions remplacées grisées avec « Remplacé par X », durée du timeout en j/h/min bornée par `timeoutBounds`, case « Validation par un modérateur » (désactivée pour `profil_*` et les plans delete seul), récidive. Un plan `by_gravity` sans `actions` est montré en lecture seule avec une note.
3. **Politiques** : `hooks/useAutomodPolicies.ts` + `PolicyView` remplacent « Défaut de Moddy » (plans par gravité, récidive, validation). Plus aucun `default_crans`/échelle de crans.
4. **Assistant** : niveaux repris du catalogue tels quels ; bouton « Passer » = Équilibré en `simulation`.
5. **Sanctions en attente** : `pending-approvals-panel.tsx`, onglet `?tab=approvals`, lecture seule, filtre de statut, « Charger plus » (limit 50).
6. **Erreurs** : `automodErrorKey` reconnaît aussi un `error` objet (`{code}`), le dialog d'infraction personnalisée traduit le 503 via `errors.check_unavailable`.
7. **Nom** « Automod » dans les i18n (module, sidebar, fil d'Ariane, ⌘K, bandeaux de sanction).
8. **Statut** (`status-display.tsx`) : badges Actif / En pause / Simulation et « Bloqué par une sanction globale ».

## Fichiers créés/modifiés
- Créés : `app/src/components/automod/action-plan.tsx`, `app/src/components/automod/pending-approvals-panel.tsx`, `app/src/hooks/useAutomodPolicies.ts`, `app/src/lib/automod-labels.ts`.
- Modifiés : `app/src/components/automod/{scale-tab,settings-tab,setup-wizard,status-display,custom-infraction-dialog,automod-form}.ts(x)`, `app/src/pages/modules/AutomodAiPage.tsx`, `app/src/lib/automod.ts`, `app/src/locales/{en,fr}/translation.json`, `CLAUDE.md`.

## Notes et décisions
- Les helpers d'affichage (`actionLabel`, `formatTimeout`) vivent dans `lib/automod-labels.ts` : les exporter d'un fichier de composant casse react-refresh.
- La saisie du timeout est locale tant qu'elle est hors bornes : rien n'est écrit dans le brouillon, la valeur revient à la dernière valeur valide au blur.
- Aucun bouton de décision sur les sanctions en attente ; le contenu du message supprimé n'est jamais affiché.
- Code mort retiré : échelle de crans, `default_crans`, `defaultCransFor`, clés i18n indications/dry_run/crans.
- Lint : 18 erreurs / 2 avertissements, inchangé (dette existante).

## Prochaines étapes
- Vérifier le format réel de `GET .../policies` (le service est tolérant : objet, `{policies}` ou tableau).
- Étendre le sélecteur d'état aux autres modules (`setModuleState`), seul Automod gère `simulation`.
