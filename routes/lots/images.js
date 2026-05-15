const { successEnvelope } = require('../../utils/response');
const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
const lotService = require('../../services/lot-service');
const exifService = require('../../services/exif-service');

module.exports = async function lotImageRoutes(app) {
  app.post('/:id/images', {
    preHandler: [authenticate, requireRole([USER_ROLES.FARMER, USER_ROLES.COOPERATIVE])]
  }, async (request) => {
    const file = await request.file();
    if (!file) {
      return successEnvelope({ uploaded: false });
    }

    const buffer = await file.toBuffer();
    const image = await lotService.addImage(app.prisma, app.storage, request.params.id, buffer, request.user.sub);
    return successEnvelope(image);
  });
};
