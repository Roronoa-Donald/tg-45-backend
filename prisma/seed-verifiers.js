const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function seedVerifiers() {
  console.log('🌱 Création des 5 vérificateurs...');

  const verifiers = [
    { email: 'verifier1.com', name: 'Vérificateur 1' },
    { email: 'verifier2.com', name: 'Vérificateur 2' },
    { email: 'verifier3.com', name: 'Vérificateur 3' },
    { email: 'verifier4.com', name: 'Vérificateur 4' },
    { email: 'verifier5.com', name: 'Vérificateur 5' }
  ];

  const pinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);

  for (const verifier of verifiers) {
    const existingUser = await prisma.user.findFirst({
      where: { email: verifier.email }
    });

    if (existingUser) {
      console.log(`⏭️  ${verifier.email} existe déjà, passage...`);
      continue;
    }

    const created = await prisma.user.create({
      data: {
        role: 'verifier',
        name: verifier.name,
        email: verifier.email,
        pinHash,
        status: 'active',
        loginAttempts: 0
      }
    });

    console.log(`✅ ${verifier.email} créé avec succès (ID: ${created.id})`);
  }

  console.log('✨ Seed des vérificateurs terminé!');
  await prisma.$disconnect();
}

seedVerifiers()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  });
