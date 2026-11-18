import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from './db.js'
import { processDueNotifications } from './routes.js'

console.info('Forma reminder worker scheduled for each minute in Asia/Kolkata.')
if (!process.env.DATABASE_URL) {
  console.warn('Reminder worker is idle: set DATABASE_URL before starting scheduled jobs.')
} else {
  await prisma.notification.updateMany({ where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }, data: { status: 'FAILED', scheduledAt: new Date(), errorMessage: 'Recovered after worker restart.' } }).catch(error => console.error('Could not recover stale notifications', error))
  cron.schedule('* * * * *', () => processDueNotifications().catch(error => console.error('Reminder worker failed', error)), { timezone: 'Asia/Kolkata' })
}
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0) })
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0) })
