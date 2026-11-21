import React, { useRef, useState } from 'react'
import { Check, Copy, Download, MessageCircle, Printer, X } from 'lucide-react'
import { money, shortDate, type GymDto, type PaymentDto } from '../../api'

interface ReceiptModalProps {
  payment: PaymentDto
  gym: GymDto
  onClose: () => void
  onToast: (msg: string) => void
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  payment,
  gym,
  onClose,
  onToast,
}) => {
  const [copiedText, setCopiedText] = useState(false)
  const receiptRef = useRef<HTMLDivElement | null>(null)

  const receiptId = `RCP-${payment.id.slice(-6).toUpperCase()}`
  const dateStr = payment.paymentDate ? shortDate(payment.paymentDate) : shortDate(payment.createdAt)

  const receiptText = `🧾 *PAYMENT RECEIPT*
${gym.name}
${gym.address || ''} · Tel: ${gym.phone}
----------------------------------------
Receipt No : ${receiptId}
Date       : ${dateStr}
Member     : ${payment.member.name}
Phone      : ${payment.member.phone}
Plan       : ${payment.membership.planNameSnapshot}
----------------------------------------
Amount     : ${money(payment.amountPaise)}
Method     : ${payment.method}
Status     : PAID ✅
Ref No     : ${payment.transactionReference || 'N/A'}
----------------------------------------
Thank you for your payment! Keep training strong! 💪`

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptText)
      setCopiedText(true)
      onToast('Receipt text copied! Paste it in WhatsApp.')
      setTimeout(() => setCopiedText(false), 2500)
    } catch {
      onToast('Could not copy receipt.')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShareWhatsApp = () => {
    const rawDigits = payment.member.phone.replace(/\D/g, '')
    const phone = rawDigits.startsWith('91') && rawDigits.length === 12
      ? rawDigits
      : rawDigits.length === 10
      ? `91${rawDigits}`
      : rawDigits
    const encoded = encodeURIComponent(receiptText)
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card receipt-modal">
        <div className="modal-header">
          <div>
            <h3>Payment Receipt</h3>
            <p>Official payment confirmation slip</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Printable Thermal Receipt Card */}
          <div ref={receiptRef} className="thermal-receipt-card printable-slip">
            <div className="receipt-header">
              <span className="receipt-brand">{gym.name}</span>
              <span className="receipt-sub">{gym.address}</span>
              <span className="receipt-sub">Ph: {gym.phone}</span>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-meta-grid">
              <div>
                <span className="meta-label">RECEIPT NO</span>
                <strong>{receiptId}</strong>
              </div>
              <div>
                <span className="meta-label">DATE</span>
                <strong>{dateStr}</strong>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-member-section">
              <div className="receipt-row">
                <span>Member Name</span>
                <strong>{payment.member.name}</strong>
              </div>
              <div className="receipt-row">
                <span>Phone</span>
                <span>{payment.member.phone}</span>
              </div>
              <div className="receipt-row">
                <span>Plan / Membership</span>
                <strong>{payment.membership.planNameSnapshot}</strong>
              </div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-amount-section">
              <div className="receipt-row total-row">
                <span>Total Amount Paid</span>
                <span className="receipt-price">{money(payment.amountPaise)}</span>
              </div>
              <div className="receipt-row">
                <span>Payment Method</span>
                <span>{payment.method}</span>
              </div>
              {payment.transactionReference && (
                <div className="receipt-row">
                  <span>Transaction Ref</span>
                  <span className="font-mono">{payment.transactionReference}</span>
                </div>
              )}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-footer">
              <span className="receipt-paid-stamp">PAID</span>
              <p>Thank you for training with us!</p>
            </div>
          </div>
        </div>

        <div className="modal-actions receipt-actions">
          <button type="button" className="button button-secondary" onClick={handlePrint}>
            <Printer size={15} /> Print Slip
          </button>
          <button type="button" className="button button-secondary" onClick={handleCopyText}>
            {copiedText ? <Check size={15} /> : <Copy size={15} />}
            {copiedText ? 'Copied' : 'Copy Text'}
          </button>
          <button type="button" className="button button-whatsapp" onClick={handleShareWhatsApp}>
            <MessageCircle size={15} /> Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReceiptModal
