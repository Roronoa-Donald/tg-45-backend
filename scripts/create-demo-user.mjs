import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const role = process.env.DEMO_ROLE
  const name = process.env.DEMO_NAME || 'Demo User'
  const email = process.env.DEMO_EMAIL
  const phone = process.env.DEMO_PHONE || null
  const pin = process.env.DEMO_PIN || '1234'
  const bcryptRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10)

  if (!role || !email) {
    throw new Error('Set DEMO_ROLE and DEMO_EMAIL')
  }

  const pinHash = await bcrypt.hash(pin, bcryptRounds)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  })

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          role,
          name,
          email,
          phone,
          pinHash,
          status: 'active',
        },
      })
    : await prisma.user.create({
        data: {
          role,
          name,
          email,
          phone,
          pinHash,
          status: 'active',
        },
      })

  if (role === 'farmer') {
    await prisma.farmerProfile.upsert({
      where: { userId: user.id },
      update: {
        farmName: process.env.DEMO_FARM_NAME || `${name} Farm`,
        location: process.env.DEMO_LOCATION || 'Togo',
        language: process.env.DEMO_LANGUAGE || 'fr',
      },
      create: {
        userId: user.id,
        farmName: process.env.DEMO_FARM_NAME || `${name} Farm`,
        location: process.env.DEMO_LOCATION || 'Togo',
        language: process.env.DEMO_LANGUAGE || 'fr',
      },
    })
  }

  console.log(JSON.stringify({ id: user.id, role: user.role, email: user.email, phone: user.phone, pin }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })