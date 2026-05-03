const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: 'admin.com' }
    });

    if (existing) {
      console.log('Admin user already exists:', existing.id);
      return;
    }

    const passwordHash = await bcrypt.hash('admin', 10);

    const admin = await prisma.user.create({
      data: {
        email: 'admin.com',
        passwordHash,
        role: 'admin',
        name: 'Administrateur',
        status: 'active'
      }
    });

    console.log('Admin user created successfully:', admin.id);
  } catch (error) {
    console.error('Failed to seed admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
