const { AppError } = require('../utils/errors');
const { newLotCode } = require('../utils/ids');
const { LOT_EVENT_TYPES, LOT_STATUS } = require('../config/constants');
const lotRepository = require('../repositories/lot-repository');
const blockchainService = require('./blockchain-service');
const mediaService = require('./media-service');

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizePolygonRing(geometry) {
  if (!geometry || geometry.type !== 'Polygon') {
    return null;
  }
  const coords = geometry.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) {
    return null;
  }

  const first = coords[0];
  const ring = Array.isArray(first) && typeof first[0] === 'number' ? coords : first;
  if (!Array.isArray(ring) || ring.length < 3) {
    return null;
  }

  return ring;
}

function pointInPolygon(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function isGpsInsideParcel(parcel, lat, lng, precisionM) {
  let geometry = parcel.geometry;
  if (typeof geometry === 'string') {
    try {
      geometry = JSON.parse(geometry);
    } catch {
      return false;
    }
  }

  if (parcel.geometryType === 'polygon') {
    const ring = normalizePolygonRing(geometry);
    if (!ring) {
      return false;
    }
    return pointInPolygon(lng, lat, ring);
  }

  if (parcel.geometryType === 'point') {
    if (!geometry || geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
      return false;
    }
    const [pLng, pLat] = geometry.coordinates;
    if (typeof pLng !== 'number' || typeof pLat !== 'number') {
      return false;
    }
    const distanceM = getDistanceKm(lat, lng, pLat, pLng) * 1000;
    const toleranceM = Math.max(100, precisionM || 0);
    return distanceM <= toleranceM;
  }

  return false;
}

async function registerLot(prisma, payload, actorId, blockchain, requestId) {
  if (payload.gpsPrecisionM > 100) {
    throw new AppError('gps_precision', 'GPS precision above 100m', 400);
  }

  // Auto-assign cooperativeId from farmer's profile if not provided
  let cooperativeId = payload.cooperativeId || null;
  if (!cooperativeId) {
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { cooperativeId: true }
    });
    cooperativeId = actor?.cooperativeId || null;
  }

  const parcelIds = Array.isArray(payload.parcelIds)
    ? Array.from(new Set(payload.parcelIds))
    : [];

  if (parcelIds.length > 0) {
    const parcels = await prisma.parcel.findMany({
      where: { id: { in: parcelIds } }
    });

    if (parcels.length !== parcelIds.length) {
      throw new AppError('parcel_not_found', 'Parcel not found', 404);
    }

    const unauthorized = parcels.find((parcel) => parcel.ownerId !== actorId);
    if (unauthorized) {
      throw new AppError('forbidden', 'Parcel does not belong to farmer', 403);
    }

    const insideAny = parcels.some((parcel) =>
      isGpsInsideParcel(parcel, payload.gpsOriginLat, payload.gpsOriginLng, payload.gpsPrecisionM)
    );
    if (!insideAny) {
      throw new AppError('gps_outside_parcel', 'GPS must be inside selected parcel', 400);
    }
  }

  let lotCode = null;
  let lot = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    lotCode = attempt === 0 && payload.title ? payload.title : newLotCode();
    try {
      lot = await prisma.$transaction(async (tx) => {
        const created = await lotRepository.createLot(tx, {
          lotCode,
          ownerId: actorId,
          cooperativeId,
          product: payload.product,
          variety: payload.variety,
          hsCode: payload.hsCode || null,
          originCountry: payload.originCountry || null,
          originRegion: payload.originRegion || null,
          weightKg: payload.weightKg,
          harvestDate: payload.harvestDate ? new Date(payload.harvestDate) : null,
          productionStartDate: payload.productionStartDate ? new Date(payload.productionStartDate) : null,
          productionEndDate: payload.productionEndDate ? new Date(payload.productionEndDate) : null,
          gpsOriginLat: payload.gpsOriginLat,
          gpsOriginLng: payload.gpsOriginLng,
          gpsPrecisionM: payload.gpsPrecisionM,
          gpsAreaRadiusM: 100,
          scaleImageUrl: payload.scaleImageUrl || null,
          coopProofImageUrl: payload.coopProofImageUrl || null,
          status: LOT_STATUS.REGISTERED
        });

        await lotRepository.addLotEvent(tx, {
          lotId: created.id,
          actorId,
          eventType: LOT_EVENT_TYPES.REGISTER,
          metadata: {
            requestId
          }
        });

        if (parcelIds.length > 0) {
          await tx.lotParcel.createMany({
            data: parcelIds.map((parcelId) => ({
              lotId: created.id,
              parcelId
            })),
            skipDuplicates: true
          });
        }

        return created;
      });
      break;
    } catch (err) {
      if (err.code !== 'P2002') {
        throw err;
      }
    }
  }

  if (!lot) {
    throw new AppError('lot_code_conflict', 'Unable to generate lot code', 409);
  }

  const proof = await blockchainService.anchorProof(blockchain, {
    lotId: lot.id,
    lotCode: lot.lotCode,
    actorId,
    requestId
  });

  if (proof) {
    await lotRepository.updateLotProof(prisma, lot.id, proof);
  }

  return lotRepository.findLotById(prisma, lot.id);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getLot(prisma, id) {
  const lot = (isUuid(id) ? await lotRepository.findLotById(prisma, id) : null)
    || await lotRepository.findLotByCode(prisma, id);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }
  return lot;
}

