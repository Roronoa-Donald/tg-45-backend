# Documentation Technique - Système de Réputation

## Architecture Technique

### Stack Technologique
- **ORM**: Prisma 5.22.0
- **Base de données**: PostgreSQL
- **Framework**: Fastify 5
- **Language**: JavaScript (CommonJS)

### Structure des fichiers

```
backend/
├── prisma/
│   ├── schema.prisma                    # Modèles ReputationScore, ReputationEvent, DisputeCase
│   └── migrations/
│       └── 20260515090211_add_reputation_system/
│           └── migration.sql            # Migration SQL
├── services/
│   ├── reputation-service.js            # Service principal
│   ├── verification-service.js          # Intégration certification
│   └── export-service.js                # Intégration rejet export
├── routes/
│   ├── reputation/
│   │   └── index.js                     # Routes API
│   └── index.js                         # Enregistrement routes
├── test/
│   └── reputation-service.test.js       # Tests unitaires
└── docs/
    ├── REPUTATION_SYSTEM.md             # Documentation utilisateur
    └── REPUTATION_TECHNIQUE.md          # Ce fichier

```

## Détails d'implémentation

### 1. Modèle de données Prisma

#### ReputationScore
```prisma
model ReputationScore {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @unique @map("user_id") @db.Uuid
  score        Int      @default(100)
  lastUpdated  DateTime @default(now()) @map("last_updated")
  user         User     @relation(fields: [userId], references: [id])

  @@map("reputation_scores")
  @@index([score])
}
```

**Points clés**:
- Relation 1-1 avec User (userId unique)
- Score par défaut: 100
- Index sur `score` pour requêtes de filtrage rapides
- `lastUpdated` mis à jour automatiquement par Prisma

#### ReputationEvent
```prisma
model ReputationEvent {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  eventType   String   @map("event_type") @db.VarChar(32)
  points      Int
  lotId       String?  @map("lot_id") @db.Uuid
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  user        User     @relation(fields: [userId], references: [id])
  lot         Lot?     @relation(fields: [lotId], references: [id])

  @@map("reputation_events")
  @@index([userId])
  @@index([eventType])
  @@index([createdAt])
}
```

**Points clés**:
- Relation N-1 avec User
- Relation N-0..1 avec Lot (optionnel)
- Index multiples pour requêtes d'historique performantes
- `lotId` nullable pour événements non liés à un lot

### 2. Service reputation-service.js

#### Constants
```javascript
const EVENT_TYPES = {
  LOT_CERTIFIED: 'lot_certified',
  LOT_REJECTED_BY_EXPORTER: 'lot_rejected_by_exporter',
  DISPUTE_PROVEN: 'dispute_proven',
};

const EVENT_POINTS = {
  [EVENT_TYPES.LOT_CERTIFIED]: 5,
  [EVENT_TYPES.LOT_REJECTED_BY_EXPORTER]: -10,
  [EVENT_TYPES.DISPUTE_PROVEN]: -20,
};

const CRITICAL_THRESHOLD = 50;
```

#### Fonction principale: recordEvent()

```javascript
async function recordEvent(prisma, userId, eventType, lotId = null, reason = null) {
  // 1. Valider le type d'événement
  const change = EVENT_POINTS[eventType];
  if (change === undefined) {
    throw new AppError('invalid_event_type', ...);
  }

  // 2. Créer l'événement
  const event = await prisma.reputationEvent.create({
    data: {
      userId,
      eventType,
      points: change,
      lotId,
      description: reason,
    },
  });

  // 3. Obtenir ou créer le score
  let score = await getOrCreateScore(prisma, userId);

  // 4. Calculer nouveau score (min 0)
  const newScore = Math.max(0, score.score + change);
  const previousScore = score.score;

  // 5. Mettre à jour le score
  score = await prisma.reputationScore.update({
    where: { userId },
    data: { score: newScore },
  });

  // 6. Vérifier seuil critique
  const isCritical = newScore <= CRITICAL_THRESHOLD;
  if (isCritical && previousScore > CRITICAL_THRESHOLD) {
    console.warn(`[REPUTATION] User ${userId} dropped to ${newScore}`);
    // TODO: Notification ministère
  }

  return { event, score, previousScore, isCritical, threshold: CRITICAL_THRESHOLD };
}
```

