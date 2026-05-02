import 'dotenv/config'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const identifier = process.env.FARMER_IDENTIFIER || 'kossi'
  const pin = process.env.FARMER_PIN || '1234'
  const name = process.env.FARMER_NAME || 'Kossi Amegboh'
  const phone = process.env.FARMER_PHONE || `+229-000-${Math.floor(Math.random()*9000)+1000}`
  const email = process.env.FARMER_EMAIL || `kossi.${Date.now()}@example.test`
  const bcryptRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10)

  const pinHash = await bcrypt.hash(pin, bcryptRounds)

  // Try upsert by email if exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('User already exists:', existing.id)
    process.exit(0)
  }

  const user = await prisma.user.create({
    data: {
      role: 'farmer',
      name,
      phone,
      email,
      pinHash,
    }
  })

  await prisma.farmerProfile.create({
    data: {
      userId: user.id,
      farmName: process.env.FARM_NAME || 'Ferme Kossi',
      location: process.env.FARM_LOCATION || 'Togo',
      language: process.env.FARM_LANG || 'fr',
    }
  })

  console.log('CREATED_FARMER')
  console.log('id:', user.id)
  console.log('email:', email)
  console.log('phone:', phone)
  console.log('pin:', pin)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
