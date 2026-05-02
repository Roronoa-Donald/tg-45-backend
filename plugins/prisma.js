const { PrismaClient } = require('@prisma/client');
const fp = require('fastify-plugin');
const env = require('../config/env');

async function prismaPlugin(app) {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: env.databaseUrl }
    }
  });

  app.decorate('prisma', prisma);

  app.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
}

module.exports = fp(prismaPlugin);
