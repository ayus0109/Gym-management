import { Router, type Request, type Response } from 'express'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { PaymentMethod, PaymentStatus, MembershipStatus, NotificationStatus, Prisma } from '../generated/prisma/client.js'
import { DateTime } from 'luxon'
import { prisma } from './db.js'
import { AuthenticatedRequest, clearSessionCookie, decryptSecret, encryptSecret, requireGym, requireOwner, setSessionCookie, sha256 } from './security.js'
import { APP_TIMEZONE, expiryFor, normalizePhone, paiseFromRupees, reminderTimeFor, utcDateOnly } from './domain.js'
import { createRazorpayPaymentLink, sendRenewalTemplate } from './providers.js'

export const apiRouter = Router()
const registerSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(254),
  phone: z.string().min(5).max(30).optional(),
  password: z.string().min(6).max(128),
  gymName: z.string().trim().min(1).max(120).optional(),
  inviteCode: z.string().trim().optional(),
})
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) })
const gymSchema = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().min(4).max(400), phone: z.string().min(8).max(30) })
const planSchema = z.object({ name: z.string().trim().min(2).max(80), durationDays: z.coerce.number().int().min(1).max(3650), price: z.coerce.number().nonnegative(), description: z.string().trim().max(500).optional().nullable(), isActive: z.boolean().optional() })
const memberSchema = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().min(8).max(30), email: z.union([z.string().email().max(254), z.literal(''), z.null()]).optional(), planId: z.string().min(1), startDate: z.string().optional(), paymentStatus: z.enum(['PENDING', 'PAID']).default('PENDING'), paymentMethod: z.enum(['CASH', 'UPI_OFFLINE', 'BANK_TRANSFER']).default('CASH') })

function newSessionToken() { return randomBytes(32).toString('base64url') }
function cleanOwner(owner: { id: string; name: string; email: string; phone: string }) { return { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone } }
function tenantId(req: AuthenticatedRequest) { if (!req.gymId) throw new Error('Gym setup is required.'); return req.gymId }
function httpError(res: Response, status: number, message: string) { return res.status(status).json({ error: message }) }
function dateLabel(date: Date) { return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(APP_TIMEZONE).toFormat('dd LLL yyyy') }

apiRouter.post('/leads/request-access', async (req, res) => {
  try {
    const { name, gymName, city, phone, membersCount } = req.body || {}
    console.log(`[Lead Capture] New Access Request: ${name} (${gymName}, ${city}) - Phone: ${phone}, Members: ${membersCount}`)
    res.json({ success: true, message: 'Access request logged successfully' })
  } catch (err) {
    res.json({ success: true })
  }
})

apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body)

    // VIP Invite / Access Code Gate (Ensures only approved gym owners can register)
    const VALID_CODES = ['FORMA2026', 'GYM2026', 'VIPACCESS', 'AYUSH2026']
    const envCode = process.env.INVITE_CODE?.trim().toUpperCase()
    if (envCode) VALID_CODES.push(envCode)
    const submittedCode = (data.inviteCode || '').trim().toUpperCase()
    if (!VALID_CODES.includes(submittedCode)) {
      return httpError(res, 403, 'A valid VIP Access Code is required to create a workspace. Please click "Request Access" to receive your invite.')
    }

    const email = data.email.toLowerCase()
    const name = data.name && data.name.trim().length > 0 ? data.name.trim() : email.split('@')[0]
    const phone = data.phone ? normalizePhone(data.phone) : '+910000000000'
    const gymName = data.gymName && data.gymName.trim().length > 0 ? data.gymName.trim() : `${name}'s Gym`

    const existing = await prisma.owner.findUnique({ where: { email }, select: { id: true } })
    if (existing) return httpError(res, 409, 'An account with this email already exists.')
    const passwordHash = await bcrypt.hash(data.password, 12)
    const token = newSessionToken()
    const { owner, gym } = await prisma.$transaction(async tx => {
      const createdOwner = await tx.owner.create({
        data: { name, email, phone, passwordHash },
        select: { id: true, name: true, email: true, phone: true },
      })
      await tx.session.create({
        data: {
          ownerId: createdOwner.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 14 * 86400000),
        },
      })
      const createdGym = await tx.gym.create({
        data: {
          ownerId: createdOwner.id,
          name: gymName,
          address: 'Fitness Studio',
          phone,
          timezone: APP_TIMEZONE,
        },
        select: { id: true, name: true, address: true, phone: true, timezone: true },
      })
      return { owner: createdOwner, gym: createdGym }
    })
    setSessionCookie(res, token)
    res.status(201).json({ owner: cleanOwner(owner), gym })
  } catch (error) { next(error) }
})

apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body)
    const owner = await prisma.owner.findUnique({ where: { email: data.email.toLowerCase() } })
    if (!owner || !(await bcrypt.compare(data.password, owner.passwordHash))) return httpError(res, 401, 'Email or password is incorrect.')
    const token = newSessionToken()
    await prisma.session.create({ data: { ownerId: owner.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 14 * 86400000) } })
    setSessionCookie(res, token)
    let gym = await prisma.gym.findUnique({ where: { ownerId: owner.id }, select: { id: true, name: true, address: true, phone: true, timezone: true } })
    if (!gym) {
      gym = await prisma.gym.create({
        data: {
          ownerId: owner.id,
          name: `${owner.name}'s Gym`,
          address: 'Fitness Studio',
          phone: owner.phone || '+910000000000',
          timezone: APP_TIMEZONE,
        },
        select: { id: true, name: true, address: true, phone: true, timezone: true },
      })
    }
    res.json({ owner: cleanOwner(owner), gym })
  } catch (error) { next(error) }
})

apiRouter.post('/auth/logout', requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try { const token = req.cookies?.forma_session as string | undefined; if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token), ownerId: req.ownerId } }); clearSessionCookie(res); res.status(204).end() } catch (error) { next(error) }
})
apiRouter.get('/auth/me', requireOwner, async (req: AuthenticatedRequest, res, next) => {
  try {
    const owner = await prisma.owner.findUnique({ where: { id: req.ownerId }, select: { id: true, name: true, email: true, phone: true } })
    if (!owner) return httpError(res, 401, 'Please sign in.')
    let gym = req.gymId ? await prisma.gym.findUnique({ where: { id: req.gymId }, select: { id: true, name: true, address: true, phone: true, timezone: true } }) : null
    if (!gym) {
      gym = await prisma.gym.findUnique({ where: { ownerId: owner.id }, select: { id: true, name: true, address: true, phone: true, timezone: true } })
      if (!gym) {
        gym = await prisma.gym.create({
          data: {
            ownerId: owner.id,
            name: `${owner.name}'s Gym`,
            address: 'Fitness Studio',
            phone: owner.phone || '+910000000000',
            timezone: APP_TIMEZONE,
          },
          select: { id: true, name: true, address: true, phone: true, timezone: true },
        })
      }
    }
    res.json({ owner, gym })
  } catch (error) { next(error) }
})

apiRouter.use('/gym', requireOwner)
apiRouter.post('/gym', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (req.gymId) return httpError(res, 409, 'Your gym profile is already set up.')
    const input = gymSchema.parse(req.body)
    const gym = await prisma.gym.create({ data: { ownerId: req.ownerId!, name: input.name, address: input.address, phone: normalizePhone(input.phone), timezone: APP_TIMEZONE } })
    res.status(201).json(gym)
  } catch (error) { next(error) }
})
apiRouter.patch('/gym', requireGym, async (req: AuthenticatedRequest, res, next) => {
  try { const input = gymSchema.parse(req.body); const gym = await prisma.gym.update({ where: { id: tenantId(req) }, data: { name: input.name, address: input.address, phone: normalizePhone(input.phone) } }); res.json(gym) } catch (error) { next(error) }
})
apiRouter.get('/gym', requireGym, async (req: AuthenticatedRequest, res, next) => {
  try { const gym = await prisma.gym.findUnique({ where: { id: tenantId(req) }, select: { id: true, name: true, address: true, phone: true, timezone: true } }); res.json(gym) } catch (error) { next(error) }
})

const ownerRouter = Router()
apiRouter.use(ownerRouter)
ownerRouter.use(requireOwner, requireGym)

ownerRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const gymId = tenantId(req)
    const now = DateTime.now().setZone(APP_TIMEZONE).startOf('day').toJSDate()
    const week = DateTime.fromJSDate(now).plus({ days: 7 }).endOf('day').toJSDate()
    const monthStart = DateTime.now().setZone(APP_TIMEZONE).startOf('month').toUTC().toJSDate()
    const nextMonth = DateTime.now().setZone(APP_TIMEZONE).plus({ months: 1 }).startOf('month').toUTC().toJSDate()
    const [totalMembers, latestMembershipRows, revenue, pending, newRegistrations, recentMembers, recentPayments, expiringList] = await Promise.all([
      prisma.member.count({ where: { gymId, isArchived: false } }),
      prisma.member.findMany({ where: { gymId, isArchived: false }, select: { memberships: { orderBy: { createdAt: 'desc' }, select: { status: true, startDate: true, expiryDate: true, payments: { where: { status: PaymentStatus.PAID }, select: { id: true }, take: 1 } } } } }),
      prisma.payment.aggregate({ where: { gymId, status: PaymentStatus.PAID, paymentDate: { gte: monthStart, lt: nextMonth } }, _sum: { amountPaise: true } }),
      prisma.payment.aggregate({ where: { gymId, status: PaymentStatus.PENDING }, _sum: { amountPaise: true }, _count: { _all: true } }),
      prisma.member.count({ where: { gymId, isArchived: false, createdAt: { gte: monthStart, lt: nextMonth } } }),
      prisma.member.findMany({ where: { gymId, isArchived: false }, orderBy: { createdAt: 'desc' }, take: 5, include: { memberships: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
      prisma.payment.findMany({ where: { gymId }, orderBy: { createdAt: 'desc' }, take: 5, include: { member: { select: { name: true } } } }),
      prisma.membership.findMany({ where: { gymId, status: MembershipStatus.ACTIVE, expiryDate: { gte: now, lte: week }, member: { isArchived: false } }, orderBy: { expiryDate: 'asc' }, take: 5, include: { member: { select: { name: true } } } }),
    ])
    const isActivePaidNow = (membership: typeof latestMembershipRows[number]['memberships'][number]) => membership.status === MembershipStatus.ACTIVE && membership.startDate <= now && membership.expiryDate >= now && membership.payments.length > 0
    const activeMemberships = latestMembershipRows.filter(member => member.memberships.some(isActivePaidNow)).length
    const expiredMemberships = latestMembershipRows.filter(member => !member.memberships.some(isActivePaidNow) && Boolean(member.memberships[0] && member.memberships[0].expiryDate < now)).length
    const expiringSoon = latestMembershipRows.filter(member => member.memberships.some(membership => isActivePaidNow(membership) && membership.expiryDate <= week)).length
    res.json({ metrics: { totalMembers, activeMemberships, expiredMemberships, expiringSoon, monthlyRevenuePaise: revenue._sum.amountPaise ?? 0, pendingPaymentsPaise: pending._sum.amountPaise ?? 0, pendingPaymentCount: pending._count._all, newRegistrations }, recentMembers, recentPayments, expiringList })
  } catch (error) { next(error) }
})

ownerRouter.get('/members', async (req: AuthenticatedRequest, res, next) => {
  try {
    const gymId = tenantId(req); const q = String(req.query.q ?? '').trim(); const status = String(req.query.status ?? ''); const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(1000, Math.max(1, Number(req.query.pageSize) || 50)); const today = utcDateOnly(DateTime.now().setZone(APP_TIMEZONE).toISODate()!)
    const where: Prisma.MemberWhereInput = { gymId, isArchived: false, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) }
    const [items, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: status ? 0 : (page - 1) * pageSize,
        take: status ? 1000 : pageSize,
        include: {
          memberships: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } }
          }
        }
      }),
      prisma.member.count({ where })
    ])
    const filtered = status ? items.filter(m => {
      const membership = m.memberships[0];
      if (!membership) return status === 'No membership';
      const paid = membership.payments.some(p => p.status === PaymentStatus.PAID);
      if (!paid) return status === 'Pending payment';
      if (membership.expiryDate < today) return status === 'Expired';
      if (membership.expiryDate.getTime() - today.getTime() <= 7 * 86400000) return status === 'Expiring soon';
      return status === 'Active'
    }) : items
    res.json({
      items: status ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered,
      total: status ? filtered.length : total,
      page,
      pageSize
    })
  } catch (error) { next(error) }
})

const bulkImportMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().min(8).max(30),
  email: z.union([z.string().email().max(254), z.literal(''), z.null()]).optional(),
  planName: z.string().trim().max(80).optional(),
  planId: z.string().optional(),
  startDate: z.string().optional(),
  paymentStatus: z.enum(['PENDING', 'PAID']).default('PAID'),
  paymentMethod: z.enum(['CASH', 'UPI_OFFLINE', 'BANK_TRANSFER']).default('CASH')
})
const bulkImportSchema = z.object({
  members: z.array(bulkImportMemberSchema).min(1).max(1000)
})

