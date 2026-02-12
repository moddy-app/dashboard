# Sécurité

## Vue d'ensemble

Le backend Moddy implémente plusieurs couches de sécurité pour protéger les données utilisateur et prévenir les attaques.

## HMAC Signature

### Principe

Toutes les requêtes vers `/api/website/` doivent être signées avec HMAC-SHA256. Cela garantit :

1. **Authenticité** - La requête vient bien du frontend autorisé
2. **Intégrité** - Les données n'ont pas été modifiées en transit
3. **Non-répudiation** - On peut prouver qui a fait la requête

### Algorithme

```
HMAC-SHA256(key, message) → signature
```

**Clé :** `API_KEY` (partagée entre frontend et backend)
**Message :** `{"request_id": "...", "body": {...}}`
**Signature :** Hash hexadécimal de 64 caractères

### Implémentation Backend

```python
# app/services/hmac_security.py
import hmac
import hashlib
import json

def generate_signature(data: dict, api_key: str) -> str:
    message = json.dumps(data, sort_keys=True)  # Important: trier les clés
    signature = hmac.new(
        api_key.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature

def verify_signature(data: dict, received_signature: str) -> bool:
    expected_signature = generate_signature(data)
    return hmac.compare_digest(expected_signature, received_signature)
```

### Implémentation Frontend

```javascript
// Frontend (JavaScript)
import crypto from 'crypto';

function generateSignature(requestId, body = {}) {
  const payload = {
    request_id: requestId,
    body: body
  };

  // Important: trier les clés pour avoir le même ordre que Python
  const message = JSON.stringify(payload, Object.keys(payload).sort());

  const signature = crypto
    .createHmac('sha256', API_KEY)
    .update(message)
    .digest('hex');

  return signature;
}
```

### Protection contre les attaques

✅ **Man-in-the-middle** - Même si attaquant intercepte la requête, il ne peut pas la modifier sans invalider la signature

✅ **Replay attacks** - Chaque requête a un UUID unique (`request_id`), on pourrait logger et rejeter les doublons

✅ **Tampering** - Toute modification du body invalide la signature

⚠️ **Pas encore implémenté :**
- Timestamp dans la signature (expiration des requêtes)
- Nonce pour vraiment prévenir replay attacks
- Rate limiting par signature

## Cookies de session

### Configuration

```python
response.set_cookie(
    key="moddy_session",
    value=session.token,
    max_age=2592000,  # 30 jours
    domain=".moddy.app",  # Valide sur tous sous-domaines
    path="/",
    httponly=True,    # ✅ Pas accessible en JavaScript
    secure=True,      # ✅ HTTPS uniquement
    samesite="lax"    # ✅ Protection CSRF
)
```

### Attributs de sécurité

| Attribut | Valeur | Protection |
|----------|--------|------------|
| `HttpOnly` | `true` | Empêche JavaScript d'accéder au cookie (XSS) |
| `Secure` | `true` | Cookie envoyé uniquement en HTTPS |
| `SameSite` | `lax` | Cookie pas envoyé sur requêtes cross-site (CSRF) |
| `Domain` | `.moddy.app` | Valide sur moddy.app et sous-domaines |
| `Path` | `/` | Valide sur tout le site |
| `Max-Age` | `2592000` | Expire après 30 jours |

### Token de session

Les tokens sont générés avec `secrets.token_urlsafe(32)` :

```python
import secrets

token = secrets.token_urlsafe(32)
# Exemple: "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-"
```

**Propriétés :**
- 32 bytes = 256 bits d'entropie
- URL-safe (base64url)
- Cryptographiquement sécurisé

### Validation

```python
def get_session_by_token(db: Session, token: str) -> Optional[SessionModel]:
    session = db.query(SessionModel).filter(
        SessionModel.token == token
    ).first()

    if not session:
        return None

    # Vérifier expiration
    if session.expires_at < datetime.now(timezone.utc):
        db.delete(session)
        db.commit()
        return None

    return session
```

## Validation des redirections

### Principe

Après l'authentification Discord, on redirige l'utilisateur vers la page d'origine. Pour éviter l'**Open Redirect vulnerability**, on valide l'URL.

### Implémentation

```python
def is_allowed_redirect(url: str) -> bool:
    """Vérifie si l'URL est sur moddy.app ou sous-domaine."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    if domain == "moddy.app" or domain.endswith(".moddy.app"):
        return True

    return False

# Usage
if not is_allowed_redirect(redirect_url):
    redirect_url = "https://moddy.app"  # Fallback sécurisé
```

### URLs autorisées

✅ `https://moddy.app`
✅ `https://www.moddy.app`
✅ `https://dashboard.moddy.app`
✅ `https://api.moddy.app`
❌ `https://evil.com`
❌ `https://moddy.app.evil.com`

## Discord OAuth2

### Sécurité du flow

1. **State parameter** - Prévient CSRF sur le callback OAuth
2. **HTTPS uniquement** - redirect_uri en HTTPS
3. **Code éphémère** - Code d'autorisation à usage unique
4. **Refresh token stocké** - Permet de renouveler sans re-auth

