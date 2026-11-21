import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Flame,
  MessageCircle,
  Phone,
  Search,
  Zap,
} from 'lucide-react'
import { money, shortDate, type MemberDto, type PlanDto } from '../../api'
import UpiQrModal from '../../components/common/UpiQrModal'

interface RenewalsTabProps {
  memberDtos: MemberDto[]
  gymName: string
  upiId: string
  customTemplate?: string
  plans: PlanDto[]
  onOpenOfflinePayment: (membershipId: string, memberName: string, planName: string, amountPaise: number) => void
  onToast: (msg: string) => void
}

export const RenewalsTab: React.FC<RenewalsTabProps> = ({
  memberDtos,
  gymName,
  upiId,
  customTemplate,
  plans,
  onOpenOfflinePayment,
  onToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | '3days' | '7days'>('all')
  const [search, setSearch] = useState('')
  const [selectedForReminder, setSelectedForReminder] = useState<MemberDto | null>(null)

  // Categorize members by renewal urgency
  const categorized = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()
    const oneDayMs = 86400000

    const list: Array<{
      member: MemberDto
      daysRemaining: number
      category: 'overdue' | 'today' | '3days' | '7days' | 'active'
      expiryDate: Date
      amountPaise: number
      planName: string
      membershipId: string
    }> = []

    for (const m of memberDtos) {
      const activeMembership = m.memberships[0]
      if (!activeMembership) continue

      const expiry = new Date(activeMembership.expiryDate)
      expiry.setHours(0, 0, 0, 0)
      const diffDays = Math.round((expiry.getTime() - todayTime) / oneDayMs)

      let category: 'overdue' | 'today' | '3days' | '7days' | 'active' = 'active'
      if (diffDays < 0) category = 'overdue'
      else if (diffDays === 0) category = 'today'
      else if (diffDays <= 3) category = '3days'
      else if (diffDays <= 7) category = '7days'

      // Only include if expiring soon (within 7 days) or already overdue
      if (diffDays <= 7) {
        list.push({
          member: m,
          daysRemaining: diffDays,
          category,
          expiryDate: expiry,
          amountPaise: activeMembership.amountPaise,
          planName: activeMembership.planNameSnapshot,
          membershipId: activeMembership.id,
        })
      }
    }

    // Sort: overdue first, then today, 3 days, 7 days
    return list.sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [memberDtos])

  // Filtered list
  const filtered = useMemo(() => {
    return categorized.filter(item => {
      const matchesSearch =
        item.member.name.toLowerCase().includes(search.toLowerCase()) ||
        item.member.phone.includes(search)
      if (!matchesSearch) return false

      if (filter === 'all') return true
      return item.category === filter
    })
  }, [categorized, search, filter])

  const counts = useMemo(() => {
    return {
      all: categorized.length,
      overdue: categorized.filter(c => c.category === 'overdue').length,
      today: categorized.filter(c => c.category === 'today').length,
      '3days': categorized.filter(c => c.category === '3days').length,
      '7days': categorized.filter(c => c.category === '7days').length,
    }
  }, [categorized])

  return (
    <div className="renewals-page">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <h2>Renewal Radar</h2>
          <p>Upcoming and overdue memberships needing collection or reminders.</p>
        </div>
      </div>

      {/* UPI Notice */}
      {!upiId && (
        <div className="notice-banner warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Set up your UPI ID in Gym Profile</strong>
            <p>Add your Google Pay/PhonePe UPI ID so your dynamic QR code and 1-tap links work automatically.</p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="renewals-toolbar">
        <div className="filter-chips-scroll">
          <button
            type="button"
            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Due ({counts.all})
          </button>
          <button
            type="button"
            className={`filter-chip chip-red ${filter === 'overdue' ? 'active' : ''}`}
            onClick={() => setFilter('overdue')}
          >
            🔴 Overdue ({counts.overdue})
          </button>
          <button
            type="button"
            className={`filter-chip chip-amber ${filter === 'today' ? 'active' : ''}`}
            onClick={() => setFilter('today')}
          >
            ⚠️ Expiring Today ({counts.today})
          </button>
          <button
            type="button"
            className={`filter-chip chip-orange ${filter === '3days' ? 'active' : ''}`}
            onClick={() => setFilter('3days')}
          >
            🕒 In 3 Days ({counts['3days']})
          </button>
          <button
            type="button"
            className={`filter-chip chip-blue ${filter === '7days' ? 'active' : ''}`}
            onClick={() => setFilter('7days')}
          >
            📅 This Week ({counts['7days']})
          </button>
        </div>

        <div className="search-bar search-compact">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search member or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <div className="empty-state-box">
          <CheckCircle2 size={42} className="empty-icon-green" />
          <h3>All memberships are on track!</h3>
          <p>No memberships are expiring or overdue in this filter category.</p>
        </div>
      ) : (
        <div className="renewals-cards-grid">
          {filtered.map(item => {
            const isOverdue = item.daysRemaining < 0
            const isToday = item.daysRemaining === 0
            const badgeClass = isOverdue
              ? 'badge-overdue'
              : isToday
              ? 'badge-today'
              : 'badge-soon'

            const statusLabel = isOverdue
              ? `Expired ${Math.abs(item.daysRemaining)} days ago`
              : isToday
              ? 'Expires Today'
              : `Expires in ${item.daysRemaining} days`

            return (
              <div key={item.member.id} className="renewal-card">
                <div className="renewal-card-top">
                  <div className="member-avatar-chip">
                    {item.member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="renewal-member-meta">
                    <h4>{item.member.name}</h4>
                    <span className="member-phone-sub">
                      <Phone size={12} /> {item.member.phone}
                    </span>
                  </div>
                  <span className={`renewal-status-pill ${badgeClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="renewal-card-body">
                  <div className="renewal-row">
                    <span>Plan:</span>
                    <strong>{item.planName}</strong>
                  </div>
                  <div className="renewal-row">
                    <span>Expiry Date:</span>
                    <span>{shortDate(item.expiryDate)}</span>
                  </div>
                  <div className="renewal-row renewal-highlight">
                    <span>Renewal Amount:</span>
                    <strong className="text-price">{money(item.amountPaise)}</strong>
                  </div>
                </div>

                <div className="renewal-card-actions">
                  <button
                    type="button"
                    className="button button-whatsapp flex-1"
                    onClick={() => setSelectedForReminder(item.member)}
                  >
                    <MessageCircle size={15} />
                    <span>WhatsApp Reminder</span>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    title="Record offline payment"
                    onClick={() =>
                      onOpenOfflinePayment(
                        item.membershipId,
                        item.member.name,
                        item.planName,
                        item.amountPaise
                      )
                    }
                  >
                    <CreditCard size={15} />
                    <span>Pay</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* WhatsApp UPI QR Modal */}
      {selectedForReminder && (
        <UpiQrModal
          member={selectedForReminder}
          gymName={gymName}
          upiId={upiId}
          customTemplate={customTemplate}
          plans={plans}
          onClose={() => setSelectedForReminder(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

export default RenewalsTab
