const exifr = require('exifr');

/**
 * Extrait les métadonnées EXIF d'une image
 * @param {string|Buffer} input - Chemin fichier, URL ou Buffer
 * @returns {Promise<Object|null>} Métadonnées extraites
 */
async function extractExif(input) {
  try {
    const exif = await exifr.parse(input, {
      gps: true,
      tiff: true,
      exif: true,
      iptc: false,
      icc: false,
      jfif: false,
    });

    if (!exif) {
      return null;
    }

    // Normaliser les données
    const metadata = {
      // GPS
      gps: null,
      // Date/heure
      dateTaken: null,
      // Appareil
      make: exif.Make || null,
      model: exif.Model || null,
      // Paramètres
      iso: exif.ISO || null,
      exposureTime: exif.ExposureTime || null,
      fNumber: exif.FNumber || null,
      focalLength: exif.FocalLength || null,
      // Dimensions
      width: exif.ImageWidth || exif.ExifImageWidth || null,
      height: exif.ImageHeight || exif.ExifImageHeight || null,
      // Orientation
      orientation: exif.Orientation || null,
    };

    // GPS
    if (exif.latitude && exif.longitude) {
      metadata.gps = {
        lat: exif.latitude,
        lng: exif.longitude,
        altitude: exif.GPSAltitude || null,
      };
    }

    // Date de prise
    if (exif.DateTimeOriginal) {
      metadata.dateTaken = exif.DateTimeOriginal;
    } else if (exif.DateTime) {
      metadata.dateTaken = exif.DateTime;
    } else if (exif.CreateDate) {
      metadata.dateTaken = exif.CreateDate;
    }

    return metadata;
  } catch (error) {
    console.error('Error extracting EXIF:', error);
    return null;
  }
}

/**
 * Valide que les coordonnées GPS de la photo sont dans le polygone de la parcelle
 * @param {Object} photoGps - Coordonnées GPS de la photo {lat, lng}
 * @param {Object} parcelGeometry - GeoJSON de la parcelle
 * @returns {Object} {valid: boolean, reason?: string}
 */
function validateGpsInPolygon(photoGps, parcelGeometry) {
  if (!photoGps || !photoGps.lat || !photoGps.lng) {
    return { valid: false, reason: 'No GPS data in photo' };
  }

  if (parcelGeometry.type !== 'Polygon' && parcelGeometry.type !== 'polygon') {
    return { valid: true, reason: 'Parcel is not a polygon' };
  }

  const lotService = require('./lot-service');
  const isInside = isGpsInsideParcel(
    photoGps.lat,
    photoGps.lng,
    parcelGeometry
  );

  if (!isInside) {
    return { valid: false, reason: 'Photo GPS outside parcel boundary' };
  }

  return { valid: true };
}

/**
 * Fonction d'aide pour vérifier si un point est dans un polygone (ray-casting)
 * @param {number} lat - Latitude du point
 * @param {number} lng - Longitude du point
 * @param {Object} geometry - GeoJSON Polygon
 * @returns {boolean}
 */
function isGpsInsideParcel(lat, lng, geometry) {
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'polygon')) {
    return false;
  }

  const coords = geometry.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }

  // Normaliser le premier anneau du polygone
  const ring = Array.isArray(coords[0]) && typeof coords[0][0] === 'number'
    ? coords
    : coords[0];

  if (!Array.isArray(ring) || ring.length < 3) {
    return false;
  }

  // Ray-casting algorithm
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (!Array.isArray(ring[i]) || ring[i].length < 2 ||
        !Array.isArray(ring[j]) || ring[j].length < 2) {
      return false;
    }

    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    if (typeof xi !== 'number' || typeof yi !== 'number' ||
        typeof xj !== 'number' || typeof yj !== 'number') {
      return false;
    }

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Valide que la photo a été prise récemment (dans les X jours)
 * @param {Date|string} exifDate - Date EXIF de la photo
 * @param {number} maxDaysOld - Nombre maximal de jours
 * @returns {Object} {valid: boolean, reason?: string, daysOld?: number}
 */
function validatePhotoRecency(exifDate, maxDaysOld = 7) {
  if (!exifDate) {
    return { valid: false, reason: 'No date in photo metadata' };
  }

  const photoDate = new Date(exifDate);
  const now = new Date();
  const diffMs = now - photoDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > maxDaysOld) {
    return {
      valid: false,
      reason: `Photo is ${Math.floor(diffDays)} days old (max: ${maxDaysOld})`
    };
  }

  if (diffDays < 0) {
    return { valid: false, reason: 'Photo date is in the future' };
  }

  return { valid: true, daysOld: Math.floor(diffDays) };
}

module.exports = {
  extractExif,
  validateGpsInPolygon,
  validatePhotoRecency,
  isGpsInsideParcel
};
