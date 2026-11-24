import express, { type ErrorRequestHandler } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { resolve } from 'node:path'
import { prisma } from './db.js'
import { apiRouter, razorpayWebhook } from './routes.js'
import { requireOwner } from './security.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
const allowedOrigins = new Set((process.env.WEB_ORIGIN ?? `${process.env.RENDER_EXTERNAL_URL ?? ''},http://localhost:5173`).split(',').map(origin => origin.trim()).filter(Boolean))
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }))
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.get('/api/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' })
  }
})
app.use(['/api/auth/login', '/api/auth/register'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api', apiRouter)
if (process.env.NODE_ENV === 'production') {
  const frontendDirectory = resolve(process.cwd(), 'dist')
  app.use(express.static(frontendDirectory))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(resolve(frontendDirectory, 'index.html'))
  })
}
app.use((_req, res) => res.status(404).json({ error: 'This API route does not exist.' }))
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error?.name === 'ZodError') return res.status(400).json({ error: 'Please check the submitted information.', fields: error.issues })
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' })
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' })
  console.error(error)
  if (res.headersSent) return
  res.status(500).json({ error: 'An unexpected server error occurred.' })
}
app.use(errorHandler)