**Gestion des erreurs**:
- Type d'événement invalide → AppError 400
- Erreurs Prisma propagées (utilisateur inexistant, contraintes, etc.)

**Transaction atomique**:
- L'événement et la mise à jour du score doivent être dans une transaction
- Si appelé dans une transaction existante, Prisma le détecte automatiquement

### 3. Intégrations

#### a. Certification (verification-service.js)
```javascript
async function certify(prisma, lotId, actorId, signature, gps) {
  // ...
  const certification = await prisma.$transaction(async (tx) => {
    // Certification logic...
    
    // Réputation: +5 points
    await reputationService.recordEvent(
      tx,
      lot.ownerId,
      reputationService.EVENT_TYPES.LOT_CERTIFIED,
      lot.id,
      'Lot certifié par vérificateur'
    );

    return record;
  });
  // ...
}
```

**Points clés**:
- Utilise la transaction Prisma existante (`tx`)
- Enregistré APRÈS la certification réussie
- Rollback automatique si erreur

#### b. Rejet export (export-service.js)
```javascript
async function updateStatus(prisma, exportId, status, payload) {
  // ...
  const updated = await prisma.$transaction(async (tx) => {
    // Update export status...

    // Si rejeté: -10 points par lot
    if (status === 'rejected' && exportRecord.lots) {
      for (const exportLot of exportRecord.lots) {
        await reputationService.recordEvent(
          tx,
          exportLot.lot.ownerId,
          reputationService.EVENT_TYPES.LOT_REJECTED_BY_EXPORTER,
          exportLot.lot.id,
          payload.note || 'Export rejeté par l\'exportateur'
        );
      }
    }

    return record;
  });
  // ...
}
```

**Points clés**:
- Pénalise TOUS les lots de l'export rejeté
- Utilise la note de rejet comme description
- Transaction garantit cohérence

### 4. Routes API

#### Middleware d'authentification
```javascript
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
```

#### Autorisation des requêtes
```javascript
// Score/History: utilisateur lui-même OU ministère/admin
if (userId !== request.user.sub && 
    !request.user.role.match(/ministry|admin/)) {
  throw new Error('Unauthorized');
}

// Critical/Statistics: ministère/admin uniquement
preHandler: [authenticate, requireRole([USER_ROLES.MINISTRY, USER_ROLES.ADMIN])]
```

#### Format des réponses
```javascript
const { successEnvelope } = require('../../utils/response');

return successEnvelope(data); // { data: {...} }
```

### 5. Migration SQL

La migration crée les tables avec:

```sql
CREATE TABLE "reputation_scores" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID UNIQUE NOT NULL,
    "score" INTEGER DEFAULT 100 NOT NULL,
    "last_updated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE INDEX "reputation_scores_score_idx" ON "reputation_scores"("score");

CREATE TABLE "reputation_events" (
    "id" UUID PRIMARY KEY,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "points" INTEGER NOT NULL,
    "lot_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL
);

CREATE INDEX "reputation_events_user_id_idx" ON "reputation_events"("user_id");
CREATE INDEX "reputation_events_event_type_idx" ON "reputation_events"("event_type");
CREATE INDEX "reputation_events_created_at_idx" ON "reputation_events"("created_at");
```

**Décisions de design**:
- UUID pour tous les IDs (cohérence avec le reste du système)
- `ON DELETE SET NULL` pour lot_id (garder historique si lot supprimé)
- Index pour optimiser requêtes fréquentes:
  - Score < threshold
  - Historique par utilisateur
  - Événements récents

### 6. Tests

#### Exécution
```bash
cd backend
npm test test/reputation-service.test.js
```

#### Couverture
- ✅ Création score initial (100)
- ✅ Incrémentation (+5 certification)
- ✅ Décrémentation (-10 rejet)
- ✅ Détection seuil critique (≤50)
- ✅ Historique
- ✅ Liste utilisateurs critiques
- ✅ Statistiques globales
- ✅ Score minimum (0)

