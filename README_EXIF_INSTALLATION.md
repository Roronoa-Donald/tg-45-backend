# Installation de l'Extraction EXIF - Guide Rapide

## Vue d'ensemble

L'extraction des métadonnées EXIF a été implémentée pour ChainCacao. Cette fonctionnalité améliore la traçabilité des photos et la validation GPS automatique des parcelles et lots.

## Prérequis

- Node.js >= 22
- PostgreSQL
- npm

## Installation Rapide

### Option 1: Script PowerShell (Windows - Recommandé)

```powershell
cd C:\Users\donald\Desktop\projets\tg45\backend
.\scripts\install-exif.ps1
```

### Option 2: Script Bash (Linux/Mac ou Git Bash)

```bash
cd /c/Users/donald/Desktop/projets/tg45/backend
bash scripts/install-exif.sh
```

### Option 3: Installation Manuelle

```bash
cd backend

# 1. Installer exifr
npm install exifr

# 2. Appliquer la migration
npx prisma migrate deploy

# 3. Générer le client Prisma
npx prisma generate

# 4. Exécuter les tests
npm test test/unit/exif-service.test.js
```

## Vérification de l'installation

### 1. Vérifier que les fichiers existent

```bash
# Service EXIF
ls services/exif-service.js

# Migration
ls prisma/migrations/20260515085709_add_exif_metadata/migration.sql

# Tests
ls test/unit/exif-service.test.js

# Documentation
ls docs/EXIF_EXTRACTION.md
```

### 2. Vérifier que le package est installé

```bash
npm list exifr
```

Sortie attendue:
```
tg45-backend@0.1.0 C:\Users\donald\Desktop\projets\tg45\backend
└── exifr@7.1.3
```

### 3. Vérifier que la migration est appliquée

```bash
npx prisma migrate status
```

Sortie attendue (doit inclure):
```
✓ 20260515085709_add_exif_metadata
```

### 4. Exécuter les tests

```bash
npm test test/unit/exif-service.test.js
```

Sortie attendue:
```
✔ exifService - extractExif should return null for invalid input
✔ exifService - isGpsInsideParcel should validate point in polygon
✔ exifService - validateGpsInPolygon should reject missing GPS
✔ exifService - validateGpsInPolygon should accept non-polygon parcels
✔ exifService - validatePhotoRecency should reject old photos
✔ exifService - validatePhotoRecency should accept recent photos
✔ exifService - validatePhotoRecency should reject future dates
✔ exifService - validatePhotoRecency should reject missing date
```

## Démarrage du serveur

```bash
npm run dev
```

Le serveur doit démarrer sans erreur sur le port configuré (ex: 3000).

## Test de l'API

### 1. Upload d'une photo de lot avec EXIF

```bash
curl -X POST http://localhost:3000/lots/{lotId}/images \
  -H "Authorization: Bearer {token}" \
  -F "file=@/path/to/photo.jpg"
```

Réponse attendue:
```json
{
  "data": {
    "id": "uuid",
    "lotId": "uuid",
    "url": "https://cloudinary.com/...",
    "exifData": {
      "gps": {
        "lat": 6.172520,
        "lng": 1.231738
      },
      "dateTaken": "2026-05-15T08:30:45.000Z",
      "make": "Apple",
      "model": "iPhone 14 Pro"
    },
    "gpsLat": 6.172520,
    "gpsLng": 1.231738,
    "takenAt": "2026-05-15T08:30:45.000Z"
  }
}
```

### 2. Upload d'une photo de validation de parcelle

```bash
curl -X POST http://localhost:3000/parcels/validation/{validationId}/photos \
  -H "Authorization: Bearer {token}" \
  -d '{
    "url": "https://cloudinary.com/...",
    "gpsLat": 6.172520,
    "gpsLng": 1.231738,
    "takenAt": "2026-05-15T08:30:45.000Z"
  }'
```

Réponse attendue:
```json
{
  "data": {
    "id": "uuid",
    "validationId": "uuid",
    "url": "https://cloudinary.com/...",
    "gpsLat": 6.172520,
    "gpsLng": 1.231738,
    "isInsideParcel": true,
    "gpsValid": true,
    "gpsValidationReason": null,
    "exifData": { ... }
  }
}
```

## Vérification en base de données

### 1. Vérifier que les colonnes EXIF existent

