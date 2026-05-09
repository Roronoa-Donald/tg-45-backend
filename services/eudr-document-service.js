const { AppError } = require('../utils/errors');

async function addDocument(prisma, ddId, payload) {
  const dd = await prisma.eudrDueDiligence.findUnique({ where: { id: ddId } });
  if (!dd) {
    throw new AppError('not_found', 'Due diligence not found', 404);
  }

  return prisma.eudrDocument.create({
    data: {
      ddId,
      docType: payload.docType,
      url: payload.url,
      checksum: payload.checksum || null,
      issuedAt: payload.issuedAt ? new Date(payload.issuedAt) : null,
      metadata: payload.metadata || null
    }
  });
}

module.exports = { addDocument };
