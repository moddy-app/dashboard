# 2026-09-27 — Automod IA : détection d'images

## Objectif

Brancher sur le dashboard les deux nouveaux détecteurs d'images du module
`automod_ai` (`image_nsfw`, `image_scam`), passer à une liste d'exemptions
unique et gérer la lecture seule sous sanction globale. Aucun nouvel endpoint.

## Tâches accomplies

- Trois détecteurs indépendants rendus en cases à cocher (`content`,
  `image_nsfw`, `image_scam`), libellés « Analyse des messages », « Images
  explicites », « Captures d'arnaque ».
- Complétion des anciennes configs (seul `content` présent) avec les défauts du
  schéma, à la lecture et sur la réponse du `PUT`.
- Une seule liste d'exemptions (rôles + salons) recopiée sur tous les blocs ;
  divergence détectée → union affichée + encart + bouton « Unifier ».
- `image_scam.scan_all` exposé dans une section « Réglages avancés » repliée,
  avec avertissement de quota (300 lectures / jour / serveur).
- Lecture seule quand `status.blocked_by_global_sanction` (ou l'avertissement
  `blocked_by_global_sanction`) ou le verrou `canWriteAutomod` l'imposent ; le
  staff reste exempté. Un `403` relit `/status`.
- Rattachement des `422` en chaîne : salon d'alertes → champ, « Fonctionnalité
  / Catégorie inconnue » → encart global, sinon raison du contrôle
  anti-injection sous les consignes. Exemptions en trop (`loc` avec
  `exempt_roles`/`exempt_channels`) → sous la liste commune.
- Nouveau `ChannelMultiPicker` partagé.

## Fichiers

- `app/src/lib/automod.ts` (nouveau) — `AUTOMOD_FEATURE_IDS`,
  `normalizeAutomodConfig`, `sharedExemptions`, `applyExemptions`,
  `orderedFeatureIds`, `defaultAutomodFeature`.
- `app/src/services/automod.ts` — défauts à trois blocs, normalisation au GET
  et au PUT.
- `app/src/types/api.ts` — `AutomodFeature.scan_all`, index signature,
  `AutomodAiStatus.blocked_by_global_sanction`, nouvel avertissement.
- `app/src/pages/modules/AutomodAiPage.tsx` — détecteurs, exemptions, section
  avancée, lecture seule, erreurs.
- `app/src/components/module-pickers.tsx` — `ChannelMultiPicker`.
- `app/src/locales/{en,fr}/translation.json` — nouvelles clés, suppression de
  `noFeatures` et `exemptLimitReached`.
- `CLAUDE.md` — section Automod IA réécrite.

## Décisions

- **Divergence d'exemptions** : l'union est affichée mais le brouillon n'est pas
  réécrit tant que l'admin ne touche pas la liste ou ne clique pas « Unifier » —
  une sauvegarde d'un autre champ renvoie les listes telles que lues.
- **Blocs complétés** : leurs exemptions reprennent la liste commune (ils sont
  désactivés) pour ne pas déclencher un faux avertissement de divergence.
- **Défauts des blocs** : codés d'après la spec (`enabled: false`, listes vides,
  `scan_all: false`), le format de `/schema` n'étant pas documenté ici.
- Les libellés de `categories_desactivees` ne sont pas ajoutés : aucune UI ne
  les affiche.

## Non vérifié

- Pas de test visuel en navigateur (page derrière authentification + API).
  Vérifié : `tsc -b`, `eslint`, `vite build`, et un script sur les helpers
  purs.
- La détection des `422` en chaîne repose sur le texte des messages backend
  (« Salon d'alertes invalide », « Fonctionnalité inconnue », « Catégorie
  inconnue »).

## Prochaines étapes

- Lire les défauts depuis `GET …/schema` si son format est stabilisé.
- Mode « par détecteur » pour les exemptions si le besoin se présente.
