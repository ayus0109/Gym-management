import test from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from 'luxon'
import { expiryFor, normalizePhone, paiseFromRupees, reminderTimeFor } from './domain.js'

test('membership expiry is inclusive of its first day', () => {
  const start = new Date(Date.UTC(2026, 10, 1))
  assert.equal(expiryFor(start, 30).toISOString().slice(0, 10), '2026-11-30')
})

test('renewal reminder is scheduled at 10am India time two calendar days before expiry', () => {
  const expiry = new Date(Date.UTC(2026, 10, 30))
  const reminder = DateTime.fromJSDate(reminderTimeFor(expiry), { zone: 'utc' }).setZone('Asia/Kolkata')
  assert.equal(reminder.toFormat('yyyy-MM-dd HH:mm'), '2026-11-28 10:00')
})

test('phone numbers are normalized to E.164 for WhatsApp', () => {
  assert.equal(normalizePhone('98765 43210'), '+919876543210')
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958')
})

test('money is stored in integer paise', () => {
  assert.equal(paiseFromRupees(2700), 270000)
  assert.equal(paiseFromRupees(27.5), 2750)
  assert.throws(() => paiseFromRupees(-1))
})
