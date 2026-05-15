# Système de Carte QR Agriculteur - ChainCacao

## Vue d'ensemble

Le système de carte QR permet aux agriculteurs de s'identifier rapidement via un QR code unique au lieu de saisir manuellement leur téléphone et PIN.

## Fonctionnalités

### 1. Génération de carte QR

Chaque agriculteur peut générer une carte QR contenant :
- Token unique cryptographiquement sécurisé
- Nom et téléphone
- ID coopérative
- Date de génération

Le QR code est généré au format PNG en base64 (Data URL), prêt pour affichage ou impression.

### 2. Authentification par QR

Un agriculteur peut scanner son QR code pour se connecter instantanément sans saisir ses identifiants.

### 3. Révocation

Les QR codes peuvent être révoqués (par la coopérative ou l'admin) pour invalider l'ancien code et en générer un nouveau.

## Endpoints API

### POST /farmer-card/generate

Génère un QR code pour l'agriculteur connecté.

**Auth:** Farmer uniquement

**Response:**
```json
{
  "data": {
    "token": "FARMER-uuid-timestamp-random",
    "qrCodeDataUrl": "data:image/png;base64,...",
    "qrData": {
      "type": "FARMER_CARD",
      "token": "...",
      "userId": "...",
      "name": "...",
      "phone": "...",
      "cooperativeId": "...",
      "generatedAt": "2026-05-15T09:00:00.000Z"
    }
  }
}
```

### POST /farmer-card/regenerate/:userId

Régénère un QR code pour un agriculteur (invalide l'ancien).

**Auth:** Cooperative, Ministry, Admin

**Response:** Même structure que `/generate`

### DELETE /farmer-card/revoke/:userId

Révoque le QR code d'un agriculteur.

**Auth:** Cooperative, Ministry, Admin

**Response:**
```json
{
  "data": {
    "success": true,
    "message": "QR code revoked"
  }
}
```

### POST /farmer-card/verify

Vérifie un token QR scanné et retourne les informations de l'agriculteur.

**Auth:** Requis (tout rôle)

**Body:**
```json
{
  "token": "FARMER-uuid-timestamp-random"
}
```

**Response:**
```json
{
  "data": {
    "id": "...",
    "name": "...",
    "phone": "...",
    "role": "farmer",
    "status": "active",
    "cooperativeId": "...",
    "cooperative": {
      "id": "...",
      "name": "..."
    }
  }
}
```

### POST /farmer-card/login-with-qr

Authentifie un agriculteur via son QR code et retourne un JWT.

**Auth:** Aucune (endpoint public)

**Body:**
```json
{
  "token": "FARMER-uuid-timestamp-random"
}
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "name": "...",
      "phone": "...",
      "role": "farmer",
      "cooperativeId": "..."
    }
  }
}
```

## Sécurité

### Format du token

```
FARMER-{userId}-{timestamp}-{random16hex}
```

Exemple : `FARMER-550e8400-e29b-41d4-a716-446655440000-1715766000000-a1b2c3d4e5f67890`

### Unicité

- Le token est stocké dans la colonne `farmer_qr_token` de la table `users`
- Contrainte `UNIQUE` en base de données
- Un agriculteur ne peut avoir qu'un seul token valide à la fois

### Révocation

- La régénération invalide automatiquement l'ancien token
- La révocation supprime le token (mise à `NULL`)
- Les tokens révoqués retournent une erreur `401 Unauthorized`

### Validation

Le système vérifie :
1. Le token existe dans la base
2. L'utilisateur est bien un farmer
3. Le compte est actif (`status = 'active'`)

## Cas d'usage

### 1. Génération initiale

**Scénario :** Un agriculteur reçoit sa carte QR lors de l'inscription.

**Workflow :**
1. La coopérative crée le compte de l'agriculteur
2. POST `/farmer-card/regenerate/{userId}` (par la coopérative)
3. Impression ou envoi par SMS/WhatsApp du QR code
4. L'agriculteur conserve son QR code sur son téléphone ou imprimé

### 2. Login rapide sur mobile

**Scénario :** L'agriculteur souhaite se connecter rapidement.

**Workflow :**
1. Scanner le QR code avec la caméra
2. POST `/farmer-card/login-with-qr` avec le token extrait
3. Réception du JWT
4. Connexion automatique

### 3. QR compromis

**Scénario :** L'agriculteur perd son QR code ou le partage accidentellement.

**Workflow :**
1. L'agriculteur contacte sa coopérative
2. DELETE `/farmer-card/revoke/{userId}` (par la coopérative)
3. POST `/farmer-card/regenerate/{userId}` (par la coopérative)
4. Nouveau QR code envoyé à l'agriculteur

### 4. Vérification par coopérative

**Scénario :** Vérifier l'identité d'un agriculteur lors d'une livraison.

**Workflow :**
1. Agriculteur présente son QR code
2. Agent coopérative scanne avec l'app
3. POST `/farmer-card/verify` avec le token
4. Affichage du profil complet de l'agriculteur

## Intégration Mobile

### Scanner QR (React Native + Expo)

```typescript
import { Camera } from 'expo-camera';

const handleBarCodeScanned = async ({ data }: { data: string }) => {
  try {
    const parsed = JSON.parse(data);
    
    if (parsed.type !== 'FARMER_CARD') {
      Alert.alert('Erreur', 'QR code invalide');
      return;
    }

    const response = await fetch(`${API_URL}/farmer-card/login-with-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: parsed.token }),
    });

    const result = await response.json();
    
    // Stocker le JWT et connecter l'utilisateur
    await AsyncStorage.setItem('token', result.data.token);
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Erreur', 'QR code invalide ou expiré');
  }
};
```

### Afficher QR (React Native)

```typescript
import { Image } from 'react-native';

