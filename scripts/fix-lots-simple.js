// Script simple pour corriger les lots auto-validés
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixLots() {
  console.log('🔧 Correction des lots...\n');

  try {
    // Lots auto-validés mais registered
    const autoValidatedLots = await prisma.lot.findMany({
      where: {
        autoValidated: true,
        status: 'registered'
      }
    });

    console.log(`📊 ${autoValidatedLots.length} lot(s) auto-validés à certifier\n`);

    for (const lot of autoValidatedLots) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: 'certified' }
      });
      console.log(`✅ ${lot.lotCode} → certified`);
    }

    // Lots validated mais pas certified
    const validatedLots = await prisma.lot.findMany({
      where: { status: 'validated' }
    });

    console.log(`\n📊 ${validatedLots.length} lot(s) validated à certifier\n`);

    for (const lot of validatedLots) {
      await prisma.lot.update({
        where: { id: lot.id },
        data: { status: 'certified' }
      });
      console.log(`✅ ${lot.lotCode} → certified`);
    }

    console.log(`\n✅ Correction terminée !`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixLots();
