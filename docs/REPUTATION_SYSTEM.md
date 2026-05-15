# Système de Réputation - ChainCacao

## Vue d'ensemble

Le système de réputation permet de suivre et évaluer la fiabilité des acteurs (principalement les agriculteurs) basé sur leurs actions dans le système ChainCacao.

## Architecture

### Modèles de données

#### ReputationScore
Stocke le score de réputation actuel pour chaque utilisateur.

```prisma
model ReputationScore {
  id           String   @id @default(uuid())
  userId       String   @unique
  score        Int      @default(100)      // Score initial: 100
  lastUpdated  DateTime @default(now())
  user         User     @relation(...)
}
```

#### ReputationEvent
Historique de tous les événements affectant la réputation.

```prisma
model ReputationEvent {
  id          String   @id @default(uuid())
  userId      String
  eventType   String   // Type d'événement
  points      Int      // Points gagnés/perdus
  lotId       String?  // Lot concerné (optionnel)
  description String?  // Raison de l'événement
  createdAt   DateTime @default(now())
  user        User
  lot         Lot?
}
```

## Types d'événements

### 1. Lot Certifié (`lot_certified`)
- **Points**: +5
- **Déclencheur**: Quand un vérificateur certifie un lot
- **Impact**: Récompense l'agriculteur pour un lot de qualité

### 2. Lot Rejeté par Exportateur (`lot_rejected_by_exporter`)
- **Points**: -10
- **Déclencheur**: Quand un exportateur rejette un export contenant le lot
- **Impact**: Pénalise l'agriculteur pour non-conformité

### 3. Litige Prouvé (`dispute_proven`)
- **Points**: -20
- **Déclencheur**: Quand un litige est résolu en défaveur de l'agriculteur
- **Impact**: Forte pénalité pour fraude avérée

## Seuil Critique

**Seuil**: 50 points

Quand un utilisateur tombe en dessous de ce seuil:
- Notification automatique au Ministère
- Alerte visible dans le système
- Peut déclencher des audits ou suspensions

## API Endpoints

### GET `/reputation/score`
Obtenir le score de réputation d'un utilisateur.

**Query params**:
- `userId` (optionnel): ID de l'utilisateur (par défaut: utilisateur connecté)

**Réponse**:
```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "score": 85,
    "lastUpdated": "2026-05-15T09:00:00Z",
    "isCritical": false,
    "threshold": 50
  }
}
```

### GET `/reputation/history`
Obtenir l'historique des événements de réputation.

**Query params**:
- `userId` (optionnel): ID de l'utilisateur
- `limit` (optionnel): Nombre d'événements (défaut: 50)

**Réponse**:
```json
{
  "data": {
    "score": { "score": 85, ... },
    "events": [
      {
        "id": "uuid",
        "eventType": "lot_certified",
        "points": 5,
        "lotId": "uuid",
        "description": "Lot certifié par vérificateur",
        "createdAt": "2026-05-15T08:00:00Z",
        "lot": {
          "lotCode": "TG-2026-001",
          "product": "Cacao",
          "status": "certified"
        }
      }
    ],
    "isCritical": false
  }
}
```

### GET `/reputation/critical`
Liste des utilisateurs avec score critique (réservé Ministère/Admin).

**Réponse**:
```json
{
  "data": {
    "users": [
      {
        "id": "uuid",
        "userId": "uuid",
        "score": 35,
        "lastUpdated": "2026-05-15T09:00:00Z",
        "isCritical": true,
        "threshold": 50,
        "user": {
          "name": "Jean Doe",
          "role": "farmer",
          "email": "jean@example.com"
        }
      }
    ]
  }
}
```

### GET `/reputation/statistics`
Statistiques globales sur la réputation (réservé Ministère/Admin).

**Réponse**:
```json
{
  "data": {
    "totalUsers": 1500,
    "criticalUsers": 12,
    "averageScore": 78.5,
    "recentEventsLast7Days": 234,
    "threshold": 50
  }
}
```

## Intégration dans les workflows

### 1. Certification de lot
Dans `services/verification-service.js`:

```javascript
async function certify(prisma, lotId, actorId, signature, gps) {
  // ... certification logic ...
  
  // Enregistrer l'événement de réputation
  await reputationService.recordEvent(
    tx,
    lot.ownerId,
    reputationService.EVENT_TYPES.LOT_CERTIFIED,
    lot.id,
    'Lot certifié par vérificateur'
  );
}
```

### 2. Rejet d'export
Dans `services/export-service.js`:

```javascript
async function updateStatus(prisma, exportId, status, payload) {
  // ... update logic ...
  
  // Si rejeté, pénaliser les propriétaires des lots
  if (status === 'rejected') {
    for (const exportLot of exportRecord.lots) {
      await reputationService.recordEvent(
        tx,
        exportLot.lot.ownerId,
        reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
        exportLot.lot.id,
        payload.note || 'Export rejeté par exportateur'
      );
    }
  }
}
```

## Service API

Le service `reputation-service.js` expose les fonctions suivantes:

- `recordEvent(prisma, userId, eventType, lotId, description)`: Enregistre un événement
- `getScore(prisma, userId)`: Obtient le score actuel
- `getHistory(prisma, userId, limit)`: Obtient l'historique
- `getCriticalUsers(prisma)`: Liste les utilisateurs critiques
- `getStatistics(prisma)`: Statistiques globales

## Permissions

- **Utilisateur**: Peut voir son propre score et historique
- **Ministère/Admin**: Peut voir tous les scores, historiques et statistiques

## Migration

La migration `20260515090211_add_reputation_system` crée:
- Table `reputation_scores`
- Table `reputation_events`
- Table `dispute_cases` (pour le système de litiges)
- Index appropriés pour performance
- Contraintes de clés étrangères

## Évolutions futures

1. **Notifications push**: Alertes en temps réel pour scores critiques
2. **Dashboard de réputation**: Visualisation graphique dans le frontend
3. **Gamification**: Badges et niveaux basés sur le score
4. **Pondération dynamique**: Ajuster les points selon le contexte
5. **Réputation des coopératives**: Agrégation des scores des membres
