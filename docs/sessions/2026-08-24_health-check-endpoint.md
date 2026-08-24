# Session — Endpoint de health check pour monitor externe

- **Date** : 2026-08-24
- **Objectif** : Exposer une route `GET /healthz` répondant 200 en continu, dédiée à un monitor externe qui sonde le dashboard en HTTP toutes les 30s.

## Contexte

Le dashboard est un site statique / SPA sans process serveur capable de pousser un heartbeat. Le monitor doit donc lui-même vérifier l'état via un GET périodique. La route `/` sert déjà intentionnellement un contenu en **503** (`api/homepage-503.ts`) pour signaler l'indisponibilité applicative pendant la phase "en travaux" — ce n'est donc pas une base utilisable pour un health check d'infrastructure, qui doit rester découplé de cet état applicatif.

## Tâches accomplies

1. Création de `api/healthz.ts` : serverless function Vercel minimale, sans dépendance externe (pas d'appel au backend Moddy), qui répond toujours `200 ok` avec `Cache-Control: no-store`.
2. Ajout d'un rewrite `/healthz` → `/api/healthz` dans `vercel.json`, pour exposer une URL courte sans le préfixe `/api/`.

## Fichiers créés

- `api/healthz.ts`

## Fichiers modifiés

- `vercel.json` — nouveau rewrite `/healthz` → `/api/healthz`.

## Notes techniques

- Pas d'authentification, pas de CORS restrictif (la fonction ne fixe aucun header CORS, donc rien ne bloque un GET brut sans en-tête `Origin`).
- Aucune dépendance à une ressource externe fragile : la fonction ne fait ni fetch réseau ni lecture disque, réponse en quelques ms.
- Le rewrite Vercel est une réécriture interne (pas une redirection HTTP) : `/healthz` répond directement en 200, sans 301/302.

## Vérification

- **Non vérifiable en live depuis cet environnement** : l'accès réseau sortant vers `moddy.app` est bloqué par la politique du sandbox (`CONNECT tunnel failed, response 403`). La vérification `curl -i` (avec et sans `-L`) doit être faite après déploiement sur Vercel, avec :
  ```bash
  curl -i https://moddy.app/healthz        # sans redirection
  curl -i -L https://moddy.app/healthz     # en suivant les redirections
  ```
  Les deux commandes doivent renvoyer `HTTP/2 200` directement, sans saut intermédiaire (pas de 301/302 visible dans les headers).

## Prochaines étapes suggérées

- Une fois déployé, confirmer avec `curl -i` que `https://moddy.app/healthz` répond 200 sans redirection, puis transmettre cette URL au monitor externe.
