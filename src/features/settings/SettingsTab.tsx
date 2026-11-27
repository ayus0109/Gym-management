import React, { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Check,
  CreditCard,
  HelpCircle,
  MessageCircle,
  QrCode,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
} from 'lucide-react'
import {
  api,
  DEFAULT_RENEWAL_TEMPLATE,
  formatRenewalMessage,
  generateUpiUrl,
  type GymDto,
  type IntegrationDto,
} from '../../api'

interface SettingsTabProps {
  gym: GymDto
  integrations: IntegrationDto
  onGymSaved: (gym: GymDto) => void
  onIntegrationsSaved: (integrations: IntegrationDto) => void
  onToast: (msg: string) => void
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  gym,
  integrations,
  onGymSaved,
  onIntegrationsSaved,
  onToast,
}) => {
  const [busyGym, setBusyGym] = useState(false)
  const [busyIntegrations, setBusyIntegrations] = useState(false)

  // Local state for live preview
  const [upiId, setUpiId] = useState(integrations.upiId || '')
  const [template, setTemplate] = useState(integrations.renewalTemplate || DEFAULT_RENEWAL_TEMPLATE)

  // Sample preview data
  const sampleMessage = formatRenewalMessage({
    template,
    name: 'Rahul Verma',
    gymName: gym.name || 'Iron Gym',
    planName: '1 Month Standard',
    expiryDate: '28 Nov 2026',
    amountRupees: 1500,
    upiId: upiId || 'yourname@upi',
    upiLink: generateUpiUrl({
      upiId: upiId || 'yourname@upi',
      payeeName: gym.name,
      amountRupees: 1500,
    }),
  })

  // Insert variable tag into template
  const handleInsertTag = (tag: string) => {
    setTemplate(prev => `${prev} ${tag}`)
  }

  // Save Gym Profile
  const handleSaveGym = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusyGym(true)
    const values = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const updated = await api<GymDto>('/gym', {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          phone: values.phone,
        }),
      })
      onGymSaved(updated)
      onToast('Gym profile updated!')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusyGym(false)
    }
  }

  // Save UPI & WhatsApp Settings
  const handleSaveIntegrations = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusyIntegrations(true)
    const values = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const payload: Record<string, string> = {
        upiId: upiId.trim(),
        renewalTemplate: template.trim(),
      }
      if (values.razorpayKeyId) payload.razorpayKeyId = String(values.razorpayKeyId).trim()
      if (values.razorpaySecret) payload.razorpaySecret = String(values.razorpaySecret).trim()
      if (values.whatsappToken) payload.whatsappToken = String(values.whatsappToken).trim()
      if (values.whatsappPhoneNumberId) payload.whatsappPhoneNumberId = String(values.whatsappPhoneNumberId).trim()

      const saved = await api<IntegrationDto>('/settings/integrations', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      onIntegrationsSaved(saved)
      onToast('UPI & WhatsApp settings saved!')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setBusyIntegrations(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <h2>Gym Settings & Integrations</h2>
          <p>Configure facility details, UPI payments, and personalized WhatsApp renewal messages.</p>
        </div>
      </div>

      <div className="settings-layout-grid">
        {/* Left Column: Gym Profile + Free UPI & WhatsApp */}
        <div className="settings-main-col">
          {/* FREE UPI & WHATSAPP SETTINGS (PRIMARY) */}
          <div className="settings-panel-card highlight-card">
            <div className="panel-card-header">
              <div className="header-icon-box lavender">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3>Free WhatsApp & UPI Reminders</h3>
                <p>Set the payment address and message used for manual reminders.</p>
              </div>
            </div>

            <form onSubmit={handleSaveIntegrations} className="panel-card-form">
              <div className="form-group">
                <label>
                  <span className="label-title">Gym UPI ID / VPA *</span>
                  <span className="label-hint">
                    Members can pay directly to this ID using Google Pay, PhonePe, or Paytm.
                  </span>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    placeholder="e.g. fitzone@okaxis, 9876543210@paytm"
                    className="input-code"
                  />
                </label>
              </div>

              <div className="form-group">
                <div className="template-label-row">
                  <div>
                    <span className="label-title">WhatsApp Renewal Message Template</span>
                    <span className="label-hint">
                      Click any tag below to insert dynamic member details into your message.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button-link-accent text-xs"
                    onClick={() => setTemplate(DEFAULT_RENEWAL_TEMPLATE)}
                  >
                    <RotateCcw size={13} /> Reset Template
                  </button>
                </div>

                {/* Variable Pills */}
                <div className="tag-chips-row">
                  {[
                    { tag: '{name}', label: 'Member Name' },
                    { tag: '{gymName}', label: 'Gym Name' },
                    { tag: '{planName}', label: 'Plan Name' },
                    { tag: '{expiryDate}', label: 'Expiry Date' },
                    { tag: '{amount}', label: 'Amount (₹)' },
                    { tag: '{upiId}', label: 'UPI ID' },
                    { tag: '{upiLink}', label: 'UPI Pay Link' },
                  ].map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      className="tag-chip"
                      onClick={() => handleInsertTag(item.tag)}
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={6}
                  value={template}
                  onChange={e => setTemplate(e.target.value)}
                  className="template-textarea"
                />
              </div>

              {/* Live WhatsApp Bubble Preview */}
              <div className="whatsapp-preview-card">
                <span className="preview-bubble-title">
                  <MessageCircle size={14} /> LIVE WHATSAPP PREVIEW
                </span>
                <div className="whatsapp-bubble">
                  <pre className="bubble-text">{sampleMessage}</pre>
                  <span className="bubble-time">10:00 AM · Delivered</span>
                </div>
              </div>

              <div className="form-actions-right">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={busyIntegrations}
                >
                  <Save size={16} />
                  <span>{busyIntegrations ? 'Saving...' : 'Save UPI & Template'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* FACILITY PROFILE */}
          <div className="settings-panel-card">
            <div className="panel-card-header">
              <div className="header-icon-box sage">
                <Settings size={20} />
              </div>
              <div>
                <h3>Gym Facility Profile</h3>
                <p>Public details printed on member receipts and payment slips</p>
              </div>
            </div>

            <form onSubmit={handleSaveGym} className="panel-card-form">
              <label className="form-group">
                <span>Gym Name *</span>
                <input
                  name="name"
                  required
                  defaultValue={gym.name}
                  placeholder="e.g. IronForge Fitness Club"
                />
              </label>

              <label className="form-group">
                <span>Address / Location *</span>
                <input
                  name="address"
                  required
                  defaultValue={gym.address}
                  placeholder="e.g. 2nd Floor, Apex Plaza, MG Road"
                />
              </label>

              <label className="form-group">
                <span>Front Desk Phone Number *</span>
                <input
                  name="phone"
                  required
                  defaultValue={gym.phone}
                  placeholder="e.g. +91 98765 43210"
                />
              </label>

              <div className="form-actions-right">
                <button type="submit" className="button button-primary" disabled={busyGym}>
                  <Save size={16} />
                  <span>{busyGym ? 'Saving...' : 'Update Facility Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Optional Developer Integrations */}
        <div className="settings-side-col">
          <div className="settings-panel-card">
            <div className="panel-card-header">
              <div className="header-icon-box amber">
                <CreditCard size={18} />
              </div>
              <div>
                <h4>Optional: Razorpay Gateway</h4>
                <p className="text-xs">Only needed if you want automatic payment links via Razorpay</p>
              </div>
            </div>

            <div className="panel-card-form">
              <span className={`integration-status-pill ${integrations.razorpayConfigured ? 'active' : ''}`}>
                {integrations.razorpayConfigured ? 'Connected' : 'Not Connected'}
              </span>

              <label className="form-group text-sm">
                <span>Razorpay Key ID</span>
                <input
                  name="razorpayKeyId"
                  placeholder="rzp_live_xxxxxxxx"
                  className="input-sm"
                />
              </label>

              <label className="form-group text-sm">
                <span>Razorpay Secret Key</span>
                <input
                  name="razorpaySecret"
                  type="password"
                  placeholder="••••••••••••"
                  className="input-sm"
                />
              </label>
              <small className="help-text">
                Leave blank if using free direct UPI QR payments.
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsTab
