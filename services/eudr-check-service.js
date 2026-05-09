const { AppError } = require('../utils/errors');

async function createDeforestationCheck(prisma, payload) {
  const parcel = await prisma.parcel.findUnique({ where: { id: payload.parcelId } });
  if (!parcel) {
    throw new AppError('not_found', 'Parcel not found', 404);
  }

  return prisma.eudrDeforestationCheck.create({
    data: {
      parcelId: payload.parcelId,
      source: payload.source,
      checkDate: new Date(payload.checkDate),
      result: payload.result,
      confidence: payload.confidence || null,
      evidenceUrl: payload.evidenceUrl || null,
      metadata: payload.metadata || null
    }
  });
}

async function createLegalityCheck(prisma, payload) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: payload.ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }

  return prisma.eudrLegalityCheck.create({
    data: {
      ddId: payload.ddId,
      checkType: payload.checkType,
      status: payload.status,
      evidenceUrl: payload.evidenceUrl || null,
      metadata: payload.metadata || null
    }
  });
}

module.exports = {
  createDeforestationCheck,
  createLegalityCheck
};