const generateQR = async () => {
  const response = await fetch(`${API_URL}/farmer-card/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();
  setQrDataUrl(result.data.qrCodeDataUrl);
};

// Affichage
<Image
  source={{ uri: qrDataUrl }}
  style={{ width: 300, height: 300 }}
/>
```

## Base de données

### Migration

```sql
-- 20260515091953_add_farmer_qr_token/migration.sql
ALTER TABLE "users" ADD COLUMN "farmer_qr_token" VARCHAR(100);
CREATE UNIQUE INDEX "users_farmer_qr_token_key" ON "users"("farmer_qr_token");
```

### Schema Prisma

```prisma
model User {
  // ... autres champs
  farmerQrToken String? @unique @map("farmer_qr_token") @db.VarChar(100)
  // ...
}
```

## Tests

### Test manuel avec curl

```bash
# 1. Générer QR (nécessite JWT d'un farmer)
curl -X POST http://localhost:5601/farmer-card/generate \
  -H "Authorization: Bearer YOUR_FARMER_JWT"

# 2. Login avec QR
curl -X POST http://localhost:5601/farmer-card/login-with-qr \
  -H "Content-Type: application/json" \
  -d '{"token":"FARMER-..."}'

# 3. Vérifier QR (nécessite JWT)
curl -X POST http://localhost:5601/farmer-card/verify \
  -H "Authorization: Bearer ANY_JWT" \
  -H "Content-Type: application/json" \
  -d '{"token":"FARMER-..."}'

# 4. Révoquer QR (cooperative/admin)
curl -X DELETE http://localhost:5601/farmer-card/revoke/USER_ID \
  -H "Authorization: Bearer COOPERATIVE_JWT"
```

## Limites et considérations

### Sécurité

- **Ne pas partager le QR code :** Il permet une connexion sans mot de passe
- **Protection physique :** Éviter d'afficher le QR code publiquement
- **Durée de vie :** Pas d'expiration automatique (révocation manuelle uniquement)

### Performance

- Génération QR : ~50ms par code
- Scan + vérification : ~200ms
- Pas de rate limiting par défaut (à implémenter si nécessaire)

### Alternatives considérées

1. **NFC :** Nécessite matériel spécifique, moins universel que QR
2. **SMS OTP :** Plus lent, coût SMS, nécessite réseau
3. **Biométrie :** Complexe, nécessite matériel, problèmes de confidentialité

## Roadmap

- [ ] Expiration automatique des tokens après X jours
- [ ] Historique des scans (audit trail)
- [ ] Rate limiting sur `/login-with-qr`
- [ ] Support multi-QR (plusieurs QR codes actifs par agriculteur)
- [ ] Intégration WhatsApp Business pour envoi automatique

## Support

Pour toute question sur le système de carte QR, contactez l'équipe technique ChainCacao.

**Date de création :** 15 Mai 2026  
**Version :** 1.0  
**Auteur :** Équipe ChainCacao
