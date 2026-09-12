# Session 2026-09-12 — Bandeau de statut (`health.moddy.app`)

## Contexte

Jules signale que « les bannières de status » ne s'affichent pas sur le dashboard.

Investigation initiale : la seule bannière existante à l'époque était `InfoBanner` (annonces admin, `GET /banners/active`, session du 2026-05-29). Test direct de l'endpoint :

```
GET https://api.moddy.app/banners/active → HTTP 200, body: null
```

Conclusion de cette première passe : le code frontend fonctionne correctement, il n'y a simplement aucune bannière active côté backend en ce moment — pas un bug dashboard. Au passage, constat que cette fonctionnalité n'avait jamais été ajoutée à la liste « Actuellement implémenté » de `CLAUDE.md`, malgré la règle du projet.

Jules a ensuite précisé qu'il parlait en réalité d'un **nouvel endpoint**, `GET /v1/status/banner` sur `health.moddy.app` — un vrai bandeau de statut de service (incident/maintenance), distinct de `InfoBanner`. Cette fonctionnalité n'existait pas du tout côté dashboard : c'est elle qui a été implémentée dans cette session.

## Tâches accomplies

- Implémentation du bandeau de statut de service, alimenté par `health.moddy.app`
- Extraction du parseur markdown inline (jusque-là dupliqué en germe) dans un helper partagé
- Documentation de `InfoBanner` dans `CLAUDE.md` (jamais faite en mai) + documentation du nouveau bandeau

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `app/src/services/status-banner.ts` | Fetch `GET /v1/status/banner?service=moddy-dashboard` sur `health.moddy.app` (`VITE_STATUS_API_URL`, défaut `https://health.moddy.app`), silencieux en cas d'erreur réseau |
| `app/src/hooks/useStatusBanner.ts` | Hook avec polling 60 s, retourne `null` tant que `message` est vide (donc aussi sur `level: 'operational'`) |
| `app/src/components/status-banner.tsx` | Composant de rendu — style par `level` connu, repli neutre sur un niveau inconnu |
| `app/src/lib/inline-markdown.ts` | Parseur markdown inline (gras, italique, lien) extrait de `info-banner.tsx`, désormais partagé |

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `app/src/components/info-banner.tsx` | Utilise le parseur partagé `@/lib/inline-markdown` au lieu de sa propre copie |
| `app/src/pages/DashboardPage.tsx` | Import + appel de `useStatusBanner()`, affichage de `<StatusBanner>` au-dessus de `<InfoBanner>` |
| `CLAUDE.md` | Ajout de l'entrée « Bandeau d'annonce » (rétroactive, feature de mai jamais documentée) et « Bandeau de statut » |

## Fonctionnalités ajoutées

### Service (`status-banner.ts`)

- Hôte dédié `health.moddy.app`, distinct de `api.moddy.app` — pas d'auth
- Paramètre `service=moddy-dashboard` pour que le backend nomme le dashboard s'il est concerné par l'incident (logique entièrement côté backend, rien à répliquer côté client)
- `level` typé en union connue élargie (`string & {}`) : accepte les valeurs documentées mais n'importe quelle autre chaîne sans erreur TypeScript, cohérent avec la philosophie « énumération inconnue → repli silencieux » déjà en place ailleurs (`kind` des notifications, `additive`/`sparse` des stats)

### Hook (`useStatusBanner.ts`)

- Filtre sur **`message`**, pas sur `level` : le payload `operational` a `message: null`, donc c'est ce champ qui décide s'il y a quelque chose à montrer — robuste si le backend introduit un jour un niveau qui ne doit rien afficher non plus

### Composant (`status-banner.tsx`)

- **Ne réinvente aucun texte** : `message` est déjà le markdown final produit par le backend (verbe de maintenance résolu selon `starts_at`/`ends_at`, lien `[View status](url)` déjà inclus ou replié sur la status page) — le composant se contente de le parser et de l'afficher
- Style par `level` : `degraded_performance` (ambre), `partial_outage` (orange), `major_outage` (destructive), `maintenance` (sky) ; tout le reste retombe sur un style neutre générique
- Fermeture sans id backend : clé dérivée de `url ?? title ?? message`, mémorisée en state React (comme `InfoBanner`, donc perdue au rechargement)

### Intégration dans `DashboardPage`

Les deux bandeaux sont indépendants et peuvent s'empiler, le bandeau de statut en premier (incident réel avant annonce éditoriale) :

```tsx
{activeStatusBanner && <StatusBanner banner={activeStatusBanner} onDismiss={...} />}
{activeBanner && <InfoBanner banner={activeBanner} onDismiss={...} />}
```

## Décisions techniques

- **Deux sources, deux composants** : `InfoBanner` (annonces éditoriales pilotées par un admin) et `StatusBanner` (statut technique du service, piloté par le status page) répondent à des besoins différents et n'ont aucune raison de partager un modèle de données — seul le rendu markdown inline est mutualisé.
- **Aucune logique de libellé côté frontend** pour le statut : contrairement à `InfoBanner` qui construit son propre style à partir de champs structurés, tout le texte de `StatusBanner` est pré-rendu côté `health.moddy.app` (y compris la fenêtre de maintenance et le verbe). Dupliquer cette logique côté client serait une source de désynchronisation.
- **Pas de persistance de fermeture** (`sessionStorage`) pour l'un ou l'autre bandeau — cohérent avec l'état actuel d'`InfoBanner`, identifié comme dette dans la session de mai.

## Prochaines étapes suggérées

- Persistance `sessionStorage` de la fermeture, pour les deux bandeaux
- Vérifier avec le backend `health.moddy.app` si un environnement de test/staging permet de visualiser les styles `partial_outage` / `major_outage` / `maintenance` (testé en conditions réelles uniquement avec `operational`)
