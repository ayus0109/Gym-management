import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { MembershipStatus, PaymentMethod, PaymentStatus } from '../server/generated/prisma/client.js'
import { prisma } from '../server/src/db.js'
import { expiryFor, reminderTimeFor, utcDateOnly } from '../server/src/domain.js'

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The development seed is disabled in production.')
  const email = process.env.DEMO_OWNER_EMAIL
  const password = process.env.DEMO_OWNER_PASSWORD
  if (!email || !password || password.length < 10) throw new Error('Set DEMO_OWNER_EMAIL and a 10+ character DEMO_OWNER_PASSWORD before seeding.')
  const passwordHash = await bcrypt.hash(password, 12)
  const owner = await prisma.owner.upsert({ where: { email: email.toLowerCase() }, update: { passwordHash }, create: { name: 'Alex Morgan', email: email.toLowerCase(), phone: '+919876500000', passwordHash } })
  const gym = await prisma.gym.upsert({ where: { ownerId: owner.id }, update: { name: 'Northstar Fitness', address: '42, 12th Main Road, Indiranagar, Bengaluru', phone: '+918045678900' }, create: { ownerId: owner.id, name: 'Northstar Fitness', address: '42, 12th Main Road, Indiranagar, Bengaluru', phone: '+918045678900', timezone: 'Asia/Kolkata' } })
  const seedPlans = [
    { name: 'Monthly', durationDays: 30, pricePaise: 100000, description: 'A month of training' },
    { name: 'Quarterly', durationDays: 90, pricePaise: 270000, description: 'Three months of training' },
    { name: 'Half-yearly', durationDays: 180, pricePaise: 500000, description: 'Six months of training' },
    { name: 'Annual', durationDays: 365, pricePaise: 900000, description: 'A year of training' },
  ]
  for (const plan of seedPlans) await prisma.membershipPlan.upsert({ where: { gymId_name: { gymId: gym.id, name: plan.name } }, update: plan, create: { gymId: gym.id, ...plan } })
  const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { gymId_name: { gymId: gym.id, name: 'Monthly' } } })
  let member = await prisma.member.findFirst({ where: { gymId: gym.id, phone: '+919876543210' } })
  if (!member) member = await prisma.member.create({ data: { gymId: gym.id, name: 'Priya Sharma', phone: '+919876543210', email: 'priya@example.test' } })
  const hasMembership = await prisma.membership.findFirst({ where: { gymId: gym.id, memberId: member.id } })
  if (!hasMembership) {
    const startDate = utcDateOnly(new Date().toISOString().slice(0, 10))
    const expiryDate = expiryFor(startDate, plan.durationDays)
    await prisma.$transaction(async tx => {
      const membership = await tx.membership.create({ data: { gymId: gym.id, memberId: member.id, planId: plan.id, planNameSnapshot: plan.name, durationDaysSnapshot: plan.durationDays, amountPaise: plan.pricePaise, startDate, expiryDate, status: MembershipStatus.ACTIVE } })
      await tx.payment.create({ data: { gymId: gym.id, memberId: member.id, membershipId: membership.id, amountPaise: plan.pricePaise, status: PaymentStatus.PAID, method: PaymentMethod.CASH, paymentDate: new Date(), transactionReference: 'DEV-SEED-OFFLINE' } })
      await tx.notification.create({ data: { gymId: gym.id, memberId: member.id, membershipId: membership.id, type: 'RENEWAL_T_MINUS_2', scheduledAt: reminderTimeFor(expiryDate) } })
    })
  }
  console.info(`Development seed ready. Sign in as ${email}.`)
}

main().finally(() => prisma.$disconnect())
