'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, List, ChevronLeft, ChevronRight, Plus, AlertTriangle, Clock } from 'lucide-react'
import { StatusIcon, STATUS_LABEL } from '@/components/ui/status-icon'
import type { Lead, LeadStatus } from '@/lib/types'
import { STALE_HOURS } from '@/components/dashboard/LeadCard'
import { getUrgency } from '@/lib/urgency'

const STATUSES: LeadStatus[] = ['new', 'chatting', 'qualified', 'awaiting_docs', 'processing', 'completed', 'rejected']

interface SidebarProps {
  leads?: Lead[]
  viewMode?: 'board' | 'list'
  statusFilter?: LeadStatus[]
  onViewChange?: (v: 'board' | 'list') => void
  onStatusFilter?: (s: LeadStatus[]) => void
  onNewLead?: () => void
}

function isOverdue(lead: Lead) {
  const t = STALE_HOURS[lead.status]
  if (!t) return false
  return (Date.now() - new Date(lead.updated_at).getTime()) / 3600000 >= t
}
function isStale(lead: Lead) {
  const t = STALE_HOURS[lead.status]
  if (!t) return false
  const h = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000
  return h >= t * 0.6 && h < t
}

export function Sidebar({
  leads = [],
  viewMode = 'board',
  statusFilter = [],
  onViewChange,
  onStatusFilter,
  onNewLead,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()

  // Persist collapse state
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])
  const toggleCollapse = () => {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v))
      return !v
    })
  }

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length
    return acc
  }, {} as Record<LeadStatus, number>)

  const overdueCount = leads.filter(isOverdue).length
  const staleCount   = leads.filter(isStale).length

  const isBoard    = pathname === '/' && viewMode === 'board' && statusFilter.length === 0
  const isList     = pathname === '/' && viewMode === 'list'  && statusFilter.length === 0
  const isInLead   = pathname.startsWith('/leads/')

  const handleNav = (type: 'board' | 'list') => {
    if (pathname !== '/') { router.push('/'); return }
    onViewChange?.(type)
    onStatusFilter?.([])
  }

  const handleStatus = (status: LeadStatus) => {
    if (pathname !== '/') { router.push('/'); return }
    const isActive = statusFilter.length === 1 && statusFilter[0] === status
    if (isActive) {
      onStatusFilter?.([])
    } else {
      onViewChange?.('list')
      onStatusFilter?.([status])
    }
  }

  const w = collapsed ? 'w-12' : 'w-56'

  return (
    <aside
      className={`${w} shrink-0 flex flex-col bg-[#0B0D10] border-r border-white/[0.06] overflow-hidden transition-all duration-200 relative`}
    >
      {/* Logo row */}
      <div className="h-11 flex items-center px-3 border-b border-white/[0.05] shrink-0">
        <div
          className="w-6 h-6 rounded-md overflow-hidden shrink-0 cursor-pointer"
          onClick={() => router.push('/')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/companylogo.png" alt="SecureLife" className="block w-full h-full object-contain bg-white p-px" />
        </div>
        {!collapsed && (
          <>
            <span className="ml-2.5 text-[13px] font-semibold text-[#F7F8FA] truncate flex-1">SecureLife CRM</span>
            <button onClick={toggleCollapse} className="text-[#6B7280] hover:text-[#A0A7B3] transition-colors ml-1 shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={toggleCollapse} className="absolute right-1 top-3 text-[#6B7280] hover:text-[#A0A7B3] transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">

        {/* Main nav */}
        <div className={`${collapsed ? 'px-1.5' : 'px-2'} space-y-0.5 mb-3`}>
          <NavItem
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            label="Board"
            active={isBoard}
            collapsed={collapsed}
            onClick={() => handleNav('board')}
          />
          <NavItem
            icon={<List className="w-3.5 h-3.5" />}
            label="All Leads"
            active={isList}
            collapsed={collapsed}
            onClick={() => handleNav('list')}
          />
        </div>

        {!collapsed && (
          <p className="px-3 mb-1 text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Pipeline</p>
        )}
        {collapsed && <div className="border-t border-white/[0.05] mx-1.5 mb-2" />}

        {/* Status nav items */}
        <div className={`${collapsed ? 'px-1.5' : 'px-2'} space-y-0.5 mb-3`}>
          {STATUSES.map(status => {
            const isActive = statusFilter.length === 1 && statusFilter[0] === status && pathname === '/'
            return (
              <button
                key={status}
                onClick={() => handleStatus(status)}
                title={collapsed ? STATUS_LABEL[status] : undefined}
                className={`w-full flex items-center gap-2 rounded-md transition-colors text-left
                  ${collapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'}
                  ${isActive
                    ? 'bg-[#171A1F] text-[#F7F8FA]'
                    : 'text-[#A0A7B3] hover:bg-[#14161A] hover:text-[#F7F8FA]'
                  }`}
              >
                <StatusIcon status={status} size={13} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-[13px] truncate">{STATUS_LABEL[status]}</span>
                    {statusCounts[status] > 0 && (
                      <span className="text-[11px] text-[#6B7280] tabular-nums">{statusCounts[status]}</span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        {!collapsed && (
          <p className="px-3 mb-1 text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Quick Access</p>
        )}
        {collapsed && <div className="border-t border-white/[0.05] mx-1.5 mb-2" />}

        <div className={`${collapsed ? 'px-1.5' : 'px-2'} space-y-0.5`}>
          {overdueCount > 0 && (
            <button
              title={collapsed ? `Overdue (${overdueCount})` : undefined}
              onClick={() => { if (pathname !== '/') router.push('/'); onViewChange?.('list'); onStatusFilter?.([]) }}
              className={`w-full flex items-center gap-2 rounded-md transition-colors text-left text-[#FF453A] hover:bg-[#14161A]
                ${collapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'}`}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-[13px]">Overdue</span>
                  <span className="text-[11px] tabular-nums">{overdueCount}</span>
                </>
              )}
            </button>
          )}
          {staleCount > 0 && (
            <button
              title={collapsed ? `Stale (${staleCount})` : undefined}
              className={`w-full flex items-center gap-2 rounded-md transition-colors text-left text-[#F59E0B] hover:bg-[#14161A]
                ${collapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'}`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-[13px]">Stale</span>
                  <span className="text-[11px] tabular-nums">{staleCount}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom — new lead */}
      <div className={`shrink-0 border-t border-white/[0.05] ${collapsed ? 'p-1.5' : 'p-2'}`}>
        <button
          onClick={onNewLead}
          title={collapsed ? 'New Lead' : undefined}
          className={`w-full flex items-center gap-2 rounded-md bg-[#5E6AD2]/10 hover:bg-[#5E6AD2]/20 text-[#7C7CFF] transition-colors
            ${collapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'}`}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span className="text-[13px] font-medium">New Lead</span>}
        </button>
      </div>
    </aside>
  )
}

function NavItem({ icon, label, active, collapsed, onClick }: {
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-2 rounded-md transition-colors text-left
        ${collapsed ? 'p-1.5 justify-center' : 'px-2 py-1.5'}
        ${active
          ? 'bg-[#171A1F] text-[#F7F8FA]'
          : 'text-[#A0A7B3] hover:bg-[#14161A] hover:text-[#F7F8FA]'
        }`}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && <span className="text-[13px]">{label}</span>}
    </button>
  )
}
