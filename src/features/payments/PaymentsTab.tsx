import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Plus,
  Receipt,
  Search,
  Wallet,
  X,
} from 'lucide-react'
import {
  api,
  money,
  shortDate,
  type GymDto,
  type MemberDto,
  type PaymentDto,
} from '../../api'
import ReceiptModal from '../../components/common/ReceiptModal'

interface PaymentsTabProps {
  payments: PaymentDto[]
  memberDtos: MemberDto[]
  gym: GymDto
  paymentQuery: string
  onPaymentQueryChange: (q: string) => void
  paymentStatus: string
  onPaymentStatusChange: (s: string) => void
  onOpenOfflinePaymentModal: () => void
  onReload: () => Promise<void>
  onToast: (msg: string) => void
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  payments,
  memberDtos,
  gym,
  paymentQuery,
  onPaymentQueryChange,
  paymentStatus,
  onPaymentStatusChange,
  onOpenOfflinePaymentModal,
  onReload,
  onToast,
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentDto | null>(null)
  const [generatingLink, setGeneratingLink] = useState<string | null>(null)

  // Filter payments
  const filtered = payments.filter(p => {
    const matchesSearch =
      `${p.member.name} ${p.membership.planNameSnapshot} ${p.method}`
        .toLowerCase()
        .includes(paymentQuery.toLowerCase())
    if (!matchesSearch) return false
    if (paymentStatus === 'All') return true
    return p.status === paymentStatus.toUpperCase()
  })

  // Generate Razorpay Link
  const handleGenerateLink = async (payment: PaymentDto) => {
    setGeneratingLink(payment.id)
    try {
      const link = await api<{ id: string; shortUrl: string }>(`/payments/${payment.id}/link`, {
        method: 'POST',
      })
      await onReload()
      // Copy to clipboard
      await navigator.clipboard.writeText(link.shortUrl)
      onToast('Payment link copied to clipboard!')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not create payment link. Ensure Razorpay is configured.')
    } finally {
      setGeneratingLink(null)
    }
  }

  return (
    <div className="payments-page">
      <div className="page-heading">
        <div>
          <h2>Payment Records & Collections</h2>
          <p>Track cash, UPI transfers, pending dues, and issue digital receipts.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onOpenOfflinePaymentModal}
          >
            <Plus size={16} />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="payments-toolbar">
        <div className="search-bar flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by member, plan, or method..."
            value={paymentQuery}
            onChange={e => onPaymentQueryChange(e.target.value)}
          />
        </div>

        <div className="filter-chips-row">
          {['All', 'Paid', 'Pending'].map(status => (
            <button
              key={status}
              type="button"
              className={`filter-chip ${paymentStatus === status ? 'active' : ''}`}
              onClick={() => onPaymentStatusChange(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Payments List */}
      <div className="payments-content-box">
        {filtered.length === 0 ? (
          <div className="empty-state-box">
            <Wallet size={40} className="empty-icon-muted" />
            <h3>No payment records found</h3>
            <p>Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="payments-roster-list">
            {filtered.map(p => {
              const isPaid = p.status === 'PAID'
              return (
                <div key={p.id} className="payment-roster-card">
                  <div className="prc-left">
                    <div className={`payment-avatar-chip ${isPaid ? 'paid' : 'pending'}`}>
                      {isPaid ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="prc-meta">
                      <h4>{p.member.name}</h4>
                      <div className="prc-sub">
                        <span>{p.membership.planNameSnapshot}</span>
                        <span className="dot">·</span>
                        <span>{p.method}</span>
                        <span className="dot">·</span>
                        <span>
                          {p.paymentDate ? shortDate(p.paymentDate) : `Created: ${shortDate(p.createdAt)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="prc-right">
                    <div className="prc-amount-col">
                      <strong className="text-price">{money(p.amountPaise)}</strong>
                      <span className={`status-pill ${isPaid ? 'pill-active' : 'pill-pending'}`}>
                        {p.status}
                      </span>
                    </div>

                    <div className="prc-actions">
                      {isPaid ? (
                        <button
                          type="button"
                          className="button button-secondary text-sm"
                          onClick={() => setSelectedReceipt(p)}
                        >
                          <Receipt size={14} />
                          <span>Receipt</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary text-sm"
                          disabled={generatingLink === p.id}
                          onClick={() => handleGenerateLink(p)}
                        >
                          <CreditCard size={14} />
                          <span>
                            {p.paymentUrl ? 'Copy Link' : 'Generate Link'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          payment={selectedReceipt}
          gym={gym}
          onClose={() => setSelectedReceipt(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

export default PaymentsTab