async function getLotByCode(prisma, code) {
  const lot = await lotRepository.findLotByCode(prisma, code);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }
  return lot;
}

async function listLots(prisma, query, pagination) {
  const where = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.ownerId) {
    where.ownerId = query.ownerId;
  }

  // CO-001: Support filtering by cooperativeId
  // A lot belongs to a cooperative if:
  // 1. lot.cooperativeId matches directly, OR
  // 2. lot.owner.cooperativeId matches (farmer belongs to the cooperative)
  if (query.cooperativeId) {
    where.OR = [
      { cooperativeId: query.cooperativeId },
      { owner: { cooperativeId: query.cooperativeId } }
    ];
  }

  // VE-006: Support recherche par lotCode
  if (query.lotCode) {
    where.lotCode = {
      contains: query.lotCode,
      mode: 'insensitive'
    };
  }

  const [total, items] = await Promise.all([
    lotRepository.countLots(prisma, where),
    lotRepository.listLots(prisma, where, pagination.skip, pagination.pageSize)
  ]);

  return { total, items };
}

async function addImage(prisma, storage, lotId, buffer, actorId) {
  const lot = await lotRepository.findLotById(prisma, lotId);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  const uploaded = await mediaService.uploadLotImage(storage, buffer);

  const image = await lotRepository.addLotImage(prisma, {
    lotId,
    url: uploaded.url,
    publicId: uploaded.publicId,
    checksum: uploaded.checksum,
    isPrimary: lot.images.length === 0
  });

  await lotRepository.addLotEvent(prisma, {
    lotId,
    actorId,
    eventType: LOT_EVENT_TYPES.MEDIA_UPLOAD,
    metadata: { imageId: image.id }
  });

  return image;
}

async function updateStatus(prisma, lotId, status, actorId, eventType) {
  const lot = await lotRepository.updateLotStatus(prisma, lotId, status);
  await lotRepository.addLotEvent(prisma, {
    lotId,
    actorId,
    eventType,
    metadata: { status }
  });
  return lot;
}

async function transferLot(prisma, lotId, newOwnerId, actorId) {
  const lot = await lotRepository.updateLotOwner(prisma, lotId, newOwnerId);
  await lotRepository.addLotEvent(prisma, {
    lotId,
    actorId,
    eventType: LOT_EVENT_TYPES.TRANSFER,
    metadata: { newOwnerId }
  });
  return lot;
}

module.exports = {
  registerLot,
  getLot,
  getLotByCode,
  listLots,
  addImage,
  updateStatus,
  transferLot
};
