import { prisma } from './db.js'
import { decryptSecret } from './security.js'

type MemberForMessage = { name: string; phone: string; email?: string | null }
export async function createRazorpayPaymentLink(gymId: string, paymentId: string, member: MemberForMessage, gymName: string, amountPaise: number) {
  const config = await prisma.integrationSettings.findUnique({ where: { gymId } })
  if (!config?.razorpayKeyIdEncrypted || !config.razorpaySecretEncrypted) throw new Error('This gym has not connected its Razorpay account.')
  const key = decryptSecret(config.razorpayKeyIdEncrypted)
  const secret = decryptSecret(config.razorpaySecretEncrypted)
  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', accept_partial: false, reference_id: paymentId.slice(0, 40), description: `${gymName} membership renewal`, customer: { name: member.name, email: member.email ?? undefined, contact: member.phone }, notify: { sms: false, email: false }, reminder_enable: false }),
    signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json() as { id?: string; short_url?: string; error?: { description?: string } }
  if (!response.ok || !payload.id || !payload.short_url) throw new Error(payload.error?.description ?? `Razorpay returned ${response.status}.`)
  return { id: payload.id, shortUrl: payload.short_url }
}

export async function sendRenewalTemplate(gymId: string, member: MemberForMessage, gymName: string, expiryDate: string, paymentLink: string) {
  const config = await prisma.integrationSettings.findUnique({ where: { gymId } })
  if (!config?.whatsappTokenEncrypted || !config.whatsappPhoneNumberId || !config.whatsappTemplateName) throw new Error('WhatsApp is not connected or its approved renewal template is not configured.')
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v27.0'
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${config.whatsappPhoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${decryptSecret(config.whatsappTokenEncrypted)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: member.phone.replace(/^\+/, ''), type: 'template', template: { name: config.whatsappTemplateName, language: { code: config.whatsappTemplateLanguage }, components: [{ type: 'body', parameters: [{ type: 'text', text: member.name }, { type: 'text', text: gymName }, { type: 'text', text: expiryDate }, { type: 'text', text: paymentLink }] }] } }),
    signal: AbortSignal.timeout(15000),
  })
  const payload = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } }
  if (!response.ok || !payload.messages?.[0]?.id) throw new Error(payload.error?.message ?? `WhatsApp returned ${response.status}.`)
  return { messageId: payload.messages[0].id }
}