```sql
-- Table lot_images
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lot_images' 
  AND column_name IN ('exif_data', 'gps_lat', 'gps_lng', 'taken_at');
```

Sortie attendue:
```
 column_name | data_type
-------------+-----------
 exif_data   | jsonb
 gps_lat     | numeric
 gps_lng     | numeric
 taken_at    | timestamp
```

### 2. Vérifier les photos avec EXIF

```sql
-- Compter les photos avec EXIF
SELECT 
  COUNT(*) AS total,
  COUNT(exif_data) AS with_exif,
  COUNT(gps_lat) AS with_gps,
  COUNT(taken_at) AS with_date
FROM lot_images;
```

### 3. Vérifier les validations de parcelle

```sql
-- Validations avec GPS invalide
SELECT id, gps_valid, gps_validation_reason
FROM parcel_validation_photos
WHERE gps_valid = false;
```

## Dépannage

### Erreur: "Cannot find module 'exifr'"

**Solution**: Réinstaller le package
```bash
npm install exifr
```

### Erreur: "Column 'exif_data' does not exist"

**Solution**: Appliquer la migration
```bash
npx prisma migrate deploy
npx prisma generate
```

### Erreur: "Failed to parse EXIF"

**Cause**: Photo sans métadonnées EXIF (galerie, éditée)
**Solution**: Normal, le système retourne `null` et utilise les données manuelles

### Tests échouent

**Solution**: Vérifier que tous les fichiers sont présents
```bash
ls services/exif-service.js
ls test/unit/exif-service.test.js
```

## Documentation Complète

Pour plus de détails, consulter:

1. **Architecture**: `docs/EXIF_EXTRACTION.md`
2. **Implémentation**: `IMPLEMENTATION_EXIF.md`
3. **API**: `routes/lots/images.js`, `routes/parcels/validation.js`
4. **Service**: `services/exif-service.js`
5. **Tests**: `test/unit/exif-service.test.js`

## Fichiers Créés

### Services
- `backend/services/exif-service.js` (198 lignes)

### Migrations
- `backend/prisma/migrations/20260515085709_add_exif_metadata/migration.sql`

### Tests
- `backend/test/unit/exif-service.test.js` (78 lignes)

### Documentation
- `backend/docs/EXIF_EXTRACTION.md` (220 lignes)
- `backend/IMPLEMENTATION_EXIF.md` (630 lignes)
- `backend/README_EXIF_INSTALLATION.md` (ce fichier)

### Scripts
- `backend/scripts/install-exif.sh` (Bash)
- `backend/scripts/install-exif.ps1` (PowerShell)

## Fichiers Modifiés

### Schéma
- `backend/prisma/schema.prisma`
  - Modèle `LotImage`: +4 colonnes (exifData, gpsLat, gpsLng, takenAt)
  - Modèle `ParcelValidationPhoto`: +3 colonnes (exifData, gpsValid, gpsValidationReason)

### Services
- `backend/services/parcel-validation-service.js`
  - Fonction `addValidationPhoto()`: Extraction et validation EXIF
  
- `backend/services/lot-service.js`
  - Fonction `addImage()`: Extraction EXIF lors upload

### Routes
- `backend/routes/lots/images.js`
  - Import `exif-service`

## Support

En cas de problème:

1. Consulter la section Dépannage ci-dessus
2. Vérifier les logs: `npm run dev` (console)
3. Examiner la documentation complète dans `docs/EXIF_EXTRACTION.md`
4. Vérifier que la migration est appliquée: `npx prisma migrate status`
5. Réexécuter les tests: `npm test test/unit/exif-service.test.js`

## Prochaines Étapes

Après installation:

1. ✅ Redémarrer le serveur: `npm run dev`
2. ✅ Tester l'upload de photos sur l'API
3. ✅ Vérifier les métadonnées EXIF en base de données
4. ✅ Consulter les événements de validation dans `parcel_validation_photos`
5. ✅ Intégrer avec le frontend/mobile

## Changelog

### v1.0.0 (2026-05-15) - Initial Release
- ✅ Service EXIF complet
- ✅ Migration base de données
- ✅ Intégration workflow parcelle et lot
- ✅ Tests unitaires (8 tests)
- ✅ Documentation exhaustive
- ✅ Scripts d'installation

## Auteur

Claude Code - Implémentation EXIF pour ChainCacao

## License

Propriétaire - ChainCacao/TG45