ownerRouter.post('/members/import', async (req: AuthenticatedRequest, res, next) => {
  try {
    const gymId = tenantId(req)
    const { members } = bulkImportSchema.parse(req.body)
    const existingPlans = await prisma.membershipPlan.findMany({ where: { gymId, isActive: true } })

    let defaultPlan = existingPlans[0]
    if (!defaultPlan) {
      defaultPlan = await prisma.membershipPlan.create({
        data: {
          gymId,
          name: 'Standard Monthly',
          durationDays: 30,
          pricePaise: paiseFromRupees(1500),
          isActive: true
        }
      })
      existingPlans.push(defaultPlan)
    }

    let importedCount = 0
    const errors: string[] = []

    for (const [idx, item] of members.entries()) {
      try {
        const phone = normalizePhone(item.phone)
        let plan = defaultPlan
        if (item.planId) {
          const found = existingPlans.find(p => p.id === item.planId)
          if (found) plan = found
        } else if (item.planName?.trim()) {
          const found = existingPlans.find(p => p.name.toLowerCase() === item.planName!.trim().toLowerCase())
          if (found) {
            plan = found
          } else {
            const createdPlan = await prisma.membershipPlan.create({
              data: {
                gymId,
                name: item.planName.trim(),
                durationDays: 30,
                pricePaise: paiseFromRupees(1500),
                isActive: true
              }
            })
            existingPlans.push(createdPlan)
            plan = createdPlan
          }
        }

        const startDate = utcDateOnly(item.startDate || DateTime.now().setZone(APP_TIMEZONE).toISODate()!)
        const expiryDate = expiryFor(startDate, plan.durationDays)
        const paid = item.paymentStatus === 'PAID'
        const status = paid ? MembershipStatus.ACTIVE : MembershipStatus.PENDING_PAYMENT

        await prisma.$transaction(async tx => {
          const created = await tx.member.create({
            data: {
              gymId,
              name: item.name.trim(),
              phone,
              email: item.email?.trim() || null
            }
          })
          const membership = await tx.membership.create({
            data: {
              gymId,
              memberId: created.id,
              planId: plan.id,
              planNameSnapshot: plan.name,
              durationDaysSnapshot: plan.durationDays,
              amountPaise: plan.pricePaise,
              startDate,
              expiryDate,
              status
            }
          })
          await tx.payment.create({
            data: {
              gymId,
              memberId: created.id,
              membershipId: membership.id,
              amountPaise: plan.pricePaise,
              method: paid ? (item.paymentMethod as PaymentMethod) : PaymentMethod.CASH,
              status: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
              paymentDate: paid ? new Date() : null
            }
          })
          await tx.notification.create({
            data: {
              gymId,
              memberId: created.id,
              membershipId: membership.id,
              type: 'RENEWAL_T_MINUS_2',
              scheduledAt: reminderTimeFor(expiryDate)
            }
          })
        })
        importedCount++
      } catch (err: any) {
        errors.push(`Row ${idx + 1} (${item.name}): ${err?.message ?? 'Invalid entry'}`)
      }
    }

    res.json({ success: true, count: importedCount, total: members.length, errors })
  } catch (error) { next(error) }
})

ownerRouter.post('/members', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = memberSchema.parse(req.body); const gymId = tenantId(req); const plan = await prisma.membershipPlan.findFirst({ where: { id: input.planId, gymId, isActive: true } }); if (!plan) return httpError(res, 404, 'Choose an active membership plan.')
    const startDate = utcDateOnly(input.startDate || DateTime.now().setZone(APP_TIMEZONE).toISODate()!); const expiryDate = expiryFor(startDate, plan.durationDays); const phone = normalizePhone(input.phone); const paid = input.paymentStatus === 'PAID'; const status = paid ? MembershipStatus.ACTIVE : MembershipStatus.PENDING_PAYMENT
    const member = await prisma.$transaction(async tx => {
      const created = await tx.member.create({ data: { gymId, name: input.name, phone, email: input.email || null } })
      const membership = await tx.membership.create({ data: { gymId, memberId: created.id, planId: plan.id, planNameSnapshot: plan.name, durationDaysSnapshot: plan.durationDays, amountPaise: plan.pricePaise, startDate, expiryDate, status } })
      await tx.payment.create({ data: { gymId, memberId: created.id, membershipId: membership.id, amountPaise: plan.pricePaise, method: paid ? input.paymentMethod as PaymentMethod : PaymentMethod.CASH, status: paid ? PaymentStatus.PAID : PaymentStatus.PENDING, paymentDate: paid ? new Date() : null } })
      await tx.notification.create({ data: { gymId, memberId: created.id, membershipId: membership.id, type: 'RENEWAL_T_MINUS_2', scheduledAt: reminderTimeFor(expiryDate) } })
      return { ...created, memberships: [membership] }
    })
    res.status(201).json(member)
  } catch (error) { next(error) }
})
ownerRouter.get('/members/:id', async (req: AuthenticatedRequest, res, next) => {
  try { const item = await prisma.member.findFirst({ where: { id: String(req.params.id), gymId: tenantId(req), isArchived: false }, include: { memberships: { orderBy: { createdAt: 'desc' }, include: { plan: { select: { name: true } }, payments: { orderBy: { createdAt: 'desc' } } } } } }); if (!item) return httpError(res, 404, 'Member not found.'); res.json(item) } catch (error) { next(error) }
})
ownerRouter.patch('/members/:id', async (req: AuthenticatedRequest, res, next) => {
  try { const input = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().min(8).max(30), email: z.union([z.string().email().max(254), z.literal(''), z.null()]).optional() }).parse(req.body); const changed = await prisma.member.updateMany({ where: { id: String(req.params.id), gymId: tenantId(req), isArchived: false }, data: { name: input.name, phone: normalizePhone(input.phone), email: input.email || null } }); if (!changed.count) return httpError(res, 404, 'Member not found.'); const member = await prisma.member.findFirst({ where: { id: String(req.params.id), gymId: tenantId(req) } }); res.json(member) } catch (error) { next(error) }
})
ownerRouter.delete('/members/:id', async (req: AuthenticatedRequest, res, next) => {
  try { const result = await prisma.member.updateMany({ where: { id: String(req.params.id), gymId: tenantId(req), isArchived: false }, data: { isArchived: true } }); if (!result.count) return httpError(res, 404, 'Member not found.'); res.status(204).end() } catch (error) { next(error) }
})

ownerRouter.get('/plans', async (req: AuthenticatedRequest, res, next) => { try { res.json(await prisma.membershipPlan.findMany({ where: { gymId: tenantId(req) }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { memberships: true } } } })) } catch (error) { next(error) } })
ownerRouter.post('/plans', async (req: AuthenticatedRequest, res, next) => {
  try { const data = planSchema.parse(req.body); const pricePaise = paiseFromRupees(data.price); const plan = await prisma.membershipPlan.create({ data: { gymId: tenantId(req), name: data.name, durationDays: data.durationDays, pricePaise, description: data.description || null, isActive: data.isActive ?? true } }); res.status(201).json(plan) } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return httpError(res, 409, 'A plan with this name already exists.'); next(error) }
})
ownerRouter.patch('/plans/:id', async (req: AuthenticatedRequest, res, next) => {
  try { const data = planSchema.partial().parse(req.body); const changed = await prisma.membershipPlan.updateMany({ where: { id: String(req.params.id), gymId: tenantId(req) }, data: { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}), ...(data.price !== undefined ? { pricePaise: paiseFromRupees(data.price) } : {}), ...(data.description !== undefined ? { description: data.description || null } : {}), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}) } }); if (!changed.count) return httpError(res, 404, 'Plan not found.'); res.json(await prisma.membershipPlan.findFirst({ where: { id: String(req.params.id), gymId: tenantId(req) } })) } catch (error) { next(error) }
})
ownerRouter.delete('/plans/:id', async (req: AuthenticatedRequest, res, next) => {
  try { const result = await prisma.membershipPlan.deleteMany({ where: { id: String(req.params.id), gymId: tenantId(req), memberships: { none: {} } } }); if (!result.count) return httpError(res, 409, 'This plan is in use or could not be found. Deactivate it to keep its history.'); res.status(204).end() } catch (error) { next(error) }
})

ownerRouter.get('/payments', async (req: AuthenticatedRequest, res, next) => {
  try { const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20)); const status = String(req.query.status ?? ''); const where: Prisma.PaymentWhereInput = { gymId: tenantId(req), ...(Object.values(PaymentStatus).includes(status as PaymentStatus) ? { status: status as PaymentStatus } : {}) }; const [items, total] = await Promise.all([prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { member: { select: { name: true, phone: true } }, membership: { select: { planNameSnapshot: true } } } }), prisma.payment.count({ where })]); res.json({ items, total, page, pageSize }) } catch (error) { next(error) }
})
ownerRouter.post('/payments/:id/link', async (req: AuthenticatedRequest, res, next) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: String(req.params.id), gymId: tenantId(req), status: PaymentStatus.PENDING }, include: { member: true, gym: true } })
    if (!payment) return httpError(res, 404, 'Pending payment not found.')
    if (payment.razorpayPaymentLinkId && payment.paymentUrl) return res.json({ id: payment.razorpayPaymentLinkId, shortUrl: payment.paymentUrl })
    const link = await createRazorpayPaymentLink(payment.gymId, payment.id, payment.member, payment.gym.name, payment.amountPaise)
    await prisma.payment.updateMany({ where: { id: payment.id, gymId: payment.gymId, status: PaymentStatus.PENDING, razorpayPaymentLinkId: null }, data: { razorpayPaymentLinkId: link.id, paymentUrl: link.shortUrl, method: PaymentMethod.RAZORPAY } })
    res.json(link)
  } catch (error) { next(error) }
})
ownerRouter.post('/payments/offline', async (req: AuthenticatedRequest, res, next) => {
  try { const data = z.object({ membershipId: z.string(), amount: z.coerce.number().positive(), method: z.enum(['CASH', 'UPI_OFFLINE', 'BANK_TRANSFER']), reference: z.string().max(120).optional() }).parse(req.body); const gymId = tenantId(req); const membership = await prisma.membership.findFirst({ where: { id: data.membershipId, gymId, member: { isArchived: false } } }); if (!membership) return httpError(res, 404, 'Membership not found.'); const payment = await prisma.$transaction(async tx => { const created = await tx.payment.create({ data: { gymId, memberId: membership.memberId, membershipId: membership.id, amountPaise: paiseFromRupees(data.amount), method: data.method as PaymentMethod, status: PaymentStatus.PAID, paymentDate: new Date(), transactionReference: data.reference || null } }); if (membership.status === MembershipStatus.PENDING_PAYMENT) await tx.membership.update({ where: { id: membership.id }, data: { status: membership.startDate > new Date() ? MembershipStatus.SCHEDULED : MembershipStatus.ACTIVE } }); return created }); res.status(201).json(payment) } catch (error) { next(error) }
})

ownerRouter.get('/settings/integrations', async (req: AuthenticatedRequest, res, next) => {
  try {
    const settings = await prisma.integrationSettings.findUnique({ where: { gymId: tenantId(req) } });
    res.json({
      razorpayConfigured: Boolean(settings?.razorpayKeyIdEncrypted && settings.razorpaySecretEncrypted),
      whatsappConfigured: Boolean(settings?.whatsappTokenEncrypted && settings.whatsappPhoneNumberId && settings.whatsappTemplateName),
      upiId: settings?.whatsappBusinessAccountId ?? '',
      renewalTemplate: settings?.whatsappTemplateName ?? '',
      whatsappPhoneNumberId: settings?.whatsappPhoneNumberId ?? '',
      whatsappBusinessAccountId: settings?.whatsappBusinessAccountId ?? '',
      whatsappTemplateName: settings?.whatsappTemplateName ?? '',
      whatsappTemplateLanguage: settings?.whatsappTemplateLanguage ?? 'en'
    })
  } catch (error) { next(error) }
})
ownerRouter.put('/settings/integrations', async (req: AuthenticatedRequest, res, next) => {
  try {
    const input = z.object({
      upiId: z.string().max(200).optional(),
      renewalTemplate: z.string().max(2000).optional(),
      razorpayKeyId: z.string().max(200).optional(),
      razorpaySecret: z.string().max(500).optional(),
      razorpayWebhookSecret: z.string().max(500).optional(),
      whatsappToken: z.string().max(1000).optional(),
      whatsappPhoneNumberId: z.string().max(200).optional(),
      whatsappBusinessAccountId: z.string().max(200).optional(),
      whatsappTemplateName: z.string().max(2000).optional(),
      whatsappTemplateLanguage: z.string().max(20).optional()
    }).parse(req.body)
    const enc = (value?: string) => value ? encryptSecret(value) : undefined
    const upiIdValue = input.upiId !== undefined ? input.upiId.trim() : (input.whatsappBusinessAccountId !== undefined ? input.whatsappBusinessAccountId.trim() : undefined)
    const templateValue = input.renewalTemplate !== undefined ? input.renewalTemplate.trim() : (input.whatsappTemplateName !== undefined ? input.whatsappTemplateName.trim() : undefined)
    const data = {
      ...(enc(input.razorpayKeyId) ? { razorpayKeyIdEncrypted: enc(input.razorpayKeyId) } : {}),
      ...(enc(input.razorpaySecret) ? { razorpaySecretEncrypted: enc(input.razorpaySecret) } : {}),
      ...(enc(input.razorpayWebhookSecret) ? { razorpayWebhookEncrypted: enc(input.razorpayWebhookSecret) } : {}),
      ...(enc(input.whatsappToken) ? { whatsappTokenEncrypted: enc(input.whatsappToken) } : {}),
      ...(input.whatsappPhoneNumberId?.trim() ? { whatsappPhoneNumberId: input.whatsappPhoneNumberId.trim() } : {}),
      ...(upiIdValue !== undefined ? { whatsappBusinessAccountId: upiIdValue } : {}),
      ...(templateValue !== undefined ? { whatsappTemplateName: templateValue } : {}),
      ...(input.whatsappTemplateLanguage !== undefined ? { whatsappTemplateLanguage: input.whatsappTemplateLanguage } : {})
    }
    const saved = await prisma.integrationSettings.upsert({
      where: { gymId: tenantId(req) },
      create: { gymId: tenantId(req), ...data },
      update: {
        ...data,
        ...(input.whatsappPhoneNumberId?.trim() ? { whatsappPhoneNumberId: input.whatsappPhoneNumberId.trim() } : {}),
        ...(upiIdValue !== undefined ? { whatsappBusinessAccountId: upiIdValue } : {}),
        ...(templateValue !== undefined ? { whatsappTemplateName: templateValue } : {})
      }
    })
    res.json({
      razorpayConfigured: Boolean(saved.razorpayKeyIdEncrypted && saved.razorpaySecretEncrypted),
      whatsappConfigured: Boolean(saved.whatsappTokenEncrypted && saved.whatsappPhoneNumberId && saved.whatsappTemplateName),
      upiId: saved.whatsappBusinessAccountId ?? '',
      renewalTemplate: saved.whatsappTemplateName ?? '',
      whatsappPhoneNumberId: saved.whatsappPhoneNumberId ?? '',
      whatsappBusinessAccountId: saved.whatsappBusinessAccountId ?? '',
      whatsappTemplateName: saved.whatsappTemplateName ?? '',
      whatsappTemplateLanguage: saved.whatsappTemplateLanguage
    })
  } catch (error) { next(error) }
})

export async function razorpayWebhook(req: Request, res: Response) {
  const raw = req.body as Buffer
  const signature = req.header('x-razorpay-signature') ?? ''
  const eventId = req.header('x-razorpay-event-id') ?? ''
  if (!Buffer.isBuffer(raw) || !signature || !eventId) return res.status(400).json({ error: 'Missing raw payload or webhook signature.' })
  let body: any
  try { body = JSON.parse(raw.toString('utf8')) } catch { return res.status(400).json({ error: 'Invalid webhook payload.' }) }
  const linkId = body?.payload?.payment_link?.entity?.id
  if (!linkId) return res.status(200).json({ received: true, ignored: true })
  try {
    const payment = await prisma.payment.findUnique({ where: { razorpayPaymentLinkId: linkId }, select: { id: true, gymId: true, membershipId: true, status: true } })
    if (!payment) return res.status(200).json({ received: true, ignored: true })
    const settings = await prisma.integrationSettings.findUnique({ where: { gymId: payment.gymId }, select: { razorpayWebhookEncrypted: true } })
    if (!settings?.razorpayWebhookEncrypted) return res.status(401).json({ error: 'No webhook secret is configured for this gym.' })
    const secret = decryptSecret(settings.razorpayWebhookEncrypted)
    const expected = createHmac('sha256', secret).update(raw).digest()
    const received = Buffer.from(signature, 'hex')
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return res.status(401).json({ error: 'Invalid webhook signature.' })
    const event = String(body.event ?? '')
    if (event === 'payment_link.cancelled' || event === 'payment_link.expired' || event === 'payment.failed') {
      const status = event === 'payment_link.cancelled' || event === 'payment_link.expired' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED
      await prisma.payment.updateMany({ where: { id: payment.id, gymId: payment.gymId, status: PaymentStatus.PENDING }, data: { status } })
      return res.json({ received: true })
    }
    if (event !== 'payment_link.paid') return res.status(200).json({ received: true, ignored: true })
    const amountPaid = Number(body?.payload?.payment_link?.entity?.amount_paid ?? 0)
    await prisma.$transaction(async tx => {
      await tx.webhookEvent.create({ data: { eventId, provider: 'razorpay' } })
      const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { membership: true } })
      if (!current || current.status === PaymentStatus.PAID) return
      if (amountPaid < current.amountPaise) throw new Error('Razorpay payment is less than the expected amount.')
      await tx.payment.update({ where: { id: current.id }, data: { status: PaymentStatus.PAID, paymentDate: new Date(), razorpayPaymentId: body?.payload?.payment?.entity?.id ?? undefined, transactionReference: body?.payload?.payment?.entity?.id ?? undefined } })
      const source = current.membership
      const nextDay = new Date(source.expiryDate); nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      const today = utcDateOnly(DateTime.now().setZone(APP_TIMEZONE).toISODate()!)
      const startDate = nextDay > today ? nextDay : today
      const expiryDate = expiryFor(startDate, source.durationDaysSnapshot)
      const status = startDate > new Date() ? MembershipStatus.SCHEDULED : MembershipStatus.ACTIVE
      const renewed = await tx.membership.create({ data: { gymId: current.gymId, memberId: current.memberId, planId: source.planId, planNameSnapshot: source.planNameSnapshot, durationDaysSnapshot: source.durationDaysSnapshot, amountPaise: source.amountPaise, startDate, expiryDate, status, renewedFromId: source.id } })
      await tx.payment.update({ where: { id: current.id }, data: { membershipId: renewed.id } })
      await tx.notification.create({ data: { gymId: current.gymId, memberId: current.memberId, membershipId: renewed.id, type: 'RENEWAL_T_MINUS_2', scheduledAt: reminderTimeFor(expiryDate) } })
    })
    return res.json({ received: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.json({ received: true, duplicate: true })
    console.error('Razorpay webhook processing failed', error)
    return res.status(500).json({ error: 'Webhook processing failed; provider may retry.' })
  }
}

