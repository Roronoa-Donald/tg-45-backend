const { authenticate } = require('../../utils/auth-hooks');
const { successEnvelope } = require('../../utils/response');

module.exports = async function profileRoute(app) {
  app.get('/profile', {
    preHandler: [authenticate]
  }, async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        cooperativeId: true,
        createdAt: true,
        updatedAt: true,
        cooperative: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      return successEnvelope(null);
    }

    return successEnvelope(user);
  });
};
