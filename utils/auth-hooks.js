const { AppError } = require('./errors');

async function authenticate(request) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new AppError('unauthorized', 'Unauthorized', 401);
  }
}

function requireRole(roles) {
  return async (request) => {
    const userRole = request.user && request.user.role;
    if (!userRole || !roles.includes(userRole)) {
      throw new AppError('forbidden', 'Forbidden', 403);
    }
  };
}

module.exports = { authenticate, requireRole };
