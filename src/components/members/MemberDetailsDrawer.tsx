import React from 'react'
import { CheckCheck, Clock, CreditCard, MessageCircle, Phone, UserRound, X } from 'lucide-react'
import { money, shortDate, type MemberDto, type PlanDto } from '../../api'

interface MemberDetailsDrawerProps {
  member: MemberDto
  gymName: string
  upiId: string
  customTemplate?: string
  plans: PlanDto[]
  onOpenReminder: (m: MemberDto) => void
  onClose: () => void
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
  member,
  gymName,
  upiId,
  customTemplate,
  plans,
  onOpenReminder,
  onClose,
}) => {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal member-details">
        <div className="modal-head">
          <div>
            <span className="modal-icon">
              <UserRound size={19} />
            </span>
            <h2>{member.name}</h2>
            <p>
              {member.phone} · {member.email ?? 'No email on file'}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="member-details-quick-actions">
          <a href={`tel:${member.phone}`} className="button button-secondary text-sm">
            <Phone size={14} /> Call Member
          </a>
          <button
            type="button"
            className="button button-whatsapp text-sm"
            onClick={() => onOpenReminder(member)}
          >
            <MessageCircle size={14} /> Send WhatsApp Reminder
          </button>
        </div>

        <h3 className="section-subhead">Membership & Payment History</h3>
        {member.memberships.length ? (
          <div className="history-list">
            {member.memberships.map(membership => (
              <div className="history-card" key={membership.id}>
                <div className="history-main-row">
                  <div>
                    <strong>{membership.planNameSnapshot}</strong>
                    <span className="history-dates">
                      {shortDate(membership.startDate)} – {shortDate(membership.expiryDate)}
                    </span>
                  </div>
                  <span className={`pill-status ${membership.status === 'ACTIVE' ? 'active' : 'pending'}`}>
                    {membership.status}
                  </span>
                </div>

                <div className="history-amount-row">
                  <span>Plan Value:</span>
                  <strong>{money(membership.amountPaise)}</strong>
                </div>

                {membership.payments.length > 0 && (
                  <div className="history-payments">
                    {membership.payments.map(payment => (
                      <div key={payment.id} className="payment-mini-tag">
                        <span>{payment.status}</span>
                        <span>·</span>
                        <span>{payment.method}</span>
                        <span>·</span>
                        <span>{money(payment.amountPaise)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-history">No past memberships recorded for this member.</p>
        )}
      </section>
    </div>
  )
}

export default MemberDetailsDrawer
