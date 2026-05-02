require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const lots = await prisma.lot.findMany({
      orderBy: { createdAt: 'desc' },
      include: { events: true, images: true, certification: true }
    });
    console.log(JSON.stringify(lots, null, 2));
  } catch (err) {
    console.error('Error querying lots:', err.message || err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
