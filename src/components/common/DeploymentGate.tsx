import React, { useState, useEffect } from 'react'
import { Lock, ShieldCheck, ArrowRight, KeyRound, CheckCircle2, Clock } from 'lucide-react'
import { api } from '../../api'

interface DeploymentGateProps {
  onUnlock: () => void
}

export default function DeploymentGate({ onUnlock }: DeploymentGateProps) {
  const [mode, setMode] = useState<'request' | 'passcode'>('request')
  const [email, setEmail] = useState('')
  const [gymName, setGymName] = useState('')
  const [passcode, setPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)

  // Check if there was already a pending email submitted on this device
  useEffect(() => {
    const savedPending = localStorage.getItem('forma_gate_pending_email')
    if (savedPending) {
      setEmail(savedPending)
      setPendingApproval(true)
    }
  }, [])

  // Real-time polling while pending approval: automatically unlocks as soon as owner clicks [✔]
  useEffect(() => {
    if (!pendingApproval || !email) return

    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const res = await api<{ authorized: boolean; reason?: string }>('/access/verify', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        })
        if (!cancelled && res.authorized) {
          localStorage.setItem('forma_gate_unlocked', 'true')
          localStorage.removeItem('forma_gate_pending_email')
          clearInterval(interval)
          onUnlock()
        }
      } catch {}
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pendingApproval, email, onUnlock])

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await api<{ status: string; authorized?: boolean; message?: string }>('/access/request', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          gymName: gymName.trim() || undefined,
        }),
      })

      if (res.authorized || res.status === 'APPROVED') {
        localStorage.setItem('forma_gate_unlocked', 'true')
        localStorage.removeItem('forma_gate_pending_email')
        onUnlock()
        return
      }

      localStorage.setItem('forma_gate_pending_email', email.trim().toLowerCase())
      setPendingApproval(true)
    } catch (err: any) {
      setError(err?.message || 'Could not submit request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passcode.trim()) {
      setError('Please enter your access passcode.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await api<{ authorized: boolean; reason?: string }>('/access/verify', {
        method: 'POST',
        body: JSON.stringify({ passcode: passcode.trim().toUpperCase() }),
      })

      if (res.authorized) {
        localStorage.setItem('forma_gate_unlocked', 'true')
        localStorage.removeItem('forma_gate_pending_email')
        onUnlock()
        return
      }

      setError('Invalid access passcode. Please request access from the owner.')
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="deployment-gate-shell">
      <div className="gate-ambient-glow" />

      <div className="deployment-gate-card">
        <div className="gate-header">
          <div className="gate-icon-badge">
            <Lock size={22} className="gate-lock-icon" />
          </div>
          <span className="gate-pill">DEPLOYMENT PROTECTION</span>
          <h1 className="gate-title">Private Preview Deployment</h1>
          <p className="gate-subtitle">
            Access to this gym workspace is restricted. Request access from the owner or enter an approved pass to explore.
          </p>
        </div>

        {error && <div className="gate-error-banner">{error}</div>}

        {pendingApproval ? (
          <div className="gate-pending-box">
            <div className="gate-pending-icon-wrap">
              <Clock size={28} className="gate-spin-slow" />
            </div>
            <h3>Access Request Pending Approval</h3>
            <p>
              Your request for <strong>{email}</strong> has been received by the owner.
            </p>
            <div className="gate-auto-unlock-pill">
              <span className="gate-pulse-dot" />
              <span>Checking approval live · Screen unlocks automatically</span>
            </div>
            <button
              type="button"
              className="button button-secondary gate-switch-btn"
              onClick={() => {
                setPendingApproval(false)
                localStorage.removeItem('forma_gate_pending_email')
              }}
            >
              Use a different email or passcode
            </button>
          </div>
        ) : (
          <>
            <div className="gate-mode-selector">
              <button
                type="button"
                className={`gate-mode-tab ${mode === 'request' ? 'active' : ''}`}
                onClick={() => { setMode('request'); setError('') }}
              >
                Request Access
              </button>
              <button
                type="button"
                className={`gate-mode-tab ${mode === 'passcode' ? 'active' : ''}`}
                onClick={() => { setMode('passcode'); setError('') }}
              >
                Have Passcode
              </button>
            </div>

            {mode === 'request' ? (
              <form onSubmit={handleRequestAccess} className="gate-form">
                <label className="gate-field">
                  <span>Your Email Address *</span>
                  <input
                    type="email"
                    required
                    placeholder="e.g. gymowner@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </label>

                <label className="gate-field">
                  <span>Gym / Fitness Studio Name</span>
                  <input
                    placeholder="e.g. IronPeak Fitness Studio"
                    value={gymName}
                    onChange={e => setGymName(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button button-primary gate-submit-btn"
                >
                  {loading ? (
                    <div className="loading-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  ) : (
                    <>
                      <span>Request Access</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePasscodeSubmit} className="gate-form">
                <label className="gate-field">
                  <span>Access Passcode *</span>
                  <input
                    required
                    placeholder="Enter passcode (e.g. FORMA2026)"
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                    autoFocus
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="button button-primary gate-submit-btn"
                >
                  {loading ? (
                    <div className="loading-spinner-ring" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  ) : (
                    <>
                      <KeyRound size={15} />
                      <span>Unlock Workspace</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}

        <div className="gate-footer">
          <ShieldCheck size={14} />
          <span>Encrypted Gateway · Once approved you remain unlocked</span>
        </div>
      </div>
    </div>
  )
}
