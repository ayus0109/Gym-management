import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

const testUrl = process.env.TEST_DATABASE_URL
const databaseName = testUrl ? new URL(testUrl).pathname.slice(1).split('?')[0] : ''

test('owners cannot list or modify another gym’s members, plans, or payments', { skip: !testUrl }, async () => {
  assert.match(databaseName, /test/i, 'TEST_DATABASE_URL must point to a database with "test" in its name.')
  process.env.DATABASE_URL = testUrl
  process.env.DATABASE_URL_UNPOOLED = testUrl
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64')
  const [{ prisma }, { app }, { encryptSecret }, bcryptModule] = await Promise.all([import('./db.js'), import('./app.js'), import('./security.js'), import('bcryptjs')])
  const bcrypt = bcryptModule.default
  const suffix = randomUUID()
  const linkId = `plink_test_${suffix}`
  const providerPaymentId = `pay_test_${suffix}`
  const emailA = `owner-a-${suffix}@example.test`
  const emailB = `owner-b-${suffix}@example.test`
  const passwordHash = await bcrypt.hash('safe-test-password-123', 4)
  const ownerA = await prisma.owner.create({ data: { name: 'Owner A', email: emailA, phone: '+919876500001', passwordHash }, include: { gym: true } })
  const ownerB = await prisma.owner.create({ data: { name: 'Owner B', email: emailB, phone: '+919876500002', passwordHash } })
  const gymA = await prisma.gym.create({ data: { ownerId: ownerA.id, name: 'Gym A', address: 'Test address A', phone: '+919876500001' } })
  const gymB = await prisma.gym.create({ data: { ownerId: ownerB.id, name: 'Gym B', address: 'Test address B', phone: '+919876500002' } })
  const planA = await prisma.membershipPlan.create({ data: { gymId: gymA.id, name: 'Plan A', durationDays: 30, pricePaise: 100000 } })
  const memberB = await prisma.member.create({ data: { gymId: gymB.id, name: 'Private member', phone: '+919876511111' } })
  const planB = await prisma.membershipPlan.create({ data: { gymId: gymB.id, name: 'Private plan', durationDays: 30, pricePaise: 100000 } })
  const membershipB = await prisma.membership.create({ data: { gymId: gymB.id, memberId: memberB.id, planId: planB.id, planNameSnapshot: planB.name, durationDaysSnapshot: planB.durationDays, amountPaise: planB.pricePaise, startDate: new Date('2026-11-01T00:00:00Z'), expiryDate: new Date('2026-11-30T00:00:00Z') } })
  const paymentB = await prisma.payment.create({ data: { gymId: gymB.id, memberId: memberB.id, membershipId: membershipB.id, amountPaise: 100000, method: 'RAZORPAY', status: 'PENDING', razorpayPaymentLinkId: linkId } })
  await prisma.integrationSettings.create({ data: { gymId: gymB.id, razorpayWebhookEncrypted: encryptSecret('integration-test-secret') } })
  const server = app.listen(0)
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.')
    const base = `http://127.0.0.1:${address.port}/api`
    const protectedRequest = await fetch(`${base}/members`)
    assert.equal(protectedRequest.status, 401)
    const badLogin = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailA, password: 'not-the-password' }) })
    assert.equal(badLogin.status, 401)
    const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: emailA, password: 'safe-test-password-123' }) })
    assert.equal(login.status, 200)
    const cookie = login.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie)
    const listMembers = await fetch(`${base}/members`, { headers: { cookie } })
    assert.equal(listMembers.status, 200)
    assert.deepEqual((await listMembers.json() as { items: unknown[] }).items, [])
    const privateMember = await fetch(`${base}/members/${memberB.id}`, { headers: { cookie } })
    assert.equal(privateMember.status, 404)
    const privatePlan = await fetch(`${base}/plans/${planB.id}`, { method: 'PATCH', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ isActive: false }) })
    assert.equal(privatePlan.status, 404)
    const paymentList = await fetch(`${base}/payments`, { headers: { cookie } })
    const visiblePayments = (await paymentList.json() as { items: Array<{ id: string }> }).items
    assert.ok(visiblePayments.every(payment => payment.id !== paymentB.id))
    const privatePaymentLink = await fetch(`${base}/payments/${paymentB.id}/link`, { method: 'POST', headers: { cookie } })
    assert.equal(privatePaymentLink.status, 404)
    const stillActive = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: planB.id } })
    assert.equal(stillActive.isActive, true)

    const created = await fetch(`${base}/members`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Member A', phone: '9876543333', planId: planA.id, startDate: '2026-11-01', paymentStatus: 'PAID', paymentMethod: 'CASH' }) })
    assert.equal(created.status, 201)
    const createdMember = await created.json() as { memberships: Array<{ expiryDate: string; status: string }> }
    assert.equal(new Date(createdMember.memberships[0].expiryDate).toISOString().slice(0, 10), '2026-11-30')
    assert.equal(createdMember.memberships[0].status, 'ACTIVE')

    const headers = { cookie, 'content-type': 'application/json' }
    const settings = { upiId: 'test@upi', whatsappBusinessAccountId: '12345', renewalTemplate: 'Hello {name}', whatsappTemplateName: 'renewal_notice' }
    const configured = await fetch(base + '/settings/integrations', { method: 'PUT', headers, body: JSON.stringify(settings) })
    assert.equal(configured.status, 200)
    const stored = await configured.json() as Record<string, unknown>
    for (const [key, value] of Object.entries(settings)) assert.equal(stored[key], value)

    const enrolment = await fetch(base + '/members', { method: 'POST', headers, body: JSON.stringify({
      name: 'Pending Member', phone: '9876543321', planId: planA.id, paymentStatus: 'PENDING',
    }) })
    assert.equal(enrolment.status, 201)
    const pendingMember = await enrolment.json() as { memberships: Array<{ id: string }> }
    const membershipId = pendingMember.memberships[0].id
    const collect = (amount: number) => fetch(base + '/payments/offline', {
      method: 'POST', headers, body: JSON.stringify({ membershipId, amount, method: 'CASH' }),
    })
    assert.equal((await collect(1250)).status, 400)
    assert.equal((await collect(200.25)).status, 201)
    const balance = await prisma.payment.findFirstOrThrow({ where: { membershipId, status: 'PENDING' } })
    assert.equal(balance.amountPaise, 79975)
    assert.equal((await collect(799.75)).status, 201)
    assert.equal(await prisma.payment.count({ where: { membershipId, status: 'PENDING' } }), 0)
    const paidTotal = await prisma.payment.aggregate({ where: { membershipId, status: 'PAID' }, _sum: { amountPaise: true } })
    assert.equal(paidTotal._sum.amountPaise, 100000)

    const webhookBody = JSON.stringify({ event: 'payment_link.paid', payload: { payment_link: { entity: { id: linkId, amount_paid: 100000 } }, payment: { entity: { id: providerPaymentId } } } })
    const badSignature = await fetch(`${base}/webhooks/razorpay`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'deadbeef', 'x-razorpay-event-id': `evt-bad-${suffix}` }, body: webhookBody })
    assert.equal(badSignature.status, 401)
    const signature = createHmac('sha256', 'integration-test-secret').update(webhookBody).digest('hex')
    const goodHeaders = { 'content-type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': `evt-good-${suffix}` }
    const paid = await fetch(`${base}/webhooks/razorpay`, { method: 'POST', headers: goodHeaders, body: webhookBody })
    assert.equal(paid.status, 200)
    const duplicate = await fetch(`${base}/webhooks/razorpay`, { method: 'POST', headers: goodHeaders, body: webhookBody })
    assert.equal(duplicate.status, 200)
    const renewals = await prisma.membership.count({ where: { gymId: gymB.id, renewedFromId: membershipB.id } })
    assert.equal(renewals, 1)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.owner.deleteMany({ where: { id: { in: [ownerA.id, ownerB.id] } } })
    await prisma.$disconnect()
  }
})
