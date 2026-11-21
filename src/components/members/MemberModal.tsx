import React, { useState, type FormEvent } from 'react'
import { CalendarDays, Check, Plus, UserRound, X } from 'lucide-react'
import { money, shortDate, type PlanDto } from '../../api'
import type { MemberView } from '../../features/members/MembersTab'

interface MemberModalProps {
  plans: PlanDto[]
  member: MemberView | null
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const MemberModal: React.FC<MemberModalProps> = ({
  plans,
  member,
  onClose,
  onSubmit,
}) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [planId, setPlanId] = useState(plans[0]?.id ?? '')
  const selectedPlan = plans.find(plan => plan.id === planId)

  const expiry = selectedPlan
    ? (() => {
        const date = new Date(`${today}T00:00:00Z`)
        date.setUTCDate(date.getUTCDate() + selectedPlan.durationDays - 1)
        return shortDate(date)
      })()
    : 'Select a plan'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form className="modal" onSubmit={onSubmit}>
        <div className="modal-head">
          <div>
            <span className="modal-icon">
              <UserRound size={19} />
            </span>
            <h2>{member ? 'Update Member Profile' : 'Register New Member'}</h2>
            <p>
              {member
                ? 'Modify member contact details.'
                : 'Enroll a new member with their initial membership plan.'}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="field-label">
          <span>Full Name *</span>
          <input
            name="name"
            required
            defaultValue={member?.name}
            placeholder="e.g. Rahul Verma"
            autoFocus
          />
        </label>

        <div className="form-grid">
          <label className="field-label">
            <span>Contact Number *</span>
            <input
              name="phone"
              required
              defaultValue={member?.phone}
              placeholder="+91 98765 43210"
            />
          </label>
          <label className="field-label">
            <span>Email (Optional)</span>
            <input
              name="email"
              type="email"
              defaultValue={member?.email === 'No email added' ? '' : member?.email}
              placeholder="rahul@example.com"
            />
          </label>
        </div>

        {!member && (
          <>
            <label className="field-label">
              <span>Membership Tier *</span>
              <select
                name="planId"
                required
                value={planId}
                onChange={event => setPlanId(event.target.value)}
              >
                {plans.map(plan => (
                  <option value={plan.id} key={plan.id}>
                    {plan.name} — {money(plan.pricePaise)} ({plan.durationDays} Days)
                  </option>
                ))}
              </select>
            </label>

            <input name="startDate" type="hidden" value={today} />

            <div className="expiry-preview">
              <CalendarDays size={16} />
              <span>
                Begins today · Active until <strong>{expiry}</strong>
              </span>
              <Check size={15} />
            </div>

            <div className="form-grid">
              <label className="field-label">
                <span>Initial Payment Status</span>
                <select name="paymentStatus">
                  <option value="PAID">Paid in full (Cash / UPI)</option>
                  <option value="PENDING">Payment Pending</option>
                </select>
              </label>

              <label className="field-label">
                <span>Payment Method</span>
                <select name="paymentMethod">
                  <option value="UPI_OFFLINE">UPI QR / PhonePe / GPay</option>
                  <option value="CASH">Cash at Desk</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                </select>
              </label>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary">
            <Plus size={16} />
            <span>{member ? 'Save Changes' : 'Register Member'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

export default MemberModal
