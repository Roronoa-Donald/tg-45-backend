const { AppError } = require('../utils/errors');
const { EUDR_STATUS } = require('../config/constants');
const ddrService = require('./eudr-ddr-service');

async function buildDeclarationPayload(prisma, dd) {
  if (dd.lotId) {
    const lot = await prisma.lot.findUnique({
      where: { id: dd.lotId },
      include: { parcels: { include: { parcel: true } } }
    });
    if (!lot) {
      throw new AppError('not_found', 'Lot not found', 404);
    }

    return {
      targetType: 'lot',
      lot: {
        id: lot.id,
        lotCode: lot.lotCode,
        product: lot.product,
        hsCode: lot.hsCode,
        originCountry: lot.originCountry,
        originRegion: lot.originRegion,
        weightKg: lot.weightKg,
        harvestDate: lot.harvestDate,
        productionStartDate: lot.productionStartDate,
        productionEndDate: lot.productionEndDate,
        eudrStatus: lot.eudrStatus
      },
      parcels: lot.parcels.map((link) => ({
        id: link.parcel.id,
        geometryType: link.parcel.geometryType,
        geometry: link.parcel.geometry,
        areaHa: link.parcel.areaHa,
        countryCode: link.parcel.countryCode,
        region: link.parcel.region,
        district: link.parcel.district,
        locality: link.parcel.locality,
        sharePct: link.sharePct
      }))
    };
  }

  if (dd.exportId) {
    const exportRecord = await prisma.export.findUnique({
      where: { id: dd.exportId },
      include: {
        lots: {
          include: {
            lot: { include: { parcels: { include: { parcel: true } } } }
          }
        }
      }
    });
    if (!exportRecord) {
      throw new AppError('not_found', 'Export not found', 404);
    }

    const lots = exportRecord.lots.map((item) => {
      const lot = item.lot;
      return {
        id: lot.id,
        lotCode: lot.lotCode,
        product: lot.product,
        hsCode: lot.hsCode,
        originCountry: lot.originCountry,
        originRegion: lot.originRegion,
        weightKg: lot.weightKg,
        harvestDate: lot.harvestDate,
        productionStartDate: lot.productionStartDate,
        productionEndDate: lot.productionEndDate,
        eudrStatus: lot.eudrStatus,
        parcels: lot.parcels.map((link) => ({
          id: link.parcel.id,
          geometryType: link.parcel.geometryType,
          geometry: link.parcel.geometry,
          areaHa: link.parcel.areaHa,
          countryCode: link.parcel.countryCode,
          region: link.parcel.region,
          district: link.parcel.district,
          locality: link.parcel.locality,
          sharePct: link.sharePct
        }))
      };
    });

    return {
      targetType: 'export',
      export: {
        id: exportRecord.id,
        status: exportRecord.status,
        eudrStatus: exportRecord.eudrStatus,
        lotIds: exportRecord.lots.map((item) => item.lotId)
      },
      lots
    };
  }

  throw new AppError('invalid_target', 'Due diligence target missing', 400);
}

async function generateDeclaration(prisma, ddId, actorId) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }

  const payload = await buildDeclarationPayload(prisma, dd);

  return prisma.eudrDeclaration.create({
    data: {
      ddId,
      payloadJson: payload,
      status: EUDR_STATUS.DRAFT,
      submittedBy: actorId || null
    }
  });
}

async function submitDeclaration(prisma, ddId, actorId, referenceNo) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }

  const latest = await prisma.eudrDeclaration.findFirst({
    where: { ddId },
    orderBy: { createdAt: 'desc' }
  });

  let declaration = null;
  if (latest) {
    declaration = await prisma.eudrDeclaration.update({
      where: { id: latest.id },
      data: {
        referenceNo,
        status: EUDR_STATUS.SUBMITTED,
        submittedBy: actorId,
        submittedAt: new Date()
      }
    });
  } else {
    declaration = await prisma.eudrDeclaration.create({
      data: {
        ddId,
        payloadJson: { generatedAt: new Date().toISOString(), notice: 'manual submission' },
        referenceNo,
        status: EUDR_STATUS.SUBMITTED,
        submittedBy: actorId,
        submittedAt: new Date()
      }
    });
  }

  await ddrService.markSubmitted(prisma, ddId, actorId, referenceNo);

  return declaration;
}

module.exports = {
  generateDeclaration,
  submitDeclaration
};
