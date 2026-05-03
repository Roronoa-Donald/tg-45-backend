const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
const { successEnvelope } = require('../../utils/response');
const { z } = require('zod');
const { parseOrThrow } = require('../../utils/schema');
const { AppError } = require('../../utils/errors');
const bcrypt = require('bcrypt');

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string(),
  name: z.string().optional()
});

module.exports = async function adminRoutes(app) {
  app.get('/users', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])]
  }, async (request) => {
    const users = await app.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return successEnvelope(users);
  });

  app.post('/users', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])]
  }, async (request) => {
    const payload = parseOrThrow(createUserSchema, request.body);

    const existing = await app.prisma.user.findUnique({
      where: { email: payload.email }
    });

    if (existing) {
      throw new AppError('user_exists', 'Un utilisateur avec cet email existe déjà', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(payload.password, salt);

    const user = await app.prisma.user.create({
      data: {
        email: payload.email,
        passwordHash,
        role: payload.role,
        name: payload.name || payload.email.split('@')[0],
        status: 'active'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    return successEnvelope(user);
  });
};
