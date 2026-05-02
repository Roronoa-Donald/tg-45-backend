require('dotenv').config({ path: '.env' })
const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')
const env = require('../config/env')

const prisma = new PrismaClient()

async function upsertUser({ role, name, email, phone, pin }) {
  const hash = await bcrypt.hash(pin, env.bcryptSaltRounds)
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } })
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { role, name, email, phone, pinHash: hash, status: 'active' } })
    : await prisma.user.create({ data: { role, name, email, phone, pinHash: hash, status: 'active' } })

  if (role === 'farmer') {
    await prisma.farmerProfile.upsert({ where: { userId: user.id }, update: { farmName: `${name} Farm`, location: 'Unknown', language: 'fr' }, create: { userId: user.id, farmName: `${name} Farm`, location: 'Unknown', language: 'fr' } })
  }

  return { id: user.id, role: user.role, email: user.email, phone: user.phone, pin }
}

async function run() {
  try {
    const users = [
      { role: 'farmer', name: 'Farmer Demo', email: 'farmer.com', phone: 'farmer.com', pin: '1234' },
      { role: 'cooperative', name: 'Coop Demo', email: 'coop@example.test', phone: 'coop', pin: '1234' },
      { role: 'verifier', name: 'Verifier Demo', email: 'verifier@example.test', phone: 'verifier', pin: '1234' }
    ]

    for (const u of users) {
      const res = await upsertUser(u)
      console.log(JSON.stringify(res))
    }
  } catch (err) {
    console.error('create-demo-users failed', err)
  } finally {
    await prisma.$disconnect()
  }
}

run()
