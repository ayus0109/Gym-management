import React from 'react'
import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Clock3,
} from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: string
  onSelectTab: (tab: string) => void
  renewalsDueCount: number
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  renewalsDueCount,
}) => {
  const tabs = [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'Members', label: 'Members', icon: Users },
    {
      id: 'Renewals',
      label: 'Renewals',
      icon: Clock3,
      badge: renewalsDueCount > 0 ? renewalsDueCount : undefined,
    },
    { id: 'Membership plans', label: 'Plans', icon: FileText },
    { id: 'Payments', label: 'Payments', icon: CreditCard },
    { id: 'Gym profile', label: 'Profile', icon: Settings },
  ]

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <div className="nav-icon-wrapper">
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              {tab.badge !== undefined && (
                <span className="nav-badge-pill">{tab.badge}</span>
              )}
            </div>
            <span className="nav-btn-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav
