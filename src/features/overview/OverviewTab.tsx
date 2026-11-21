import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  MessageCircle,
  Plus,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react'
import {
  money,
  shortDate,
  type DashboardDto,
  type GymDto,
  type MemberDto,
  type PaymentDto,
  type PlanDto,
} from '../../api'
import UpiQrModal from '../../components/common/UpiQrModal'
import ReceiptModal from '../../components/common/ReceiptModal'

interface OverviewTabProps {
  dashboard: DashboardDto | null
  memberDtos: MemberDto[]
  gym: GymDto
  upiId: string
  customTemplate?: string
  plans: PlanDto[]
  onNavigateTab: (tab: string) => void
  onOpenAddMember: () => void
  onOpenImportModal: () => void
  onOpenOfflinePayment: (membershipId: string, memberName: string, planName: string, amountPaise: number) => void
  onToast: (msg: string) => void
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  dashboard,
  memberDtos,
  gym,
  upiId,
  customTemplate,
  plans,
  onNavigateTab,
  onOpenAddMember,
  onOpenImportModal,
  onOpenOfflinePayment,
  onToast,
}) => {
  const [selectedForReminder, setSelectedForReminder] = useState<MemberDto | null>(null)
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<PaymentDto | null>(null)

  const metrics = dashboard?.metrics ?? {
    totalMembers: 0,
    activeMemberships: 0,
    expiredMemberships: 0,
    expiringSoon: 0,
    monthlyRevenuePaise: 0,
    pendingPaymentsPaise: 0,
    pendingPaymentCount: 0,
    newRegistrations: 0,
  }

  // Find member DTO for upcoming expiry
  const handleOpenReminderByName = (memberName: string) => {
    const found = memberDtos.find(m => m.name.toLowerCase() === memberName.toLowerCase())
    if (found) {
      setSelectedForReminder(found)
    } else {
      onNavigateTab('Renewals')
    }
  }

  return (
    <div className="overview-page">
      {/* Welcome & Command Header */}
      <div className="overview-header-banner">
        <div className="ohb-content">
          <h2>Command Center</h2>
          <p>
            Welcome, <strong>{gym.name}</strong>. Here is your daily membership pulse and cash flow.
          </p>
        </div>
        <div className="ohb-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onOpenImportModal}
          >
            <FileSpreadsheet size={15} />
            <span>Import Excel</span>
          </button>
        </div>
      </div>

      {/* UPI Alert if not set */}
      {!upiId && (
        <div className="notice-banner warning">
          <AlertTriangle size={18} />
          <div className="flex-1">
            <strong>Add your UPI ID in Gym Profile</strong>
            <p>To enable 1-click WhatsApp QR reminders for renewals, enter your UPI ID (Google Pay / PhonePe).</p>
          </div>
          <button
            type="button"
            className="button button-secondary text-sm"
            onClick={() => onNavigateTab('Gym profile')}
          >
            Configure UPI
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card" onClick={() => onNavigateTab('Members')}>
          <div className="metric-head">
            <span className="metric-label">ACTIVE MEMBERS</span>
            <span className="metric-icon sage">
              <Users size={18} />
            </span>
          </div>
          <div className="metric-value">{metrics.activeMemberships}</div>
          <div className="metric-sub">
            <span>{metrics.totalMembers} total registered</span>
          </div>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('Renewals')}>
          <div className="metric-head">
            <span className="metric-label">EXPIRING THIS WEEK</span>
            <span className="metric-icon amber">
              <Clock3 size={18} />
            </span>
          </div>
          <div className="metric-value">{metrics.expiringSoon}</div>
          <div className="metric-sub">
            <span className="text-amber">Requires WhatsApp reminders</span>
          </div>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('Renewals')}>
          <div className="metric-head">
            <span className="metric-label">OVERDUE / EXPIRED</span>
            <span className="metric-icon pink">
              <AlertTriangle size={18} />
            </span>
          </div>
          <div className="metric-value">{metrics.expiredMemberships}</div>
          <div className="metric-sub">
            <span className="text-red">Needs payment collection</span>
          </div>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('Payments')}>
          <div className="metric-head">
            <span className="metric-label">MONTHLY REVENUE</span>
            <span className="metric-icon cyan">
              <Wallet size={18} />
            </span>
          </div>
          <div className="metric-value">{money(metrics.monthlyRevenuePaise)}</div>
          <div className="metric-sub">
            <span>Current calendar month</span>
          </div>
        </div>
      </div>

      {/* Operational Grids: Upcoming Renewals + Recent Payments */}
      <div className="overview-operational-grid">
        {/* Renewals Column */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div>
              <h3>Upcoming Renewals</h3>
              <p>Send 1-click WhatsApp reminders with dynamic UPI QR</p>
            </div>
            <button
              type="button"
              className="button-link-accent text-sm"
              onClick={() => onNavigateTab('Renewals')}
            >
              View all <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel-card-content">
            {!dashboard?.expiringList || dashboard.expiringList.length === 0 ? (
              <div className="empty-mini-box">
                <p>No memberships are expiring in the next 7 days.</p>
              </div>
            ) : (
              <div className="expiring-list">
                {dashboard.expiringList.slice(0, 5).map(item => (
                  <div key={item.id} className="expiring-row-card">
                    <div className="erc-info">
                      <strong>{item.member.name}</strong>
                      <span>
                        {item.planNameSnapshot} · Expires {shortDate(item.expiryDate)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="button button-whatsapp-sm"
                      title="Send WhatsApp renewal reminder"
                      onClick={() => handleOpenReminderByName(item.member.name)}
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments Column */}
        <div className="panel-card">
          <div className="panel-card-header">
            <div>
              <h3>Recent Payments</h3>
              <p>Latest dues collected via Cash & UPI</p>
            </div>
            <button
              type="button"
              className="button-link-accent text-sm"
              onClick={() => onNavigateTab('Payments')}
            >
              View all <ArrowRight size={13} />
            </button>
          </div>

          <div className="panel-card-content">
            {!dashboard?.recentPayments || dashboard.recentPayments.length === 0 ? (
              <div className="empty-mini-box">
                <p>No payment records recorded yet.</p>
              </div>
            ) : (
              <div className="recent-payments-list">
                {dashboard.recentPayments.slice(0, 5).map(p => (
                  <div key={p.id} className="payment-row-card">
                    <div className="prc-info">
                      <strong>{p.member.name}</strong>
                      <span>
                        {p.membership.planNameSnapshot} · {p.method}
                      </span>
                    </div>
                    <div className="prc-actions">
                      <span className="prc-amount">{money(p.amountPaise)}</span>
                      <button
                        type="button"
                        className="button-link-accent text-xs"
                        title="View printable receipt"
                        onClick={() => setSelectedReceiptPayment(p)}
                      >
                        <Receipt size={14} /> Slip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp UPI QR Modal */}
      {selectedForReminder && (
        <UpiQrModal
          member={selectedForReminder}
          gymName={gym.name}
          upiId={upiId}
          customTemplate={customTemplate}
          plans={plans}
          onClose={() => setSelectedForReminder(null)}
          onToast={onToast}
        />
      )}

      {/* Digital Receipt Modal */}
      {selectedReceiptPayment && (
        <ReceiptModal
          payment={selectedReceiptPayment}
          gym={gym}
          onClose={() => setSelectedReceiptPayment(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

export default OverviewTab
