import React, { useState, useEffect } from 'react'
import { X, Check, CheckCircle2, ShieldCheck, Copy, Clock, ExternalLink } from 'lucide-react'
import { api, type AccessRequestDto } from '../../api'

interface AccessApprovalsModalProps {
  isOpen: boolean
  onClose: () => void
  onRequestsUpdated?: (count: number) => void
}

export default function AccessApprovalsModal({
  isOpen,
  onClose,
  onRequestsUpdated,
}: AccessApprovalsModalProps) {
  const [requests, setRequests] = useState<AccessRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const sharePassUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?pass=FORMA2026`
    : 'https://gym-management-delta-ecru.vercel.app?pass=FORMA2026'

  async function loadRequests() {
    try {
      setLoading(true)
      const data = await api<AccessRequestDto[]>('/access/requests')
      setRequests(data)
      const pendingCount = data.filter(r => r.status === 'PENDING').length
      onRequestsUpdated?.(pendingCount)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadRequests()
    }
  }, [isOpen])

  async function handleUpdateStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    setUpdatingId(id)
    try {
      await api<AccessRequestDto>(`/access/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRequests(prev => {
        const updated = prev.map(r => (r.id === id ? { ...r, status, approvedAt: status === 'APPROVED' ? new Date().toISOString() : null } : r))
        const nextPending = updated.filter(r => r.status === 'PENDING').length
        onRequestsUpdated?.(nextPending)
        return updated
      })
    } catch (e: any) {
      alert(e?.message || 'Could not update status')
    } finally {
      setUpdatingId(null)
    }
  }

  function handleCopyPassLink() {
    navigator.clipboard.writeText(sharePassUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  if (!isOpen) return null

  const filteredList = requests.filter(r => (filter === 'pending' ? r.status === 'PENDING' : true))
  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  function timeAgo(isoString: string) {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal approvals-modal-card" onClick={e => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="approvals-modal-head">
          <div className="approvals-title-group">
            <span className="approvals-shield-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2>Deployment Protection</h2>
              <p>Control external access and guest approvals for this deployment</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* 1-Click VIP Link Box */}
        <div className="approvals-share-card">
          <div className="approvals-share-info">
            <span className="share-label">INSTANT VIP PASS LINK</span>
            <div className="share-url-text">{sharePassUrl}</div>
            <p className="share-hint">Anyone opening this link will bypass protection and stay unlocked permanently.</p>
          </div>
          <button
            type="button"
            className={`button ${copiedLink ? 'button-secondary' : 'button-primary'} copy-pass-btn`}
            onClick={handleCopyPassLink}
          >
            {copiedLink ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
            <span>{copiedLink ? 'Copied to Clipboard!' : 'Copy VIP Pass Link'}</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="approvals-filter-bar">
          <button
            type="button"
            className={`approvals-filter-pill ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending Requests ({pendingCount})
          </button>
          <button
            type="button"
            className={`approvals-filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Activity ({requests.length})
          </button>
        </div>

        {/* List of Requests */}
        <div className="approvals-list-scroll">
          {loading ? (
            <div className="approvals-empty-box">
              <div className="loading-spinner-ring" />
              <p>Loading access requests...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="approvals-empty-box">
              <CheckCircle2 size={32} color="#10b981" />
              <h3>No pending requests</h3>
              <p>All visitors who requested access have been reviewed or unlocked.</p>
            </div>
          ) : (
            <div className="approvals-items-stack">
              {filteredList.map(req => (
                <div key={req.id} className={`approval-row ${req.status.toLowerCase()}`}>
                  <div className="approval-row-left">
                    <div className="approval-email-line">
                      <span className="approval-dot" />
                      <strong>{req.email}</strong>
                    </div>
                    <div className="approval-meta">
                      {req.gymName && <span className="meta-gym">{req.gymName} · </span>}
                      <span className="meta-time">
                        <Clock size={12} /> Requested {timeAgo(req.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="approval-actions">
                    {req.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="button-icon-reject"
                          title="Reject Access"
                          disabled={updatingId === req.id}
                          onClick={() => handleUpdateStatus(req.id, 'REJECTED')}
                        >
                          <X size={16} />
                        </button>
                        <button
                          type="button"
                          className="button-icon-approve"
                          title="Approve Permanent Access"
                          disabled={updatingId === req.id}
                          onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                        >
                          <Check size={16} />
                        </button>
                      </>
                    ) : (
                      <span className={`status-badge-pill ${req.status.toLowerCase()}`}>
                        {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="approvals-modal-footer">
          <span>Master Passcode: <strong>FORMA2026</strong> · Approved users remain unlocked across sessions</span>
        </div>
      </div>
    </div>
  )
}
