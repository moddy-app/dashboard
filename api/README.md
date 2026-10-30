# API Serverless Functions (Vercel)

Ce dossier contient les serverless functions Vercel déployées avec le dashboard.

## 📁 Structure

```
/api/
├── health.ts       # Health check (GET/HEAD) pour un monitor externe
├── healthz.ts      # Health check minimal, servi aussi sur /healthz
├── package.json    # Dépendances pour les fonctions API
└── README.md       # Ce fichier
```

## Health checks

`health.ts` et `healthz.ts` répondent toujours `200 ok`, sans dépendance externe
(pas d'appel au backend Moddy, pas de base de données) : ils attestent seulement
que le déploiement répond. Aucune authentification, aucune redirection.

## ⛔ Pas de proxy vers le backend

Le dashboard appelle directement `https://api.moddy.app` avec le cookie de
session (`credentials: 'include'`). L'ancien `backend-proxy.ts`, qui signait en
HMAC avec `API_KEY` n'importe quelle requête reçue, a été **supprimé** (audit de
sécurité DASH-01/02 : oracle de signature non authentifié, `endpoint` concaténé
à l'URL, CORS réfléchi avec credentials).

Ne pas réintroduire de fonction qui détient `API_KEY` ou un autre secret du
backend : tout ce qui est déployé ici est appelable par n'importe qui.
`API_KEY` peut être retirée des variables d'environnement Vercel du dashboard.
