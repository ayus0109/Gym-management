import React, { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronRight,
  Clock3,
  CreditCard,
  Dumbbell,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react'
import AuthFlow from './Auth'
import {
  api,
  money,
  shortDate,
  type DashboardDto,
  type GymDto,
  type IntegrationDto,
  type MemberDto,
  type OwnerDto,
  type PaymentDto,
  type PlanDto,
} from './api'
import OverviewTab from './features/overview/OverviewTab'
import MembersTab, { type MemberView } from './features/members/MembersTab'
import RenewalsTab from './features/renewals/RenewalsTab'
import PlansTab from './features/plans/PlansTab'
import PaymentsTab from './features/payments/PaymentsTab'
import SettingsTab from './features/settings/SettingsTab'
import MobileBottomNav from './components/layout/MobileBottomNav'
import MemberModal from './components/members/MemberModal'
import MemberDetailsDrawer from './components/members/MemberDetailsDrawer'
import OfflinePaymentModal from './components/payments/OfflinePaymentModal'
import CsvImportModal from './components/common/CsvImportModal'
import UpiQrModal from './components/common/UpiQrModal'

const colors = ['lavender', 'peach', 'mint', 'blue', 'yellow', 'pink']

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

function mapMember(member: MemberDto): MemberView {
  const membership = member.memberships[0]
  let status: MemberView['status'] = 'Pending payment'
  if (membership?.status === 'ACTIVE' || membership?.status === 'SCHEDULED') {
    const expiryIso = String(membership.expiryDate).slice(0, 10)
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const daysRemaining =
      (Date.parse(`${expiryIso}T00:00:00Z`) - Date.parse(`${todayParts}T00:00:00Z`)) / 86400000
    status = daysRemaining < 0 ? 'Expired' : daysRemaining <= 7 ? 'Expiring soon' : 'Active'
  } else if (membership?.status === 'EXPIRED') {
    status = 'Expired'
  }

  return {
    id: member.id,
    name: member.name,
    email: member.email ?? 'No email added',
    phone: member.phone,
    plan: membership?.planNameSnapshot ?? 'No plan',
    start: membership ? shortDate(membership.startDate) : '—',
    expires: membership ? shortDate(membership.expiryDate) : '—',
    status,
    initials: initials(member.name),
    color: colors[member.name.length % colors.length],
    raw: member,
  }
}

export function App() {
  const [owner, setOwner] = useState<OwnerDto | null>(null)
  const [gym, setGym] = useState<GymDto | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [active, setActive] = useState('Overview')
  const [navHistory, setNavHistory] = useState<string[]>(['Overview'])
  const [members, setMembers] = useState<MemberView[]>([])
  const [memberDtos, setMemberDtos] = useState<MemberDto[]>([])
  const [plans, setPlans] = useState<PlanDto[]>([])
  const [payments, setPayments] = useState<PaymentDto[]>([])
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null)
  const [integrations, setIntegrations] = useState<IntegrationDto>({
    razorpayConfigured: false,
    whatsappConfigured: false,
    upiId: '',
    renewalTemplate: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappTemplateName: '',
    whatsappTemplateLanguage: 'en',
  })

  // Search & Filter
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All members')
  const [paymentQuery, setPaymentQuery] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('All')

  // Modals & Drawers
  const [memberModal, setMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberView | null>(null)
  const [selectedMember, setSelectedMember] = useState<MemberDto | null>(null)
  const [offlinePaymentModal, setOfflinePaymentModal] = useState(false)
  const [csvImportModal, setCsvImportModal] = useState(false)
  const [offlinePaymentPreselect, setOfflinePaymentPreselect] = useState<{
    membershipId: string
    memberName: string
    planName: string
    amountPaise: number
  } | null>(null)

  // Drawer reminder modal
  const [drawerReminderMember, setDrawerReminderMember] = useState<MemberDto | null>(null)

  // UI state
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('forma-theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('forma-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Browser Navigation & History Handling
  const navigateTo = (tab: string, pushHistory = true) => {
    if (tab === active) return
    if (pushHistory) {
      setNavHistory(prev => [...prev, tab])
      window.history.pushState({ tab }, '', `#${tab.toLowerCase().replace(/\s+/g, '-')}`)
    }
    setActive(tab)
    setSidebarOpen(false)
  }

  const handleGoBack = () => {
    if (navHistory.length > 1) {
      const nextHistory = navHistory.slice(0, -1)
      const prevTab = nextHistory[nextHistory.length - 1]
      setNavHistory(nextHistory)
      setActive(prevTab)
      window.history.pushState({ tab: prevTab }, '', `#${prevTab.toLowerCase().replace(/\s+/g, '-')}`)
    } else {
      navigateTo('Overview', false)
    }
  }

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const tab = e.state?.tab
      if (tab) {
        setActive(tab)
      } else {
        const hash = window.location.hash.replace('#', '')
        const tabMap: Record<string, string> = {
          overview: 'Overview',
          members: 'Members',
          renewals: 'Renewals',
          'membership-plans': 'Membership plans',
          payments: 'Payments',
          'gym-profile': 'Gym profile',
        }
        setActive(tabMap[hash] || 'Overview')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Initial Auth Check
  useEffect(() => {
    api<{ owner: OwnerDto; gym: GymDto | null }>('/auth/me')
      .then(result => {
        setOwner(result.owner)
        setGym(result.gym)
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  // Load Data
  const loadData = async () => {
    setError('')
    try {
      const [dashboardData, memberData, planData, paymentData, integrationData] =
        await Promise.all([
          api<DashboardDto>('/dashboard'),
          api<{ items: MemberDto[] }>('/members?pageSize=500'),
          api<PlanDto[]>('/plans'),
          api<{ items: PaymentDto[] }>('/payments?pageSize=200'),
          api<IntegrationDto>('/settings/integrations'),
        ])
      setDashboard(dashboardData)
      setMemberDtos(memberData.items)
      setMembers(memberData.items.map(mapMember))
      setPlans(planData)
      setPayments(paymentData.items)
      setIntegrations(integrationData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your gym data.')
    }
  }

  useEffect(() => {
    if (owner && gym) void loadData()
  }, [owner?.id, gym?.id])

  const showToast = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  // Member Save (Add / Edit)
  const handleSaveMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form).entries())
    try {
      if (editingMember) {
        await api(`/members/${editingMember.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: values.name,
            phone: values.phone,
            email: values.email,
          }),
        })
        showToast('Member details updated successfully')
      } else {
        await api('/members', {
          method: 'POST',
          body: JSON.stringify({
            name: values.name,
            phone: values.phone,
            email: values.email,
            planId: values.planId,
            startDate: values.startDate,
            paymentStatus: values.paymentStatus,
            paymentMethod: values.paymentMethod,
          }),
        })
        showToast('New member registered successfully!')
      }
      setMemberModal(false)
      setEditingMember(null)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save member.')
    }
  }

  // Archive Member
  const handleArchiveMember = async (member: MemberView) => {
    if (!window.confirm(`Archive ${member.name}? Their payment records will be preserved.`)) return
    try {
      await api(`/members/${member.id}`, { method: 'DELETE' })
      showToast(`${member.name} archived`)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not archive member.')
    }
  }

  // Record Offline Payment
  const handleRecordOfflinePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      await api('/payments/offline', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: values.membershipId,
          amount: Number(values.amount),
          method: values.method,
          reference: values.reference,
        }),
      })
      setOfflinePaymentModal(false)
      setOfflinePaymentPreselect(null)
      showToast('Offline payment recorded successfully!')
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record payment.')
    }
  }

  // Sign out
  const handleSignOut = async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {}
    setOwner(null)
    setGym(null)
  }

  // Calculate upcoming renewals badge count
  const renewalsDueCount = dashboard?.metrics?.expiringSoon ?? 0

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="loading-spinner-ring" />
        <p>Loading gym workspace...</p>
      </div>
    )
  }

  if (!owner || !gym) {
    return (
      <AuthFlow
        onDone={(newOwner, newGym) => {
          setOwner(newOwner)
          setGym(newGym)
        }}
      />
    )
  }

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Members', icon: Users },
    {
      label: 'Renewals',
      icon: Clock3,
      badge: renewalsDueCount > 0 ? renewalsDueCount : undefined,
    },
    { label: 'Membership plans', icon: FileText },
    { label: 'Payments', icon: CreditCard },
    { label: 'Gym profile', icon: Settings },
  ]

  return (
    <div className="app-shell">
      {/* DESKTOP & SLIDE SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Dumbbell size={18} />
          </div>
          <div className="brand-text-col">
            <span className="brand-title">{gym.name}</span>
            <span className="brand-sub">Gym Workspace</span>
          </div>
          <button
            type="button"
            className="icon-button close-sidebar-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          {navItems.map(item => {
            const Icon = item.icon
            const isCurrent = active === item.label
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-button ${isCurrent ? 'active' : ''}`}
                onClick={() => navigateTo(item.label)}
              >
                <div className="nav-item-left">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="sidebar-badge">{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="owner-profile-card">
            <div className="owner-avatar">{initials(owner.name)}</div>
            <div className="owner-details">
              <strong>{owner.name}</strong>
              <span>{owner.phone}</span>
            </div>
            <button
              type="button"
              className="icon-button logout-btn"
              title="Sign Out"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* BACKDROP SCRIM FOR MOBILE DRAWER */}
      {sidebarOpen && (
        <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="main-area">
        {/* TOPBAR (UNIFIED SINGLE SOURCE OF TRUTH) */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            {active !== 'Overview' && (
              <button
                type="button"
                className="topbar-back-btn"
                onClick={handleGoBack}
                title="Go back to previous page"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            )}

            <div className="topbar-breadcrumbs">
              <button
                type="button"
                className="crumb-link"
                onClick={() => navigateTo('Overview')}
              >
                {gym.name}
              </button>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">{active}</span>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Light / Dark theme"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              className="button button-primary button-sm"
              onClick={() => {
                setEditingMember(null)
                setMemberModal(true)
              }}
            >
              <Plus size={15} />
              <span>Add Member</span>
            </button>
          </div>
        </header>

        {/* ERROR / NOTICE TOASTS */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}

        {notice && (
          <div className="toast">
            <CheckCheck size={18} />
            <span>{notice}</span>
          </div>
        )}

        {/* ACTIVE TAB CONTENT */}
        <main className="content-wrap">
          {active === 'Overview' && (
            <OverviewTab
              dashboard={dashboard}
              memberDtos={memberDtos}
              gym={gym}
              upiId={integrations.upiId}
              customTemplate={integrations.renewalTemplate}
              plans={plans}
              onNavigateTab={tab => navigateTo(tab)}
              onOpenAddMember={() => {
                setEditingMember(null)
                setMemberModal(true)
              }}
              onOpenImportModal={() => setCsvImportModal(true)}
              onOpenOfflinePayment={(mId, mName, pName, amt) => {
                setOfflinePaymentPreselect({
                  membershipId: mId,
                  memberName: mName,
                  planName: pName,
                  amountPaise: amt,
                })
                setOfflinePaymentModal(true)
              }}
              onToast={showToast}
            />
          )}

          {active === 'Members' && (
            <MembersTab
              members={members}
              memberDtos={memberDtos}
              plans={plans}
              gymName={gym.name}
              upiId={integrations.upiId}
              customTemplate={integrations.renewalTemplate}
              query={query}
              onQueryChange={setQuery}
              filter={filter}
              onFilterChange={setFilter}
              onOpenAddMember={() => {
                setEditingMember(null)
                setMemberModal(true)
              }}
              onOpenEditMember={m => {
                setEditingMember(m)
                setMemberModal(true)
              }}
              onArchiveMember={handleArchiveMember}
              onOpenMemberDetail={m => setSelectedMember(m.raw)}
              onReload={loadData}
              onToast={showToast}
            />
          )}

          {active === 'Renewals' && (
            <RenewalsTab
              memberDtos={memberDtos}
              gymName={gym.name}
              upiId={integrations.upiId}
              customTemplate={integrations.renewalTemplate}
              plans={plans}
              onOpenOfflinePayment={(mId, mName, pName, amt) => {
                setOfflinePaymentPreselect({
                  membershipId: mId,
                  memberName: mName,
                  planName: pName,
                  amountPaise: amt,
                })
                setOfflinePaymentModal(true)
              }}
              onToast={showToast}
            />
          )}

          {active === 'Membership plans' && (
            <PlansTab plans={plans} onReload={loadData} onToast={showToast} />
          )}

          {active === 'Payments' && (
            <PaymentsTab
              payments={payments}
              memberDtos={memberDtos}
              gym={gym}
              paymentQuery={paymentQuery}
              onPaymentQueryChange={setPaymentQuery}
              paymentStatus={paymentStatus}
              onPaymentStatusChange={setPaymentStatus}
              onOpenOfflinePaymentModal={() => {
                setOfflinePaymentPreselect(null)
                setOfflinePaymentModal(true)
              }}
              onReload={loadData}
              onToast={showToast}
            />
          )}

          {active === 'Gym profile' && (
            <SettingsTab
              gym={gym}
              integrations={integrations}
              onGymSaved={setGym}
              onIntegrationsSaved={setIntegrations}
              onToast={showToast}
            />
          )}
        </main>

        {/* MOBILE STICKY BOTTOM NAV BAR */}
        <MobileBottomNav
          activeTab={active}
          onSelectTab={tab => navigateTo(tab)}
          renewalsDueCount={renewalsDueCount}
        />
      </div>

      {/* MODALS */}
      {memberModal && (
        <MemberModal
          plans={plans.filter(p => p.isActive)}
          member={editingMember}
          onClose={() => {
            setMemberModal(false)
            setEditingMember(null)
          }}
          onSubmit={handleSaveMember}
        />
      )}

      {selectedMember && (
        <MemberDetailsDrawer
          member={selectedMember}
          gymName={gym.name}
          upiId={integrations.upiId}
          customTemplate={integrations.renewalTemplate}
          plans={plans}
          onOpenReminder={m => {
            setSelectedMember(null)
            setDrawerReminderMember(m)
          }}
          onClose={() => setSelectedMember(null)}
        />
      )}

      {drawerReminderMember && (
        <UpiQrModal
          member={drawerReminderMember}
          gymName={gym.name}
          upiId={integrations.upiId}
          customTemplate={integrations.renewalTemplate}
          plans={plans}
          onClose={() => setDrawerReminderMember(null)}
          onToast={showToast}
        />
      )}

      {offlinePaymentModal && (
        <OfflinePaymentModal
          members={memberDtos}
          preselectedMembershipId={offlinePaymentPreselect?.membershipId}
          preselectedMemberName={offlinePaymentPreselect?.memberName}
          preselectedPlanName={offlinePaymentPreselect?.planName}
          preselectedAmountPaise={offlinePaymentPreselect?.amountPaise}
          onClose={() => {
            setOfflinePaymentModal(false)
            setOfflinePaymentPreselect(null)
          }}
          onSubmit={handleRecordOfflinePayment}
        />
      )}

      {csvImportModal && (
        <CsvImportModal
          plans={plans}
          onClose={() => setCsvImportModal(false)}
          onSuccess={async () => {
            setCsvImportModal(false)
            await loadData()
          }}
          onToast={showToast}
        />
      )}
    </div>
  )
}

export default App
