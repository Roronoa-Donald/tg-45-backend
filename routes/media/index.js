const { authenticate } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');
const mediaService = require('../../services/media-service');

module.exports = async function mediaRoutes(app) {
  // Direct media upload route, independent of a specific entity (like lot)
  app.post('/upload', {
    preHandler: [authenticate]
  }, async (request) => {
    const file = await request.file();
    if (!file) {
      return successEnvelope({ uploaded: false });
    }

    const buffer = await file.toBuffer();
    // Using uploadLotImage logic for general upload
    const image = await mediaService.uploadLotImage(app.storage, buffer);
    return successEnvelope(image);
  });
};
