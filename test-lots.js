const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.lot.findMany({
  select: { id: true, lotCode: true, status: true, verificationStatus: true, autoValidated: true },
  orderBy: { createdAt: 'desc' },
  take: 5
}).then(lots => {
  console.log(JSON.stringify(lots, null, 2));
  prisma.$disconnect();
});
