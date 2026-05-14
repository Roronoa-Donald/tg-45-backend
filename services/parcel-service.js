const { AppError } = require('../utils/errors');

async function createParcel(prisma, payload, actorId) {
  if (payload.areaHa && payload.areaHa > 4 && payload.geometryType !== 'polygon') {
    throw new AppError('invalid_geometry', 'Polygon required for parcels above 4ha', 400);
  }

  const ownerId = payload.ownerId || actorId;

  return prisma.parcel.create({
    data: {
      ownerId,
      cooperativeId: payload.cooperativeId || null,
      name: payload.name || null,
      countryCode: payload.countryCode || null,
      region: payload.region || null,
      district: payload.district || null,
      locality: payload.locality || null,
      geometryType: payload.geometryType,
      geometry: payload.geometry,
      areaHa: payload.areaHa || null
    }
  });
}

async function getParcel(prisma, id) {
  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) {
    throw new AppError('not_found', 'Parcel not found', 404);
  }
  return parcel;
}

async function updateParcel(prisma, id, payload) {
  const existing = await getParcel(prisma, id);
  const nextGeometryType = payload.geometryType || existing.geometryType;

  if (payload.areaHa && payload.areaHa > 4 && nextGeometryType !== 'polygon') {
    throw new AppError('invalid_geometry', 'Polygon required for parcels above 4ha', 400);
  }

  return prisma.parcel.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      cooperativeId: payload.cooperativeId ?? undefined,
      countryCode: payload.countryCode ?? undefined,
      region: payload.region ?? undefined,
      district: payload.district ?? undefined,
      locality: payload.locality ?? undefined,
      geometryType: payload.geometryType ?? undefined,
      geometry: payload.geometry ?? undefined,
      areaHa: payload.areaHa ?? undefined
    }
  });
}

async function listParcels(prisma, where, pagination) {
  const [total, items] = await Promise.all([
    prisma.parcel.count({ where }),
    prisma.parcel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.pageSize,
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true } }
      }
    })
  ]);
  return { total, items };
}

async function linkLotParcel(prisma, lotId, parcelId, sharePct) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) {
    throw new AppError('not_found', 'Lot not found', 404);
  }
  const parcel = await prisma.parcel.findUnique({ where: { id: parcelId } });
  if (!parcel) {
    throw new AppError('not_found', 'Parcel not found', 404);
  }

  try {
    return await prisma.lotParcel.create({
      data: {
        lotId,
        parcelId,
        sharePct: sharePct || null
      }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw new AppError('conflict', 'Parcel already linked to lot', 409);
    }
    throw err;
  }
}

async function listLotParcels(prisma, lotId) {
  return prisma.lotParcel.findMany({
    where: { lotId },
    include: { parcel: true }
  });
}

async function unlinkLotParcel(prisma, lotId, parcelId) {
  const existing = await prisma.lotParcel.findFirst({ where: { lotId, parcelId } });
  if (!existing) {
    throw new AppError('not_found', 'Parcel link not found', 404);
  }
  await prisma.lotParcel.delete({ where: { id: existing.id } });
  return { lotId, parcelId };
}

module.exports = {
  createParcel,
  getParcel,
  updateParcel,
  listParcels,
  linkLotParcel,
  listLotParcels,
  unlinkLotParcel
};
