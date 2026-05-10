const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const COOP_ID = '11111111-1111-1111-1111-111111111111';

const DEFAULT_USERS = [
  {
    role: 'admin',
    name: 'Administrateur',
    email: 'admin.com',
    phone: null,
    secret: 'admin',
    status: 'active'
  },
  {
    role: 'farmer',
    name: 'Kossi Amegboh',
    email: 'farmer.com',
    phone: '+22890000000',
    secret: '1234',
    status: 'active',
    cooperativeId: COOP_ID,
    farmName: 'Ferme Kloto',
    location: 'Kpalime'
  },
  {
    role: 'cooperative',
    name: 'Cooperative Kloto',
    email: 'coop.com',
    phone: '+22890000001',
    secret: '1234',
    status: 'active',
    cooperativeId: COOP_ID
  },
  {
    role: 'exporter',
    name: 'TogoExport SARL',
    email: 'exporter.com',
    phone: '+22890000002',
    secret: '1234',
    status: 'active'
  },
  {
    role: 'verifier',
    name: 'Paul Koffi',
    email: 'verifier.com',
    phone: '+22890000003',
    secret: '1234',
    status: 'active'
  },
  {
    role: 'compliance',
    name: 'Equipe Conformite',
    email: 'compliance.com',
    phone: '+22890000004',
    secret: '1234',
    status: 'active'
  },
  {
    role: 'ministry',
    name: 'Ministere CACAO',
    email: 'ministry.com',
    phone: '+22890000005',
    secret: '1234',
    status: 'active'
  },
  {
    role: 'support',
    name: 'Support ChainCacao',
    email: 'support.com',
    phone: '+22890000006',
    secret: '1234',
    status: 'active'
  }
];

async function upsertCooperative() {
  const existing = await prisma.cooperative.findUnique({ where: { id: COOP_ID } });
  if (existing) {
    return existing;
  }

  return prisma.cooperative.create({
    data: {
      id: COOP_ID,
      name: 'Cooperative Agricole de Kloto',
      region: 'Kpalime',
      status: 'active'
    }
  });
}

async function upsertUser(user) {
  const passwordHash = await bcrypt.hash(user.secret, 10);
  const data = {
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    passwordHash,
    status: user.status,
    cooperativeId: user.cooperativeId || null
  };

  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) {
    return prisma.user.update({ where: { email: user.email }, data });
  }

  return prisma.user.create({ data });
}

async function main() {
  const coop = await upsertCooperative();

  for (const user of DEFAULT_USERS) {
    const created = await upsertUser(user);

    if (user.role === 'farmer') {
      await prisma.farmerProfile.upsert({
        where: { userId: created.id },
        update: {
          farmName: user.farmName || 'Ferme',
          location: user.location || null,
          language: 'fr'
        },
        create: {
          userId: created.id,
          farmName: user.farmName || 'Ferme',
          location: user.location || null,
          language: 'fr'
        }
      });

      if (coop) {
        await prisma.cooperativeMember.upsert({
          where: { cooperativeId_userId: { cooperativeId: coop.id, userId: created.id } },
          update: {},
          create: { cooperativeId: coop.id, userId: created.id, role: 'member' }
        });
      }
    }
  }
}

main()
  .then(() => {
    console.log('Default users seeded');
  })
  .catch((error) => {
    console.error('Failed to seed default users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
