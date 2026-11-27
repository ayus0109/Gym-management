import ModalBackdrop from './ModalBackdrop'
import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Download, MessageCircle, Send, Sparkles, X, ExternalLink } from 'lucide-react'
import {
  formatRenewalMessage,
  generateUpiUrl,
  type MemberDto,
  type PlanDto
} from '../../api'

interface UpiQrModalProps {
  member: MemberDto
  gymName: string
  upiId: string
  customTemplate?: string
  plans: PlanDto[]
  onClose: () => void
  onToast: (msg: string) => void
}

export const UpiQrModal: React.FC<UpiQrModalProps> = ({
  member,
  gymName,
  upiId,
  customTemplate,
  plans,
  onClose,
  onToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [copiedText, setCopiedText] = useState(false)
  const [copiedQr, setCopiedQr] = useState(false)
  const [customAmount, setCustomAmount] = useState<number>(0)
  const [selectedPlanName, setSelectedPlanName] = useState('')
  const [customNote, setCustomNote] = useState('')

  const activeMembership = member.memberships[0]
  const amountPaise = activeMembership?.amountPaise ?? 0
  const defaultAmountRupees = amountPaise / 100

  useEffect(() => {
    setCustomAmount(defaultAmountRupees)
    setSelectedPlanName(activeMembership?.planNameSnapshot ?? 'Gym Membership')
  }, [member])

  const effectiveAmount = Math.max(0, customAmount)

  const upiUrl = effectiveAmount > 0 ? generateUpiUrl({
    upiId,
    payeeName: gymName || 'Gym Front Desk',
    amountRupees: effectiveAmount,
    transactionNote: customNote || `${selectedPlanName} Renewal`,
  }) : ''

  // Format date
  const expiryStr = activeMembership
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(activeMembership.expiryDate))
    : 'Upcoming'

  const messageText = formatRenewalMessage({
    template: customTemplate,
    name: member.name,
    gymName: gymName || 'Our Gym',
    planName: selectedPlanName,
    expiryDate: expiryStr,
    amountRupees: effectiveAmount,
    upiId: upiId || '(Add UPI ID in Gym Profile)',
    upiLink: upiUrl,
  })

  // Render QR Code onto canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !upiUrl) return
    let active = true
    void import('qrcode').then(({ default: QRCode }) => {
      if (!active) return
      return QRCode.toCanvas(canvas, upiUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
    }).catch(() => onToast('Could not generate the QR code.'))
    return () => { active = false }
  }, [upiUrl])

  // Copy QR Image to clipboard
  const handleCopyQrImage = async () => {
    if (!canvasRef.current) return
    try {
      canvasRef.current.toBlob(async blob => {
        if (!blob) return
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ])
          setCopiedQr(true)
          onToast('QR image copied to clipboard! Paste it into WhatsApp.')
          setTimeout(() => setCopiedQr(false), 2500)
        } catch {
          // Fallback download if clipboard image copy not supported in browser
          handleDownloadQr()
        }
      })
    } catch {
      handleDownloadQr()
    }
  }

  // Download QR code image
  const handleDownloadQr = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `${member.name.replace(/\s+/g, '_')}_UPI_QR.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
    onToast('QR Code downloaded!')
  }

  // Copy message text
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText)
      setCopiedText(true)
      onToast('Message copied to clipboard!')
      setTimeout(() => setCopiedText(false), 2500)
    } catch {
      onToast('Could not copy text to clipboard.')
    }
  }

  // Open WhatsApp Web / App
  const handleOpenWhatsApp = () => {
    const rawDigits = member.phone.replace(/\D/g, '')
    const phone = rawDigits.startsWith('91') && rawDigits.length === 12
      ? rawDigits
      : rawDigits.length === 10
      ? `91${rawDigits}`
      : rawDigits
    const encoded = encodeURIComponent(messageText)
    const url = `https://wa.me/${phone}?text=${encoded}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <ModalBackdrop label="Renewal reminder" onClose={onClose}>
      <div className="modal-card upi-qr-modal">
        <div className="modal-header">
          <div>
            <h3>Send WhatsApp Renewal Reminder</h3>
            <p>Review the amount and message before opening WhatsApp.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body upi-qr-body">
          {/* Member & Amount Details */}
          <div className="upi-qr-meta-row">
            <div className="qr-member-pill">
              <span className="qr-member-label">MEMBER</span>
              <strong>{member.name}</strong>
              <span>{member.phone}</span>
            </div>
            <div className="qr-amount-pill">
              <span className="qr-member-label">RENEWAL AMOUNT (₹)</span>
              <input
                type="number"
                aria-label="Renewal amount in rupees" step="0.01" min="0"
                value={customAmount}
                onChange={e => setCustomAmount(Number(e.target.value) || 0)}
                className="input-inline-amount"
              />
            </div>
          </div>

          {!upiId && (
            <div className="upi-warning-banner">
              <AlertTriangle size={15} />
              <span>
                <strong>No UPI ID configured.</strong> Please add your UPI ID (e.g. <code>fitzone@okaxis</code>) in <strong>Gym profile</strong> so members can pay you directly.
              </span>
            </div>
          )}

          {/* QR Code & Preview Grid */}
          <div className="upi-qr-grid">
            <div className="qr-canvas-box">
              <div className="qr-frame">
                {upiUrl && <canvas ref={canvasRef} aria-label="Membership payment QR code" />}
              </div>
              <span className="qr-payee-tag">{upiId || 'No UPI ID Set'}</span>
              <div className="qr-action-buttons">
                <button
                  type="button"
                  className="button button-secondary qr-btn"
                  disabled={!upiUrl} onClick={handleCopyQrImage}
                >
                  {copiedQr ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedQr ? 'Copied QR!' : 'Copy QR'}</span>
                </button>
                <button
                  type="button"
                  className="button button-secondary qr-btn"
                  disabled={!upiUrl} onClick={handleDownloadQr}
                >
                  <Download size={14} />
                  <span>Save</span>
                </button>
              </div>
            </div>

            <div className="qr-message-preview-box">
              <div className="preview-label-row">
                <span>PRE-FILLED WHATSAPP MESSAGE</span>
                <button
                  type="button"
                  className="button-link-accent text-sm"
                  onClick={handleCopyText}
                >
                  {copiedText ? <Check size={13} /> : <Copy size={13} />}
                  {copiedText ? 'Copied' : 'Copy Text'}
                </button>
              </div>
              <textarea aria-label="Renewal message preview"
                readOnly
                value={messageText}
                className="qr-message-textarea"
                rows={7}
              />
              <span className="preview-hint">
                <Sparkles size={13} />
                <span>Tip: Click <strong>Open WhatsApp</strong>, then paste (Ctrl+V) the QR code if you want to attach it to the chat.</span>
              </span>
            </div>
          </div>
        </div>

        <div className="modal-actions upi-qr-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-whatsapp"
            onClick={handleOpenWhatsApp}
          >
            <MessageCircle size={17} />
            <span>Open WhatsApp with Message</span>
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default UpiQrModal
