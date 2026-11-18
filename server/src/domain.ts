import { DateTime } from 'luxon'

export const APP_TIMEZONE = 'Asia/Kolkata'
export function normalizePhone(input: string) {
  const raw = input.trim()
  const digits = raw.replace(/\D/g, '')
  const e164 = raw.startsWith('+') ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new Error('Enter a valid phone number with country code.')
  return e164
}
export function utcDateOnly(value: string) {
  const parsed = DateTime.fromISO(value, { zone: APP_TIMEZONE })
  if (!parsed.isValid) throw new Error('Enter a valid start date.')
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
}
export function expiryFor(startDate: Date, durationDays: number) {
  const expiry = new Date(startDate)
  expiry.setUTCDate(expiry.getUTCDate() + durationDays - 1)
  return expiry
}
export function reminderTimeFor(expiryDate: Date) {
  return DateTime.fromJSDate(expiryDate, { zone: 'utc' }).setZone(APP_TIMEZONE).minus({ days: 2 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toJSDate()
}
export function paiseFromRupees(amount: number) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount * 100)) throw new Error('Enter an amount with up to two decimal places.')
  return Math.round(amount * 100)
}
export function rupeesFromPaise(amount: number) { return amount / 100 }
