const { successEnvelope } = require('../../utils/response');
const lotService = require('../../services/lot-service');

function buildPublicLot(lot) {
  return {
    lotCode: lot.lotCode,
    status: lot.status,
    gps: {
      lat: lot.gpsOriginLat,
      lng: lot.gpsOriginLng,
      precisionM: lot.gpsPrecisionM
    },
    proof: {
      txHash: lot.blockchainTxHash,
      proofHash: lot.blockchainProofHash
    },
    events: lot.events.map((event) => ({
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      actorName: event.actor?.name || 'Inconnu'
    })),
    images: lot.images.map((image) => ({
      url: image.url,
      isPrimary: image.isPrimary
    }))
  };
}

module.exports = async function publicRoutes(app) {
  app.get('/verify/:lotCode', async (request) => {
    const lot = await lotService.getLotByCode(app.prisma, request.params.lotCode);
    return successEnvelope(buildPublicLot(lot));
  });
};
