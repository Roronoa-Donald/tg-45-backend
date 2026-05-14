const { authenticate, requireRole } = require('../../utils/auth-hooks');
const { USER_ROLES } = require('../../config/constants');
const { successEnvelope } = require('../../utils/response');
const { z } = require('zod');
const { parseOrThrow } = require('../../utils/schema');
const { AppError } = require('../../utils/errors');
const bcrypt = require('bcrypt');

// AD-001: Limiter les roles creables par l'admin
// Les farmers s'inscrivent via l'app mobile, les admins sont crees manuellement
const ALLOWED_ROLES_FOR_CREATION = ['ministry', 'cooperative', 'verifier', 'exporter', 'compliance'];

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ALLOWED_ROLES_FOR_CREATION, {
    errorMap: () => ({ message: `Role invalide. Roles autorises: ${ALLOWED_ROLES_FOR_CREATION.join(', ')}` })
  }),
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

    // AD-008: Les utilisateurs crees par l'admin sont actifs immediatement
    // C'est intentionnel pour permettre a l'admin de bypasser le workflow d'approbation
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

  // AD-002: Endpoint pour desactiver un utilisateur
  app.put('/users/:id/deactivate', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])]
  }, async (request) => {
    const { id } = request.params;

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('not_found', 'Utilisateur non trouve', 404);
    }

    // Empecher la desactivation d'un admin par un autre admin
    if (user.role === USER_ROLES.ADMIN) {
      throw new AppError('forbidden', 'Impossible de desactiver un compte admin', 403);
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    return successEnvelope(updated);
  });

  // AD-002: Endpoint pour reactiver un utilisateur
  app.put('/users/:id/activate', {
    preHandler: [authenticate, requireRole([USER_ROLES.ADMIN])]
  }, async (request) => {
    const { id } = request.params;

    const user = await app.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('not_found', 'Utilisateur non trouve', 404);
    }

    const updated = await app.prisma.user.update({
      where: { id },
      data: { status: 'active' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    return successEnvelope(updated);
  });
};
