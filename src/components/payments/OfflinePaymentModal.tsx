import ModalBackdrop from '../common/ModalBackdrop'
import React, { useState, type FormEvent } from 'react'
import { Check, CreditCard, X } from 'lucide-react'
import { money, type MemberDto } from '../../api'

interface OfflinePaymentModalProps {
  members: MemberDto[]
  preselectedMembershipId?: string
  preselectedMemberName?: string
  preselectedPlanName?: string
  preselectedAmountPaise?: number
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const OfflinePaymentModal: React.FC<OfflinePaymentModalProps> = ({
  members,
  preselectedMembershipId,
  preselectedMemberName,
  preselectedPlanName,
  preselectedAmountPaise,
  onClose,
  onSubmit,
}) => {
  // Find all pending dues
  const dues = members.flatMap(member =>
    member.memberships
      .filter(membership => membership.status === 'PENDING_PAYMENT')
      .map(membership => ({ member, membership }))
  )

  const defaultId = preselectedMembershipId || dues[0]?.membership.id || ''
  const [selectedId, setSelectedId] = useState(defaultId)
  const currentDue = dues.find(item => item.membership.id === selectedId)

  const balance = currentDue?.membership.payments.find(payment => payment.status === 'PENDING')?.amountPaise
  const defaultAmount = balance !== undefined ? balance / 100 : preselectedAmountPaise
    ? preselectedAmountPaise / 100
    : currentDue
    ? currentDue.membership.amountPaise / 100
    : undefined

  return (
    <ModalBackdrop label="Record payment" onClose={onClose} dismissOutside>
      <form className="modal" onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <span className="modal-icon">
              <CreditCard size={19} />
            </span>
            <h2>Record Offline Payment</h2>
            <p>Log direct cash, UPI transfer, or reception payments.</p>
          </div>
          <button type="button" aria-label="Close dialog" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {preselectedMembershipId ? (
          <div className="preselected-due-box">
            <span className="due-label">MEMBER & PLAN</span>
            <h4>{preselectedMemberName}</h4>
            <span>{preselectedPlanName}</span>
            <input name="membershipId" type="hidden" value={preselectedMembershipId} />
          </div>
        ) : dues.length ? (
          <label className="field-label">
            <span>Member with Pending Dues *</span>
            <select
              name="membershipId"
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
            >
              {dues.map(item => (
                <option value={item.membership.id} key={item.membership.id}>
                  {item.member.name} â€” {item.membership.planNameSnapshot} ({money(item.membership.amountPaise)})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field-label">
            <span>Select Member *</span>
            <select name="membershipId" required>
              {members.map(m => {
                const ms = m.memberships[0]
                if (!ms) return null
                return (
                  <option value={ms.id} key={ms.id}>
                    {m.name} â€” {ms.planNameSnapshot} ({money(ms.amountPaise)})
                  </option>
                )
              })}
            </select>
          </label>
        )}

        <label className="field-label">
          <span>Amount Collected (â‚¹ INR) *</span>
          <input
            key={selectedId}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={defaultAmount}
          />
        </label>

        <label className="field-label">
          <span>Payment Mode *</span>
          <select name="method">
            <option value="CASH">Physical Cash at Reception</option>
            <option value="UPI_OFFLINE">UPI QR / PhonePe / Google Pay</option>
            <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT/IMPS)</option>
          </select>
        </label>

        <label className="field-label">
          <span>Reference / Notes (Optional)</span>
          <input
            name="reference"
            placeholder="e.g. UTR #123456 or Cash Slip #42"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            <Check size={16} />
            <span>Confirm Payment</span>
          </button>
        </div>
      </form>
    </ModalBackdrop>
  )
}

export default OfflinePaymentModal
