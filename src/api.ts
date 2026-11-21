export type OwnerDto = { id: string; name: string; email: string; phone: string }
export type GymDto = { id: string; name: string; address: string; phone: string; timezone: string }
export type PlanDto = { id: string; name: string; durationDays: number; pricePaise: number; description?: string | null; isActive: boolean; _count?: { memberships: number } }
export type MemberDto = {
  id: string
  name: string
  phone: string
  email: string | null
  createdAt: string
  memberships: Array<{
    id: string
    planNameSnapshot: string
    startDate: string
    expiryDate: string
    status: string
    amountPaise: number
    payments: Array<{ id: string; status: string; method: string; amountPaise: number }>
  }>
}
export type PaymentDto = {
  id: string
  amountPaise: number
  status: string
  method: string
  paymentDate: string | null
  createdAt: string
  transactionReference: string | null
  paymentUrl?: string | null
  member: { name: string; phone: string }
  membership: { planNameSnapshot: string }
}
export type DashboardDto = {
  metrics: {
    totalMembers: number
    activeMemberships: number
    expiredMemberships: number
    expiringSoon: number
    monthlyRevenuePaise: number
    pendingPaymentsPaise: number
    pendingPaymentCount: number
    newRegistrations: number
  }
  recentMembers: MemberDto[]
  recentPayments: Array<PaymentDto>
  expiringList: Array<{ id: string; expiryDate: string; planNameSnapshot: string; member: { name: string } }>
}

export type IntegrationDto = {
  razorpayConfigured: boolean
  whatsappConfigured: boolean
  upiId: string
  renewalTemplate: string
  whatsappPhoneNumberId: string
  whatsappBusinessAccountId: string
  whatsappTemplateName: string
  whatsappTemplateLanguage: string
}

export type BulkImportMember = {
  name: string
  phone: string
  email?: string
  planName?: string
  startDate?: string
  paymentStatus?: 'PAID' | 'PENDING'
  paymentMethod?: 'CASH' | 'UPI_OFFLINE' | 'BANK_TRANSFER'
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`)
  return data as T
}

export const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

export const shortDate = (value: string | Date) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value))

export const DEFAULT_RENEWAL_TEMPLATE = `Hi {name}! 👋
This is a gentle reminder from {gymName}.
Your {planName} membership expires on {expiryDate}.

Total Renewal: ₹{amount}
Pay instantly via UPI: {upiId}
Direct payment link: {upiLink}

Please share the payment screenshot once done. Keep training strong! 💪`

export function generateUpiUrl(params: {
  upiId: string
  payeeName: string
  amountRupees: number
  transactionNote?: string
}): string {
  const vpa = params.upiId.trim()
  if (!vpa) return ''
  const pn = encodeURIComponent(params.payeeName.trim() || 'Gym Membership')
  const am = params.amountRupees > 0 ? params.amountRupees.toFixed(2) : ''
  const tn = encodeURIComponent(params.transactionNote || 'Membership Renewal')
  return `upi://pay?pa=${vpa}&pn=${pn}${am ? `&am=${am}` : ''}&cu=INR&tn=${tn}`
}

export function formatRenewalMessage(params: {
  template?: string
  name: string
  gymName: string
  planName: string
  expiryDate: string
  amountRupees: number
  upiId: string
  upiLink: string
}): string {
  const tpl = (params.template?.trim() || DEFAULT_RENEWAL_TEMPLATE)
  return tpl
    .replace(/\{name\}/g, params.name)
    .replace(/\{gymName\}/g, params.gymName)
    .replace(/\{planName\}/g, params.planName)
    .replace(/\{expiryDate\}/g, params.expiryDate)
    .replace(/\{amount\}/g, params.amountRupees.toString())
    .replace(/\{upiId\}/g, params.upiId || 'Contact front desk')
    .replace(/\{upiLink\}/g, params.upiLink || '')
}