#### Cleanup
Les tests nettoient automatiquement les données créées dans `after()`.

## Performance

### Index stratégiques
1. `reputation_scores(score)`: Requêtes utilisateurs critiques
2. `reputation_events(user_id)`: Historique utilisateur
3. `reputation_events(event_type)`: Statistiques par type
4. `reputation_events(created_at)`: Événements récents

### Optimisations possibles
1. **Cache Redis**: Stocker scores fréquemment consultés
2. **Agrégation**: Pré-calculer statistiques quotidiennement
3. **Pagination**: Limiter résultats événements (déjà fait: limit=50)
4. **Archivage**: Déplacer vieux événements vers table archive

## Sécurité

### Protection des données
- ✅ Utilisateur voit uniquement son propre score
- ✅ Ministère/Admin accès complet
- ✅ Pas de modification manuelle du score (seulement via événements)

### Validation
- ✅ Type d'événement validé (whitelist)
- ✅ UserID vérifié (authentification JWT)
- ✅ Contraintes BDD (foreign keys, unique, not null)

### Audit
Tous les changements sont tracés via:
- Table `reputation_events` (historique complet)
- Logs serveur (console.warn pour scores critiques)

## Monitoring

### Métriques à surveiller
1. Nombre d'utilisateurs avec score < 50
2. Distribution des scores (moyenne, médiane)
3. Fréquence des événements par type
4. Latence des requêtes `/reputation/*`

### Logs
```javascript
console.warn(`[REPUTATION] User ${userId} dropped to critical level: ${newScore}`);
```

### Alertes recommandées
- Pic d'utilisateurs critiques (>5% du total)
- Score moyen en baisse continue
- Explosion du nombre d'événements (attaque?)

## Dépendances

### Directes
- `@prisma/client`: ^5.22.0
- `fastify`: ^5.x
- Pas de dépendances externes supplémentaires

### Modules internes
- `utils/errors.js`: AppError
- `utils/response.js`: successEnvelope
- `utils/auth-hooks.js`: authenticate, requireRole
- `config/constants.js`: USER_ROLES

## Compatibilité

### Backend
- Node.js: ≥18.0.0 (LTS)
- PostgreSQL: ≥13.0

### API
- Format JSON standard
- REST conventionnel
- Codes HTTP appropriés (200, 400, 403, 404)

## Maintenance

### Ajout d'un nouveau type d'événement
```javascript
// 1. Ajouter dans EVENT_TYPES
const EVENT_TYPES = {
  // ... existants
  NEW_EVENT: 'new_event_name',
};

// 2. Ajouter les points
const EVENT_POINTS = {
  // ... existants
  [EVENT_TYPES.NEW_EVENT]: 10, // ou -10
};

// 3. Intégrer dans le workflow approprié
await reputationService.recordEvent(
  prisma,
  userId,
  reputationService.EVENT_TYPES.NEW_EVENT,
  entityId,
  'Description'
);
```

### Modification du seuil critique
```javascript
// Changer la constante
const CRITICAL_THRESHOLD = 40; // nouveau seuil

// Aucune migration nécessaire (valeur applicative)
```

## Troubleshooting

### Erreur: "invalid_event_type"
- **Cause**: Type d'événement non reconnu
- **Solution**: Vérifier EVENT_TYPES constant

### Score non mis à jour
- **Cause**: Transaction rollback
- **Solution**: Vérifier logs d'erreur Prisma

### Utilisateur critique non notifié
- **Cause**: Console.warn pas capturé
- **Solution**: Implémenter système de notification (webhook, email)

## Évolutions prévues

### Court terme (1-2 semaines)
- [ ] Webhook de notification Ministère
- [ ] Endpoint de contestation d'événement

### Moyen terme (1 mois)
- [ ] Dashboard frontend avec graphiques
- [ ] Export CSV des rapports de réputation

### Long terme (3+ mois)
- [ ] Machine learning pour détection de fraude
- [ ] Réputation des coopératives (agrégée)
- [ ] Système de badges et gamification
