import React, { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
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
  MessageCircle,
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
  const [owner, setOwner] = useState<OwnerDto | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('forma_auth_session')
        if (saved) return JSON.parse(saved).owner
      } catch {}
    }
    return null
  })
  const [gym, setGym] = useState<GymDto | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('forma_auth_session')
        if (saved) return JSON.parse(saved).gym
      } catch {}
    }
    return null
  })
  const [authLoading, setAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('forma_auth_session')
    }
    return true
  })
  const [active, setActive] = useState('Overview')
  const [previousTab, setPreviousTab] = useState<string | null>(null)
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
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('forma-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('forma-theme', theme)
  }, [darkMode])

  // Browser Navigation & History Handling
  const navigateTo = (tab: string, pushHistory = true) => {
    if (tab === active) return
    setPreviousTab(active)
    if (pushHistory) {
      window.history.pushState({ tab }, '', `#${tab.toLowerCase().replace(/\s+/g, '-')}`)
    }
    setActive(tab)
    setSidebarOpen(false)
  }

  const handleGoBack = () => {
    if (previousTab && previousTab !== active) {
      navigateTo(previousTab)
    } else {
      window.history.back()
    }
  }

  useEffect(() => {
    const tabMap: Record<string, string> = {
      overview: 'Overview',
      members: 'Members',
      renewals: 'Renewals',
      'membership-plans': 'Membership plans',
      payments: 'Payments',
      'gym-profile': 'Gym profile',
    }

    const hash = window.location.hash.replace('#', '')
    if (hash && tabMap[hash] && tabMap[hash] !== active) {
      setActive(tabMap[hash])
    }

    const handlePopState = (e: PopStateEvent) => {
      const tab = e.state?.tab
      if (tab) {
        setPreviousTab(active)
        setActive(tab)
      } else {
        const h = window.location.hash.replace('#', '')
        const mapped = tabMap[h] || 'Overview'
        setPreviousTab(active)
        setActive(mapped)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [active])

  // Initial Auth Check & Session Sync
  useEffect(() => {
    // If it's the demo session, keep it local unless signed out
    const saved = typeof window !== 'undefined' ? localStorage.getItem('forma_auth_session') : null
    let isDemo = false
    try {
      if (saved && JSON.parse(saved)?.owner?.id === 'demo-owner') {
        isDemo = true
      }
    } catch {}

    if (isDemo) {
      setAuthLoading(false)
      return
    }

    api<{ owner: OwnerDto; gym: GymDto | null }>('/auth/me')
      .then(result => {
        setOwner(result.owner)
        setGym(result.gym)
        localStorage.setItem('forma_auth_session', JSON.stringify({ owner: result.owner, gym: result.gym }))
      })
      .catch(err => {
        const msg = String(err?.message || '')
        // ONLY invalidate local session if the backend explicitly rejected credentials (401 / session expired)
        // If it's a cold boot timeout (502/504) or offline network error, keep user logged in with cached credentials!
        if (msg.includes('401') || msg.includes('Please sign in') || msg.includes('expired')) {
          localStorage.removeItem('forma_auth_session')
          setOwner(null)
          setGym(null)
        }
      })
      .finally(() => setAuthLoading(false))
  }, [])

  // Load Data
  const loadData = async () => {
    setError('')

    // Interactive Demo Sandbox Mode (Zero Backend Auth Required)
    if (owner?.id === 'demo-owner') {
      const today = new Date()
      const d1 = new Date(today.getTime() + 2 * 86400000).toISOString()
      const d2 = new Date(today.getTime() + 4 * 86400000).toISOString()
      const d3 = new Date(today.getTime() + 6 * 86400000).toISOString()
      const dPast = new Date(today.getTime() - 3 * 86400000).toISOString()
      const dActive = new Date(today.getTime() + 45 * 86400000).toISOString()

      const demoPlans: PlanDto[] = [
        { id: 'dp-1', name: '1 Month Standard', durationDays: 30, pricePaise: 150000, isActive: true, description: 'Full gym floor & cardio access' },
        { id: 'dp-2', name: '3 Months Transformation', durationDays: 90, pricePaise: 380000, isActive: true, description: 'Gym + locker + fitness assessment' },
        { id: 'dp-3', name: '6 Months Strength Pass', durationDays: 180, pricePaise: 650000, isActive: true, description: 'All access with trainer guidance' },
        { id: 'dp-4', name: '1 Year Elite Annual', durationDays: 365, pricePaise: 1199900, isActive: true, description: 'VIP annual membership with priority perks' },
      ]

      const demoMembers: MemberDto[] = [
        {
          id: 'dm-1',
          name: 'Rahul Verma',
          phone: '+919876543210',
          email: 'rahul.verma@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-1',
            planNameSnapshot: '1 Month Standard',
            amountPaise: 150000,
            startDate: new Date(today.getTime() - 28 * 86400000).toISOString(),
            expiryDate: d1,
            status: 'ACTIVE',
            payments: [{ id: 'dp-p1', amountPaise: 150000, status: 'PAID', method: 'UPI_OFFLINE' }],
          }],
        },
        {
          id: 'dm-2',
          name: 'Priya Sharma',
          phone: '+919823456789',
          email: 'priya.s@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-2',
            planNameSnapshot: '3 Months Transformation',
            amountPaise: 380000,
            startDate: new Date(today.getTime() - 86 * 86400000).toISOString(),
            expiryDate: d2,
            status: 'ACTIVE',
            payments: [{ id: 'dp-p2', amountPaise: 380000, status: 'PAID', method: 'CASH' }],
          }],
        },
        {
          id: 'dm-3',
          name: 'Amit Patel',
          phone: '+919712345678',
          email: 'amit.patel@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-3',
            planNameSnapshot: '1 Month Standard',
            amountPaise: 150000,
            startDate: new Date(today.getTime() - 24 * 86400000).toISOString(),
            expiryDate: d3,
            status: 'ACTIVE',
            payments: [{ id: 'dp-p3', amountPaise: 150000, status: 'PAID', method: 'UPI_OFFLINE' }],
          }],
        },
        {
          id: 'dm-4',
          name: 'Sneha Reddy',
          phone: '+919654321098',
          email: 'sneha.r@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-4',
            planNameSnapshot: '6 Months Strength Pass',
            amountPaise: 650000,
            startDate: new Date(today.getTime() - 183 * 86400000).toISOString(),
            expiryDate: dPast,
            status: 'EXPIRED',
            payments: [{ id: 'dp-p4', amountPaise: 650000, status: 'PAID', method: 'UPI_OFFLINE' }],
          }],
        },
        {
          id: 'dm-5',
          name: 'Vikramaditya Rao',
          phone: '+919543210987',
          email: 'vikram.rao@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-5',
            planNameSnapshot: '1 Year Elite Annual',
            amountPaise: 1199900,
            startDate: new Date(today.getTime() - 60 * 86400000).toISOString(),
            expiryDate: dActive,
            status: 'ACTIVE',
            payments: [{ id: 'dp-p5', amountPaise: 1199900, status: 'PAID', method: 'BANK_TRANSFER' }],
          }],
        },
        {
          id: 'dm-6',
          name: 'Ananya Deshmukh',
          phone: '+919432109876',
          email: 'ananya.d@example.com',
          createdAt: new Date().toISOString(),
          memberships: [{
            id: 'dms-6',
            planNameSnapshot: '3 Months Transformation',
            amountPaise: 380000,
            startDate: new Date().toISOString(),
            expiryDate: new Date(today.getTime() + 90 * 86400000).toISOString(),
            status: 'PENDING_PAYMENT',
            payments: [{ id: 'dp-p6', amountPaise: 380000, status: 'PENDING', method: 'UPI_OFFLINE' }],
          }],
        },
      ]

      const demoPayments: PaymentDto[] = [
        {
          id: 'dpay-1',
          amountPaise: 150000,
          status: 'PAID',
          method: 'UPI_OFFLINE',
          paymentDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          transactionReference: 'UPI-DEMO-001',
          member: { name: 'Rahul Verma', phone: '+919876543210' },
          membership: { planNameSnapshot: '1 Month Standard' },
        },
        {
          id: 'dpay-2',
          amountPaise: 380000,
          status: 'PAID',
          method: 'CASH',
          paymentDate: new Date(today.getTime() - 86400000).toISOString(),
          createdAt: new Date(today.getTime() - 86400000).toISOString(),
          transactionReference: 'CASH-REC-002',
          member: { name: 'Priya Sharma', phone: '+919823456789' },
          membership: { planNameSnapshot: '3 Months Transformation' },
        },
        {
          id: 'dpay-3',
          amountPaise: 1199900,
          status: 'PAID',
          method: 'BANK_TRANSFER',
          paymentDate: new Date(today.getTime() - 3 * 86400000).toISOString(),
          createdAt: new Date(today.getTime() - 3 * 86400000).toISOString(),
          transactionReference: 'IMPS-DEMO-003',
          member: { name: 'Vikramaditya Rao', phone: '+919543210987' },
          membership: { planNameSnapshot: '1 Year Elite Annual' },
        },
        {
          id: 'dpay-4',
          amountPaise: 380000,
          status: 'PENDING',
          method: 'UPI_OFFLINE',
          paymentDate: null,
          createdAt: new Date().toISOString(),
          transactionReference: null,
          member: { name: 'Ananya Deshmukh', phone: '+919432109876' },
          membership: { planNameSnapshot: '3 Months Transformation' },
        },
      ]

      const demoDashboard: DashboardDto = {
        metrics: {
          totalMembers: 48,
          activeMemberships: 43,
          expiredMemberships: 2,
          expiringSoon: 3,
          monthlyRevenuePaise: 8450000,
          pendingPaymentsPaise: 380000,
          pendingPaymentCount: 1,
          newRegistrations: 6,
        },
        recentMembers: demoMembers,
        recentPayments: demoPayments,
        expiringList: [
          {
            id: 'dex-1',
            expiryDate: d1,
            planNameSnapshot: '1 Month Standard',
            member: { name: 'Rahul Verma' },
          },
          {
            id: 'dex-2',
            expiryDate: d2,
            planNameSnapshot: '3 Months Transformation',
            member: { name: 'Priya Sharma' },
          },
          {
            id: 'dex-3',
            expiryDate: d3,
            planNameSnapshot: '1 Month Standard',
            member: { name: 'Amit Patel' },
          },
        ],
      }

      setDashboard(demoDashboard)
      setMemberDtos(demoMembers)
      setMembers(demoMembers.map(mapMember))
      setPlans(demoPlans)
      setPayments(demoPayments)
      setIntegrations({
        razorpayConfigured: false,
        whatsappConfigured: false,
        upiId: 'ironpeak@okaxis',
        renewalTemplate: 'Hi {name}! Your gym membership ({planName}) at {gymName} is expiring on {expiryDate}. Renewal fee: ₹{amount}. Pay directly via UPI: {upiLink} or scan the QR code attached.',
        whatsappPhoneNumberId: '',
        whatsappBusinessAccountId: '',
        whatsappTemplateName: '',
        whatsappTemplateLanguage: 'en',
      })
      return
    }

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
    if (owner?.id === 'demo-owner') {
      showToast('Demo Sandbox: Action simulated! (Contact Ayush for a private gym workspace)')
      setMemberModal(false)
      setEditingMember(null)
      return
    }

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
    if (owner?.id === 'demo-owner') {
      showToast('Demo Sandbox: Action simulated!')
      return
    }

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
    if (owner?.id === 'demo-owner') {
      showToast('Demo Sandbox: Offline payment recorded and receipt created!')
      setOfflinePaymentModal(false)
      setOfflinePaymentPreselect(null)
      return
    }

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
    localStorage.removeItem('forma_auth_session')
    if (owner?.id !== 'demo-owner') {
      try {
        await api('/auth/logout', { method: 'POST' })
      } catch {}
    }
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
          localStorage.setItem('forma_auth_session', JSON.stringify({ owner: newOwner, gym: newGym }))
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
          {sidebarOpen && (
            <button
              type="button"
              className="icon-button close-sidebar-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
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
        {/* INTERACTIVE DEMO MODE WATERMARK BANNER */}
        {owner.id === 'demo-owner' && (
          <div className="demo-mode-top-banner">
            <div className="dmtb-left">
              <span className="demo-pill">LIVE DEMO MODE</span>
              <span>Testing <strong>IronPeak Fitness Studio</strong> workspace with sample data.</span>
            </div>
            <div className="dmtb-right">
              <button
                type="button"
                className="button button-whatsapp-sm"
                onClick={() => {
                  const msg = encodeURIComponent("Hi Ayush, I just test-drove the Forma Live Demo and I would like to purchase / request access for my gym workspace.")
                  window.open(`https://wa.me/${import.meta.env.VITE_OWNER_WHATSAPP || '919999990001'}?text=${msg}`, '_blank')
                }}
              >
                <MessageCircle size={14} />
                <span>Request Real Workspace</span>
              </button>
              <button
                type="button"
                className="button button-secondary text-xs"
                style={{ height: '28px', padding: '0 10px' }}
                onClick={() => {
                  setOwner(null)
                  setGym(null)
                }}
              >
                Exit Demo
              </button>
            </div>
          </div>
        )}

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

            <div className="history-nav-group">
              <button
                type="button"
                className="topbar-nav-icon-btn"
                onClick={() => window.history.back()}
                title="Go back (Browser History)"
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>

              <button
                type="button"
                className="topbar-nav-icon-btn"
                onClick={() => window.history.forward()}
                title="Go forward (Browser History)"
                aria-label="Forward"
              >
                <ArrowRight size={16} />
              </button>

              {previousTab && previousTab !== active && (
                <button
                  type="button"
                  className="topbar-previous-btn"
                  onClick={() => navigateTo(previousTab)}
                  title={`Switch to previous tab: ${previousTab}`}
                >
                  <Clock3 size={13} />
                  <span>Previous: {previousTab}</span>
                </button>
              )}
            </div>

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
