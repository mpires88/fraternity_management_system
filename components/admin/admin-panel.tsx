'use client'

import { Briefcase, Calendar, Settings, Shield, ToggleLeft, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSettingsData } from '@/dal/admin'
import { FeatureFlagsTab } from './tabs/feature-flags-tab'
import { OrgDetailsTab } from './tabs/org-details-tab'
import { PositionsTab } from './tabs/positions-tab'
import { RoleTypesTab } from './tabs/role-types-tab'
import { StatusDefinitionsTab } from './tabs/status-definitions-tab'
import { TermDefinitionsTab } from './tabs/term-definitions-tab'

const ALL_TABS = [
  { id: 'org', label: 'Org Details', icon: <Settings size={15} />, superOnly: false },
  { id: 'features', label: 'Features', icon: <ToggleLeft size={15} />, superOnly: true },
  { id: 'roles', label: 'Roles', icon: <Users size={15} />, superOnly: false },
  { id: 'statuses', label: 'Statuses', icon: <Shield size={15} />, superOnly: false },
  { id: 'positions', label: 'Positions', icon: <Briefcase size={15} />, superOnly: false },
  { id: 'terms', label: 'Terms', icon: <Calendar size={15} />, superOnly: false },
] as const

type TabId = (typeof ALL_TABS)[number]['id']

export function AdminPanel({
  settings,
  isSuperUser,
}: {
  settings: AdminSettingsData
  isSuperUser: boolean
}) {
  const tabs = useMemo(() => ALL_TABS.filter((t) => !t.superOnly || isSuperUser), [isSuperUser])
  const [activeTab, setActiveTab] = useState<TabId>(tabs[0].id)

  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0 space-y-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-brand/10 text-brand font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0">
        {activeTab === 'org' && <OrgDetailsTab settings={settings} />}
        {activeTab === 'features' && isSuperUser && <FeatureFlagsTab settings={settings} />}
        {activeTab === 'roles' && <RoleTypesTab settings={settings} />}
        {activeTab === 'statuses' && <StatusDefinitionsTab settings={settings} />}
        {activeTab === 'positions' && <PositionsTab settings={settings} />}
        {activeTab === 'terms' && <TermDefinitionsTab settings={settings} />}
      </div>
    </div>
  )
}
