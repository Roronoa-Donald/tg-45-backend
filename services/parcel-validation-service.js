const { AppError } = require('../utils/errors');
const exifService = require('./exif-service');

const VALIDATION_DURATION_DAYS = 30;

function isPointInsidePolygon(point, polygon) {
  const { lat, lng } = point;
  const coords = polygon.coordinates[0];
  let inside = false;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];

    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

async function getRandomVerifier(prisma, excludeIds = []) {
  const verifiers = await prisma.user.findMany({
    where: {
      role: 'verifier',
      status: { in: ['approved', 'active'] }, // Accept both approved and active verifiers
      id: { notIn: excludeIds }
    },
    select: { id: true }
  });

  if (verifiers.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * verifiers.length);
  return verifiers[randomIndex].id;
}

async function assignVerifierToParcel(prisma, parcelId) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    include: { validations: { where: { status: 'pending' } } }
  });

  if (!parcel) {
    throw new AppError('not_found', 'Parcel not found', 404);
  }

  if (parcel.validations.length > 0) {
    return parcel.validations[0];
  }

  const verifierId = await getRandomVerifier(prisma);
  if (!verifierId) {
    throw new AppError('no_verifier', 'No verifier available', 500);
  }

  const validation = await prisma.parcelValidation.create({
    data: {
      parcelId,
      verifierId,
      status: 'pending'
    },
    include: {
      verifier: { select: { id: true, name: true, email: true } }
    }
  });

  return validation;
}

async function getPendingParcels(prisma, verifierId, pagination = { skip: 0, pageSize: 20 }) {
  const where = {
    verifierId,
    status: 'pending'
  };

  const [total, items] = await Promise.all([
    prisma.parcelValidation.count({ where }),
    prisma.parcelValidation.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy: { createdAt: 'asc' },
      include: {
        parcel: {
          include: {
            owner: { select: { id: true, name: true, phone: true } },
            cooperative: { select: { id: true, name: true } }
          }
        },
        photos: true
      }
    })
  ]);

  return { total, items };
}

async function addValidationPhoto(prisma, validationId, verifierId, photoData) {
  const validation = await prisma.parcelValidation.findUnique({
    where: { id: validationId },
    include: { parcel: true }
  });

  if (!validation) {
    throw new AppError('not_found', 'Validation not found', 404);
  }

  if (validation.verifierId !== verifierId) {
    throw new AppError('forbidden', 'You are not assigned to this validation', 403);
  }

  if (validation.status !== 'pending') {
    throw new AppError('invalid_status', 'Validation is not pending', 400);
  }

  // Extraire les métadonnées EXIF si URL fournie
  let exifData = null;
  if (photoData.url) {
    exifData = await exifService.extractExif(photoData.url);
  }

  // Utiliser GPS EXIF si disponible, sinon utiliser les coordonnées fournies
  const gpsLat = exifData?.gps?.lat || photoData.gpsLat;
  const gpsLng = exifData?.gps?.lng || photoData.gpsLng;
  const takenAt = exifData?.dateTaken || photoData.takenAt;

  // Valider GPS dans polygone
  let isInsideParcel = false;
  let gpsValid = true;
  let gpsValidationReason = null;

  if (validation.parcel.geometryType?.toLowerCase() === 'polygon' && gpsLat && gpsLng) {
    isInsideParcel = isPointInsidePolygon(
      { lat: gpsLat, lng: gpsLng },
      validation.parcel.geometry
    );

    // Valider GPS avec EXIF si données disponibles
    if (exifData?.gps) {
      const gpsValidation = exifService.validateGpsInPolygon(
        exifData.gps,
        validation.parcel.geometry
      );
      gpsValid = gpsValidation.valid;
      gpsValidationReason = gpsValidation.reason || null;
    }
  }

  // Valider date de prise (max 7 jours)
  if (takenAt) {
    const dateValidation = exifService.validatePhotoRecency(takenAt, 7);
    if (!dateValidation.valid) {
      gpsValid = false;
      gpsValidationReason = gpsValidationReason
        ? `${gpsValidationReason}; ${dateValidation.reason}`
        : dateValidation.reason;
    }
  }

  const photo = await prisma.parcelValidationPhoto.create({
    data: {
      validationId,
      url: photoData.url,
      gpsLat,
      gpsLng,
      takenAt: takenAt ? new Date(takenAt) : null,
      isInsideParcel,
      exifData: exifData ? JSON.stringify(exifData) : null,
      gpsValid,
      gpsValidationReason
    }
  });

  return photo;
}

async function validateParcel(prisma, validationId, verifierId, approve, reason) {
  const validation = await prisma.parcelValidation.findUnique({
    where: { id: validationId },
    include: { photos: true, parcel: true }
  });

  if (!validation) {
    throw new AppError('not_found', 'Validation not found', 404);
  }

  if (validation.verifierId !== verifierId) {
    throw new AppError('forbidden', 'You are not assigned to this validation', 403);
  }

  if (validation.status !== 'pending') {
    throw new AppError('invalid_status', 'Validation already completed', 400);
  }

  if (approve) {
    if (validation.photos.length < 3) {
      throw new AppError('insufficient_photos', 'At least 3 photos required for validation', 400);
    }

    const photosInside = validation.photos.filter(p => p.isInsideParcel);
    if (photosInside.length < 3 && validation.parcel.geometryType?.toLowerCase() === 'polygon') {
      throw new AppError('photos_outside', 'At least 3 photos must be taken inside the parcel', 400);
    }
  }

  const validUntil = approve ? new Date(Date.now() + VALIDATION_DURATION_DAYS * 24 * 60 * 60 * 1000) : null;
  const status = approve ? 'validated' : 'rejected';

  const result = await prisma.$transaction(async (tx) => {
    const updatedValidation = await tx.parcelValidation.update({
      where: { id: validationId },
      data: { status, validUntil, reason }
    });

    await tx.parcel.update({
      where: { id: validation.parcelId },
      data: {
        validationStatus: status,
        validUntil
      }
    });

    return updatedValidation;
  });

  return result;
}

async function isParcelValid(prisma, parcelId) {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { validationStatus: true, validUntil: true }
  });

  if (!parcel) return false;
  if (parcel.validationStatus !== 'validated') return false;
  if (!parcel.validUntil) return false;

  return new Date(parcel.validUntil) > new Date();
}

async function getValidationHistory(prisma, parcelId) {
  return prisma.parcelValidation.findMany({
    where: { parcelId },
    orderBy: { createdAt: 'desc' },
    include: {
      verifier: { select: { id: true, name: true } },
      photos: true
    }
  });
}

module.exports = {
  assignVerifierToParcel,
  getPendingParcels,
  addValidationPhoto,
  validateParcel,
  isParcelValid,
  getValidationHistory,
  getRandomVerifier
};
