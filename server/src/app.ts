import express, { type ErrorRequestHandler } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { resolve } from 'node:path'
import { apiRouter, razorpayWebhook } from './routes.js'
import { requireOwner } from './security.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
app.use(cors({ origin: process.env.WEB_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173', credentials: true }))
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false }))
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
  console.error(error)
  if (res.headersSent) return
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : String(error?.message ?? 'Unexpected server error') })
}
app.use(errorHandler)