### Scopes demandés

```
identify - ID, username, discriminator, avatar
email    - Adresse email (peut ne pas être fournie)
```

On demande le **minimum nécessaire** (principe du moindre privilège).

### Stockage des tokens

| Token | Stocké où | Durée | Utilité |
|-------|-----------|-------|---------|
| Access token | ❌ Pas stocké | 7 jours | Récupérer user info (utilisé immédiatement) |
| Refresh token | ✅ DB (`users.refresh_token`) | Permanent | Renouveler l'access token |
| Session token | ✅ DB (`sessions.token`) + Cookie | 30 jours | Authentifier l'user |

## CORS

### Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://moddy.app",
        "https://www.moddy.app",
        "https://*.moddy.app",
    ],
    allow_credentials=True,  # Nécessaire pour cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

### Protection

- Seuls les domaines moddy.app peuvent faire des requêtes AJAX
- `allow_credentials=True` permet l'envoi de cookies
- Preflight requests (OPTIONS) gérées automatiquement

## HTTPS

### Enforcing HTTPS

Le backend **n'accepte que HTTPS**. Railway gère automatiquement le certificat SSL/TLS.

**Cookies Secure** → Envoyés uniquement en HTTPS
**HSTS** → (à configurer) Force HTTPS côté client

### Certificat

Railway utilise Let's Encrypt pour générer automatiquement un certificat SSL/TLS valide.

## Variables d'environnement

### Sécurité

✅ Stockées sur Railway (pas dans le code)
✅ Pas dans .env (qui serait commité)
✅ Accès limité aux collaborateurs Railway

### Variables sensibles

| Variable | Sensibilité | Utilité |
|----------|-------------|---------|
| `DATABASE_URL` | 🔴 Critique | Accès total à la DB |
| `API_KEY` | 🔴 Critique | Signe les requêtes |
| `DISCORD_CLIENT_SECRET` | 🔴 Critique | OAuth2 Discord |
| `DISCORD_CLIENT_ID` | 🟡 Modérée | Public dans l'URL OAuth |

**⚠️ Ne JAMAIS commiter ces variables !**

## SQL Injection

### Protection

SQLAlchemy utilise des **parameterized queries** automatiquement :

```python
# ✅ Sécurisé (SQLAlchemy)
user = db.query(User).filter(User.discord_id == discord_id).first()

# ❌ Dangereux (si on faisait du SQL brut)
db.execute(f"SELECT * FROM users WHERE discord_id = {discord_id}")
```

Toutes nos requêtes passent par l'ORM SQLAlchemy → **Pas de risque d'injection**.

## XSS (Cross-Site Scripting)

### Protection

1. **HttpOnly cookies** - JavaScript ne peut pas lire `moddy_session`
2. **Pas de HTML rendering** - API JSON uniquement
3. **Content-Type** - Toujours `application/json`

Le frontend doit aussi échapper les données utilisateur (username, etc.).

## CSRF (Cross-Site Request Forgery)

### Protection

1. **SameSite=Lax** - Cookie pas envoyé sur POST cross-site
2. **HMAC signature** - Requêtes doivent être signées
3. **State parameter** - OAuth callback protégé

### Limitation

⚠️ Pas de token CSRF explicite. Pour une protection maximale, on pourrait ajouter un header `X-CSRF-Token`.

## Rate Limiting

### ⚠️ Pas encore implémenté

À implémenter avec Redis :

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/website/auth/init")
@limiter.limit("10/minute")
async def init_auth(...):
    ...
```

**Limites suggérées :**
- `/api/website/*` : 100 req/min par IP
- `/auth/discord/callback` : 10 req/min par IP

## Checklist de sécurité

### ✅ Implémenté

- [x] HTTPS obligatoire
- [x] HMAC signature sur API
- [x] HttpOnly + Secure cookies
- [x] SameSite protection
- [x] Validation des redirections
- [x] State parameter OAuth
- [x] Secrets sécurisés (token_urlsafe)
- [x] CORS restrictif
- [x] Parameterized queries (SQL injection)
- [x] Sessions avec expiration

### ⚠️ À implémenter

- [ ] Rate limiting
- [ ] Timestamp dans HMAC (expiration requêtes)
- [ ] Nonce pour replay protection
- [ ] Monitoring & alertes
- [ ] HSTS header
- [ ] CSP header (si on rendait du HTML)
- [ ] Hash des tokens en DB
- [ ] Encryption des emails en DB
- [ ] Audit logs

## Incident Response

### En cas de compromission

1. **API_KEY leak** → Régénérer immédiatement
2. **DATABASE_URL leak** → Changer mot de passe DB
3. **DISCORD_CLIENT_SECRET leak** → Régénérer sur Discord Developer Portal
4. **Token leak** → Supprimer les sessions compromises

### Rotation des secrets

Bonne pratique : Rotater les secrets régulièrement (tous les 90 jours).

```bash
# Générer un nouvel API_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
