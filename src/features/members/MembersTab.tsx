import React, { useState } from 'react'
import {
  Download,
  Edit2,
  FileSpreadsheet,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  Eye,
} from 'lucide-react'
import {
  money,
  shortDate,
  type MemberDto,
  type PlanDto,
} from '../../api'
import CsvImportModal from '../../components/common/CsvImportModal'
import UpiQrModal from '../../components/common/UpiQrModal'

export type MemberView = {
  id: string
  name: string
  email: string
  phone: string
  plan: string
  start: string
  expires: string
  status: 'Active' | 'Expiring soon' | 'Expired' | 'Pending payment'
  initials: string
  color: string
  raw: MemberDto
}

interface MembersTabProps {
  members: MemberView[]
  memberDtos: MemberDto[]
  plans: PlanDto[]
  gymName: string
  upiId: string
  customTemplate?: string
  query: string
  onQueryChange: (q: string) => void
  filter: string
  onFilterChange: (f: string) => void
  onOpenAddMember: () => void
  onOpenEditMember: (m: MemberView) => void
  onArchiveMember: (m: MemberView) => void
  onOpenMemberDetail: (m: MemberView) => void
  onReload: () => Promise<void>
  onToast: (msg: string) => void
}

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  memberDtos,
  plans,
  gymName,
  upiId,
  customTemplate,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  onOpenAddMember,
  onOpenEditMember,
  onArchiveMember,
  onOpenMemberDetail,
  onReload,
  onToast,
}) => {
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedForReminder, setSelectedForReminder] = useState<MemberDto | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Filter members
  const filtered = members.filter(m => {
    const matchesSearch =
      `${m.name} ${m.phone} ${m.email}`.toLowerCase().includes(query.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'All members') return true
    return m.status === filter
  })

  // Export to CSV
  const handleExportCsv = () => {
    if (members.length === 0) {
      onToast('No members to export.')
      return
    }
    const headers = ['Name', 'Phone', 'Email', 'Plan', 'StartDate', 'ExpiryDate', 'Status']
    const rows = members.map(m => [
      m.name, m.phone, m.email, m.plan, m.start, m.expires, m.status,
    ])
    const quoteCell = (value: string) => {
      const safe = /^[=+@-]/.test(value.trimStart()) || /^[\t\r\n]/.test(value) ? "'" + value : value
      return '"' + safe.replace(/"/g, '""') + '"'
    }
    const csvContent = [headers.join(','), ...rows.map(row => row.map(quoteCell).join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${gymName.replace(/\s+/g, '_')}_Members_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    onToast(`Exported ${members.length} members to CSV!`)
  }

  return (
    <div className="members-page">
      {/* Page Header */}
      <div className="page-heading">
        <div>
          <h2>Member Roster</h2>
          <p>Manage memberships, contacts, and renewal statuses.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowImportModal(true)}
            title="Import members from spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleExportCsv}
            title="Download member roster as CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="members-toolbar">
        <div className="search-bar flex-1">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
          />
        </div>

        <div className="filter-chips-row">
          {['All members', 'Active', 'Expiring soon', 'Expired', 'Pending payment'].map(opt => (
            <button
              key={opt}
              type="button"
              className={`filter-chip ${filter === opt ? 'active' : ''}`}
              onClick={() => onFilterChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Members Count & List */}
      <div className="members-content-box">
        <div className="roster-meta-bar">
          <span>
            Showing <strong>{filtered.length}</strong> of {members.length} members
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state-box">
            <Users size={40} className="empty-icon-muted" />
            <h3>No members found</h3>
            <p>Try adjusting your search query or status filter.</p>
          </div>
        ) : (
          <div className="members-roster-list">
            {filtered.map(member => (
              <div key={member.id} className="member-roster-card">
                <div className="mrc-left" onClick={() => onOpenMemberDetail(member)}>
                  <div className={`mrc-avatar ${member.color}`}>
                    {member.initials}
                  </div>
                  <div className="mrc-info">
                    <h4>{member.name}</h4>
                    <div className="mrc-sub-details">
                      <a
                        href={`tel:${member.phone}`}
                        className="mrc-phone"
                        onClick={e => e.stopPropagation()}
                      >
                        <Phone size={12} /> {member.phone}
                      </a>
                      <span className="mrc-dot">·</span>
                      <span className="mrc-plan">{member.plan}</span>
                      <span className="mrc-dot">·</span>
                      <span className="mrc-dates">Expires: {member.expires}</span>
                    </div>
                  </div>
                </div>

                <div className="mrc-right">
                  <span
                    className={`status-pill ${
                      member.status === 'Active'
                        ? 'pill-active'
                        : member.status === 'Expiring soon'
                        ? 'pill-warning'
                        : member.status === 'Expired'
                        ? 'pill-danger'
                        : 'pill-pending'
                    }`}
                  >
                    {member.status}
                  </span>

                  <div className="mrc-actions">
                    <button
                      type="button"
                      className="button-icon-whatsapp"
                      title="Send WhatsApp renewal reminder"
                      onClick={() => setSelectedForReminder(member.raw)}
                    >
                      <MessageCircle size={17} />
                    </button>

                    <button
                      type="button"
                      className="button-icon-secondary"
                      title="View member profile"
                      onClick={() => onOpenMemberDetail(member)}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      type="button"
                      className="button-icon-secondary"
                      title="Edit member"
                      onClick={() => onOpenEditMember(member)}
                    >
                      <Edit2 size={16} />
                    </button>

                    <button
                      type="button"
                      className="button-icon-secondary danger-hover"
                      title="Archive member"
                      onClick={() => onArchiveMember(member)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <CsvImportModal
          plans={plans}
          onClose={() => setShowImportModal(false)}
          onSuccess={async () => {
            setShowImportModal(false)
            await onReload()
          }}
          onToast={onToast}
        />
      )}

      {/* WhatsApp UPI QR Modal */}
      {selectedForReminder && (
        <UpiQrModal
          member={selectedForReminder}
          gymName={gymName}
          upiId={upiId}
          customTemplate={customTemplate}
          plans={plans}
          onClose={() => setSelectedForReminder(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

export default MembersTab
