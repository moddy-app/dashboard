# Résumés de sessions de développement

Ce dossier contient les résumés détaillés de chaque session de travail sur le projet Moddy Dashboard.

## 📋 Format

Chaque session est documentée dans un fichier markdown avec le format :

```
YYYY-MM-DD_description-courte.md
```

**Exemple** : `2026-02-12_integration-backend.md`

## 📝 Contenu d'un résumé de session

Chaque fichier doit contenir :

1. **En-tête**
   - Date de la session
   - Durée approximative
   - Objectif principal

2. **Tâches accomplies**
   - Liste détaillée des tâches réalisées
   - Fichiers créés/modifiés avec chemins complets

3. **Documentation technique**
   - Flow et diagrammes si pertinents
   - Explications des choix techniques
   - Technologies utilisées

4. **Changements structurels**
   - Nouveaux dossiers créés
   - Changements dans l'architecture
   - Mises à jour des dépendances

5. **Notes importantes**
   - Décisions prises et leur justification
   - Points d'attention pour le futur
   - Variables d'environnement ajoutées

6. **Problèmes rencontrés**
   - Bugs découverts et résolus
   - Adaptations nécessaires
   - Solutions implémentées

7. **Prochaines étapes**
   - Suggestions pour continuer le développement
   - Fonctionnalités à implémenter
   - Améliorations possibles

## 🎯 Objectif

Ces résumés servent à :

- **Garder une trace** de l'évolution du projet
- **Faciliter la reprise** du travail après une pause
- **Comprendre les décisions** prises dans le passé
- **Former une documentation** historique complète
- **Aider Claude** à comprendre le contexte dans les futures sessions

## 📚 Index des sessions

<!-- Les sessions seront listées ici automatiquement -->

### 2026-07-29 - Google Sans auto-hébergée
**Fichier** : [2026-07-29_google-sans-auto-hebergee.md](./2026-07-29_google-sans-auto-hebergee.md)

**Résumé** : Remplacement du chargement de Google Sans par CDN par une intégration auto-hébergée. Les TTF fournis ont été convertis en WOFF2 sous-ensemblés `latin + latin-ext` (~1,9 Mo → ~35 Ko par face), déclarés en `@font-face` manuels avec `font-display: swap`, et branchés sur les tokens `--font-sans` / `--font-mono` du thème shadcn — aucun composant modifié.

**Fichiers créés** :
- `app/public/fonts/google-sans-{400,500,600,700}[-italic].woff2` (8 faces)

**Fichiers modifiés** :
- `app/src/index.css` - `@font-face`, tokens de typographie, convention `b`/`strong` en 600
- `app/index.html` - CDN retiré, preload local du 400 et du 600
- `app/package.json` - `@fontsource-variable/geist` retirée (inutilisée)
- `vercel.json` - cache long pour `/fonts/*.woff2`

**Fichiers supprimés** :
- `google-sans/` - dossier de dépôt temporaire des TTF

**Impact** : ✅ **Majeur** - Zéro requête tierce vers Google Fonts, typographie maîtrisée

---

### 2026-02-12 (Suite) - Proxy Vercel pour la Sécurité
**Fichier** : [2026-02-12_proxy-vercel-securite.md](./2026-02-12_proxy-vercel-securite.md)

**Résumé** : Correction d'une faille de sécurité critique en créant un proxy Vercel serverless. La clé API n'est plus exposée au client - la signature HMAC est maintenant générée côté serveur uniquement.

**Fichiers créés** :
- `api/backend-proxy.ts` - Proxy serverless Vercel
- `api/package.json` - Dépendances pour les fonctions API
- `api/README.md` - Documentation du proxy

**Fichiers modifiés** :
- `app/src/lib/auth.ts` - Utilise maintenant le proxy
- `app/.env.local` - Variables publiques/privées séparées

**Fichiers supprimés** :
- `app/src/lib/hmac.ts` - Plus nécessaire côté client

**Impact** : 🔴 **Critique** - Corrige une faille de sécurité majeure

---

### 2026-02-12 - Intégration Backend
**Fichier** : [2026-02-12_integration-backend.md](./2026-02-12_integration-backend.md)

**Résumé** : Implémentation complète de la communication entre le frontend et le backend Moddy. Ajout de l'authentification Discord OAuth2, signature HMAC des requêtes, hook useAuth, et test de connexion au démarrage.

**Fichiers créés** :
- `app/src/lib/hmac.ts` (⚠️ supprimé plus tard pour sécurité)
- `app/src/lib/auth.ts`
- `app/src/hooks/useAuth.ts`
- `app/.env.local`

**Impact** : ✅ **Majeur** - Connexion backend opérationnelle

---

*Ce dossier est maintenu automatiquement par Claude à chaque session.*
