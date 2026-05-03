async function createLot(prisma, data) {
  return prisma.lot.create({ data });
}

async function findLotById(prisma, id) {
  return prisma.lot.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { name: true } } }
      },
      images: true,
      certification: true
    }
  });
}

async function findLotByCode(prisma, lotCode) {
  return prisma.lot.findFirst({
    where: { lotCode },
    include: {
      events: {
        orderBy: { occurredAt: 'asc' },
        include: { actor: { select: { name: true } } }
      },
      images: true,
      certification: true
    }
  });
}

async function listLots(prisma, where, skip, take) {
  return prisma.lot.findMany({
    where,
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { name: true } },
      cooperative: { select: { name: true } }
    }
  });
}

async function countLots(prisma, where) {
  return prisma.lot.count({ where });
}

async function addLotEvent(prisma, data) {
  return prisma.lotEvent.create({ data });
}

async function addLotImage(prisma, data) {
  return prisma.lotImage.create({ data });
}

async function updateLotStatus(prisma, id, status) {
  return prisma.lot.update({
    where: { id },
    data: { status }
  });
}

async function updateLotOwner(prisma, id, ownerId) {
  return prisma.lot.update({
    where: { id },
    data: { ownerId }
  });
}

async function updateLotProof(prisma, id, proof) {
  return prisma.lot.update({
    where: { id },
    data: {
      blockchainTxHash: proof.txHash,
      blockchainProofHash: proof.proofHash
    }
  });
}

module.exports = {
  createLot,
  findLotById,
  findLotByCode,
  listLots,
  countLots,
  addLotEvent,
  addLotImage,
  updateLotStatus,
  updateLotOwner,
  updateLotProof
};
