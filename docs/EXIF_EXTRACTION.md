# Extraction des Métadonnées EXIF

## Vue d'ensemble

Le système ChainCacao extrait automatiquement les métadonnées EXIF des photos uploadées pour améliorer la traçabilité et la validation GPS.

## Fonctionnalités

### 1. Extraction automatique EXIF
- **GPS**: Latitude, longitude, altitude
- **Date/Heure**: Date de prise de photo (DateTimeOriginal, DateTime, CreateDate)
- **Appareil**: Marque et modèle (Make, Model)
- **Paramètres**: ISO, temps d'exposition, ouverture, focale
- **Dimensions**: Largeur, hauteur, orientation

### 2. Validation GPS dans polygone
- Vérifie que les coordonnées GPS de la photo sont à l'intérieur du polygone de la parcelle
- Utilise l'algorithme ray-casting pour la détection point-dans-polygone
- Stocke le résultat de validation dans `gps_valid` et la raison dans `gps_validation_reason`

### 3. Validation de la date de prise
- Vérifie que la photo a été prise récemment (max 7 jours par défaut)
- Rejette les photos avec date future (clock manipulation)
- Stocke la raison d'invalidation dans `gps_validation_reason`

## Architecture

### Service: `exif-service.js`
```javascript
const exifService = require('./services/exif-service');

// Extraire EXIF d'un buffer, URL ou chemin
const metadata = await exifService.extractExif(buffer);

// Valider GPS dans polygone
const validation = exifService.validateGpsInPolygon(
  { lat: 6.123, lng: 1.456 },
  parcelGeometry
);

// Valider date de prise
const dateValidation = exifService.validatePhotoRecency(
  metadata.dateTaken,
  7 // max jours
);
```

### Intégrations

#### 1. Upload d'images de lot (`routes/lots/images.js`)
- Extrait EXIF du buffer uploadé
- Stocke les métadonnées dans `lot_images.exif_data` (JSONB)
- Extrait GPS et date dans colonnes dédiées
- Enregistre un événement `media_upload` avec flag `hasExif`, `hasGps`, `hasTakenAt`

#### 2. Validation de parcelle (`services/parcel-validation-service.js`)
- Extrait EXIF lors de l'ajout de photo
- Valide GPS dans polygone de la parcelle
- Valide date de prise (max 7 jours)
- Stocke `gps_valid` et `gps_validation_reason`
- Utilise GPS EXIF en priorité sur GPS fourni manuellement

## Schéma Base de Données

### Table: `lot_images`
```sql
ALTER TABLE lot_images ADD COLUMN exif_data JSONB;
ALTER TABLE lot_images ADD COLUMN gps_lat DECIMAL(10,8);
ALTER TABLE lot_images ADD COLUMN gps_lng DECIMAL(11,8);
ALTER TABLE lot_images ADD COLUMN taken_at TIMESTAMP;
```

### Table: `parcel_validation_photos`
```sql
ALTER TABLE parcel_validation_photos ADD COLUMN exif_data JSONB;
ALTER TABLE parcel_validation_photos ADD COLUMN gps_valid BOOLEAN DEFAULT true;
ALTER TABLE parcel_validation_photos ADD COLUMN gps_validation_reason TEXT;
```

## Migration

```bash
# Appliquer la migration
cd backend
npx prisma migrate deploy

# Regénérer le client Prisma
npx prisma generate
```

## Tests

```bash
# Exécuter les tests unitaires
npm test test/unit/exif-service.test.js
```

## Exemple de métadonnées EXIF extraites

```json
{
  "gps": {
    "lat": 6.172520,
    "lng": 1.231738,
    "altitude": 125.5
  },
  "dateTaken": "2026-05-15T08:30:45.000Z",
  "make": "Apple",
  "model": "iPhone 14 Pro",
  "iso": 64,
  "exposureTime": 0.0083,
  "fNumber": 1.78,
  "focalLength": 5.7,
  "width": 4032,
  "height": 3024,
  "orientation": 1
}
```

## Cas d'usage

### 1. Validation terrain de parcelle
- Le vérificateur prend 3+ photos GPS sur le terrain
- Le système extrait automatiquement GPS EXIF
- Validation automatique: GPS dans polygone + date récente
- Si validation échoue, `gps_valid = false` avec raison explicite

### 2. Upload de photos de lot
- Farmer upload photo de balance avec GPS
- EXIF extrait: GPS + date de prise
- Stockage pour traçabilité complète
- Alerte si GPS lot hors parcelle déclarée

### 3. Détection de fraude
- Photo avec GPS EXIF hors parcelle → invalidation
- Photo avec date ancienne (>7 jours) → invalidation
- Photo avec date future → invalidation
- Photo sans EXIF → flag de suspicion

## Sécurité

- **Validation stricte**: Ray-casting pour précision
- **Tolérance 0**: Pas d'approximation GPS
- **Date récente**: Max 7 jours pour éviter réutilisation
- **Détection manipulation**: Rejet date future
- **Traçabilité complète**: EXIF complet stocké en JSON

## Performance

- **Bibliothèque**: `exifr` (optimisée, lazy loading)
- **Options**: GPS, TIFF, EXIF uniquement (pas IPTC, ICC, JFIF)
- **Parsing**: Asynchrone, non-bloquant
- **Erreurs**: Gestion gracieuse, retourne `null` si échec

## Dépendances

```json
{
  "exifr": "^7.1.3"
}
```

## Installation

```bash
cd backend
npm install exifr
```

## Limitation connues

1. **Photos sans EXIF**: Les photos de galerie ou éditées peuvent avoir perdu leurs métadonnées
2. **GPS imprécis**: Certains appareils ont précision GPS variable
3. **Clock manipulation**: Un utilisateur peut modifier l'horloge du téléphone (détecté par date future)
4. **Format image**: Seuls JPEG, TIFF, HEIC supportent EXIF complet

## Roadmap

- [ ] Support extraction EXIF depuis Cloudinary (API metadata)
- [ ] Validation croisée GPS EXIF vs GPS manuel
- [ ] Alerte ministère si trop de photos sans EXIF
- [ ] Score qualité photo basé sur EXIF (ISO, netteté)
- [ ] Détection photo dupliquée (checksum + EXIF)