export async function processDueNotifications() {
  const today = utcDateOnly(DateTime.now().setZone(APP_TIMEZONE).toISODate()!)
  await prisma.membership.updateMany({ where: { status: MembershipStatus.ACTIVE, expiryDate: { lt: today } }, data: { status: MembershipStatus.EXPIRED } })
  await prisma.membership.updateMany({ where: { status: MembershipStatus.SCHEDULED, startDate: { lte: today }, expiryDate: { gte: today } }, data: { status: MembershipStatus.ACTIVE } })
  const due = await prisma.notification.findMany({ where: { scheduledAt: { lte: new Date() }, OR: [{ status: NotificationStatus.PENDING }, { status: NotificationStatus.FAILED, attempts: { lt: 3 } }] }, select: { id: true }, take: 50 })
  for (const item of due) {
    const claim = await prisma.notification.updateMany({ where: { id: item.id, scheduledAt: { lte: new Date() }, OR: [{ status: NotificationStatus.PENDING }, { status: NotificationStatus.FAILED, attempts: { lt: 3 } }] }, data: { status: NotificationStatus.PROCESSING, attempts: { increment: 1 }, errorMessage: null } })
    if (!claim.count) continue
    try {
      const notification = await prisma.notification.findUnique({ where: { id: item.id }, include: { member: true, gym: true, membership: { include: { payments: { where: { status: PaymentStatus.PAID } }, renewals: { include: { payments: true } } } } } })
      if (!notification || notification.member.isArchived) { await prisma.notification.update({ where: { id: item.id }, data: { status: NotificationStatus.SKIPPED, errorMessage: 'Member is archived or notification no longer exists.' } }); continue }
      if (notification.membership.status !== MembershipStatus.ACTIVE || notification.membership.payments.length === 0) { await prisma.notification.update({ where: { id: item.id }, data: { status: NotificationStatus.SKIPPED, errorMessage: 'A paid active membership is required for renewal reminders.' } }); continue }
      const renewalExists = notification.membership.renewals.some(renewal => renewal.status !== MembershipStatus.CANCELLED)
      if (renewalExists) { await prisma.notification.update({ where: { id: item.id }, data: { status: NotificationStatus.SKIPPED, errorMessage: 'Membership has already been renewed.' } }); continue }
      let payment = await prisma.payment.findFirst({ where: { renewalRequestKey: `renewal:${notification.membershipId}` } })
      if (!payment) payment = await prisma.payment.create({ data: { gymId: notification.gymId, memberId: notification.memberId, membershipId: notification.membershipId, renewalRequestKey: `renewal:${notification.membershipId}`, amountPaise: notification.membership.amountPaise, method: PaymentMethod.RAZORPAY, status: PaymentStatus.PENDING } })
      let paymentLink = notification.paymentLink
      if (!paymentLink) { const link = await createRazorpayPaymentLink(notification.gymId, payment.id, notification.member, notification.gym.name, payment.amountPaise); paymentLink = link.shortUrl; await prisma.payment.update({ where: { id: payment.id }, data: { razorpayPaymentLinkId: link.id, paymentUrl: paymentLink } }); await prisma.notification.update({ where: { id: item.id }, data: { paymentLink } }) }
      const sent = await sendRenewalTemplate(notification.gymId, notification.member, notification.gym.name, dateLabel(notification.membership.expiryDate), paymentLink)
      await prisma.notification.update({ where: { id: item.id }, data: { status: NotificationStatus.SENT, sentAt: new Date(), providerMessageId: sent.messageId, paymentLink, errorMessage: null } })
    } catch (error) {
      const attempts = await prisma.notification.findUnique({ where: { id: item.id }, select: { attempts: true } })
      await prisma.notification.update({ where: { id: item.id }, data: { status: NotificationStatus.FAILED, scheduledAt: new Date(Date.now() + Math.min(60, 5 * (attempts?.attempts ?? 1)) * 60000), errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Notification failed.' } })
      console.error(`Notification ${item.id} failed`, error)
    }
  }
}


