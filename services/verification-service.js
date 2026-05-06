const { AppError } = require('../utils/errors');
const { LOT_EVENT_TYPES, LOT_STATUS } = require('../config/constants');
const lotRepository = require('../repositories/lot-repository');

const STATUS_TRANSITIONS = {
  [LOT_STATUS.REGISTERED]: [LOT_STATUS.VALIDATED, LOT_STATUS.REJECTED],
  [LOT_STATUS.VALIDATED]: [LOT_STATUS.CERTIFIED, LOT_STATUS.REJECTED],
  [LOT_STATUS.CERTIFIED]: [LOT_STATUS.SHIPPED],
  [LOT_STATUS.SHIPPED]: [],
  [LOT_STATUS.REJECTED]: []
};

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function assignStatus(prisma, lotId, status, actorId, reason, gps) {
  const lot = await lotRepository.findLotById(prisma, lotId);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  // Check distance if validating
  if (status === LOT_STATUS.VALIDATED && gps && gps.lat && gps.lng && lot.gpsOriginLat && lot.gpsOriginLng) {
    const distance = getDistanceKm(lot.gpsOriginLat, lot.gpsOriginLng, gps.lat, gps.lng);
    if (distance > 50) {
      throw new AppError('gps_too_far', `La coopérative est trop éloignée du lieu de récolte (${Math.round(distance)}km > 50km)`, 403);
    }
  }

  // Parse double-badge format: 'certified;shipped' → base status 'certified'
  const baseStatus = lot.status.split(';')[0];
  
  const allowed = STATUS_TRANSITIONS[baseStatus] || [];
  if (!allowed.includes(status)) {
    if (baseStatus === status) {
      return lot;
    }
    throw new AppError('invalid_transition', 'Invalid status transition', 400, {
      current: lot.status,
      allowed
    });
  }

  const updated = await lotRepository.updateLotStatus(prisma, lotId, status);
  await lotRepository.addLotEvent(prisma, {
    lotId,
    actorId,
    eventType: LOT_EVENT_TYPES.VERIFY,
    metadata: { status, reason, gps }
  });
  return updated;
}

async function submitProof(prisma, lotId, actorId, payload) {
  const lot = await lotRepository.findLotById(prisma, lotId);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  await lotRepository.addLotEvent(prisma, {
    lotId,
    actorId,
    eventType: 'verify_proof',
    metadata: payload
  });

  return { lotId };
}

async function certify(prisma, lotId, actorId, signature, gps) {
  const lot = await lotRepository.findLotById(prisma, lotId);
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }

  const existing = await prisma.lotCertification.findUnique({ where: { lotId } });
  if (existing) {
    throw new AppError('already_certified', 'Lot already certified', 409);
  }

  const certification = await prisma.$transaction(async (tx) => {
    const record = await tx.lotCertification.create({
      data: {
        lotId,
        verifierId: actorId,
        signature
      }
    });

    await tx.lot.update({
      where: { id: lotId },
      data: { status: LOT_STATUS.CERTIFIED }
    });

    await tx.lotEvent.create({
      data: {
        lotId,
        actorId,
        eventType: LOT_EVENT_TYPES.CERTIFY,
        metadata: { status: LOT_STATUS.CERTIFIED, gps }
      }
    });

    return record;
  });

  return certification;
}

async function batchVerify(prisma, lotIds, status, actorId) {
  const results = [];
  for (const lotId of lotIds) {
    try {
      const lot = await assignStatus(prisma, lotId, status, actorId);
      results.push({ lotId, success: true, status: lot.status });
    } catch (err) {
      results.push({ lotId, success: false, error: err.message });
    }
  }
  return results;
}

async function queryLots(prisma, query, pagination) {
  const where = {};
  if (query.status) {
    where.status = query.status;
  }

  const [total, items] = await Promise.all([
    prisma.lot.count({ where }),
    prisma.lot.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return { total, items };
}

module.exports = {
  assignStatus,
  submitProof,
  certify,
  batchVerify,
  queryLots
};
