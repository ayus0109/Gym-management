import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { CookieOptions, Request, Response, NextFunction } from 'express'
import { prisma } from './db.js'

export const SESSION_COOKIE = 'forma_session'
export const SESSION_DAYS = 365
const cookieOptions: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 }
export function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
export function setSessionCookie(res: Response, token: string) { res.cookie(SESSION_COOKIE, token, cookieOptions) }
export function clearSessionCookie(res: Response) { res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined }) }
export type AuthenticatedRequest = Request & { ownerId?: string; gymId?: string }

export async function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined
    if (!token) return res.status(401).json({ error: 'Please sign in to continue.' })
    const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, select: { ownerId: true, expiresAt: true } })
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } })
      clearSessionCookie(res)
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
    const gym = await prisma.gym.findUnique({ where: { ownerId: session.ownerId }, select: { id: true } })
    req.ownerId = session.ownerId
    req.gymId = gym?.id
    next()
  } catch (error) { next(error) }
}

export function requireGym(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.gymId) return res.status(409).json({ error: 'Complete gym setup before using this page.' })
  next()
}

function encryptionKey() {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not configured.')
  const bytes = Buffer.from(key, 'base64')
  if (bytes.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.')
  return bytes
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`
}
export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
