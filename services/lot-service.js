const { AppError } = require('../utils/errors');
const { newLotCode } = require('../utils/ids');
const { LOT_EVENT_TYPES, LOT_STATUS } = require('../config/constants');
const lotRepository = require('../repositories/lot-repository');
const blockchainService = require('./blockchain-service');
const mediaService = require('./media-service');

async function registerLot(prisma, payload, actorId, blockchain, requestId) {
  if (payload.gpsPrecisionM > 50) {
    throw new AppError('gps_precision', 'GPS precision above 50m', 400);
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
          cooperativeId: payload.cooperativeId || null,
          product: payload.product,
          variety: payload.variety,
          weightKg: payload.weightKg,
          harvestDate: payload.harvestDate ? new Date(payload.harvestDate) : null,
          gpsOriginLat: payload.gpsOriginLat,
          gpsOriginLng: payload.gpsOriginLng,
          gpsPrecisionM: payload.gpsPrecisionM,
          gpsAreaRadiusM: 100,
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
