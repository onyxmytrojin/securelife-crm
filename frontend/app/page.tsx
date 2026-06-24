'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, closestCenter,
  type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { PipelineColumn } from '@/components/dashboard/PipelineColumn'
import { LeadCard, STALE_HOURS } from '@/components/dashboard/LeadCard'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { CommandPalette } from '@/components/ui/command-palette'
import { Sidebar } from '@/components/layout/sidebar'
import { FilterBar, type SortKey, type SortDir, type UrgencyFilter } from '@/components/ui/filter-bar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { computeScore } from '@/lib/scoring'
import { getUrgency } from '@/lib/urgency'
import { createClient } from '@/lib/supabase-browser'
import { getLeadConcerns, formatLeadConcerns } from '@/lib/lead-utils'
import { StatusIcon, STATUS_LABEL } from '@/components/ui/status-icon'
import type { Lead, LeadStatus } from '@/lib/types'
import { RefreshCw, LogOut, LayoutGrid, List, Command } from 'lucide-react'

const STATUSES: LeadStatus[] = ['new', 'chatting', 'qualified', 'awaiting_docs', 'processing', 'completed', 'rejected']

type ViewMode = 'board' | 'list'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function ListRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const score   = computeScore(lead)
  const urgency = getUrgency(lead)
  return (
    <tr onClick={onClick}
      className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group">
      <td className="pl-4 pr-2 py-2.5 w-6">
        <StatusIcon status={lead.status} size={13} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[#1E2028] flex items-center justify-center text-[9px] font-bold text-[#A0A7B3] shrink-0">
            {(lead.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <span className="text-[14px] font-medium text-[#F7F8FA]">{lead.name ?? 'Unknown'}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-[13px] text-[#6B7280] hidden sm:table-cell">{lead.email ?? '—'}</td>
      <td className="px-3 py-2.5 hidden md:table-cell">
        <span className="text-[12px] capitalize text-[#A0A7B3] bg-[#111317] border border-white/[0.06] rounded-full px-2 py-0.5">
          {STATUS_LABEL[lead.status]}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[13px] text-[#6B7280] hidden md:table-cell">{formatLeadConcerns(lead)}</td>
      <td className="px-3 py-2.5 hidden lg:table-cell">
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-semibold tabular-nums ${score.total >= 71 ? 'text-green-400' : score.total >= 41 ? 'text-amber-400' : 'text-red-400'}`}>
            {score.total}
          </span>
          <span className={`text-[10px] font-medium px-1 py-px rounded ${
            score.grade === 'A' ? 'bg-green-950/60 text-green-400' :
            score.grade === 'B' ? 'bg-blue-950/60 text-blue-400' :
            score.grade === 'C' ? 'bg-amber-950/60 text-amber-400' :
            'bg-[#1E2028] text-[#6B7280]'
          }`}>{score.grade}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 hidden lg:table-cell">
        {urgency && urgency.level !== 'P3'
          ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${urgency.badge} ${urgency.text}`}>{urgency.level}</span>
          : <span className="text-[12px] text-[#3A3A3A]">—</span>}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[#6B7280] whitespace-nowrap hidden xl:table-cell">{fmtDate(lead.updated_at)}</td>
    </tr>
  )
}

function BoardSkeleton() {
  return (
    <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(7, minmax(0, 1fr))` }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 h-8">
            <div className="w-3 h-3 rounded-full bg-[#1E2028] animate-pulse" />
            <div className="h-2.5 bg-[#1E2028] rounded animate-pulse flex-1" />
          </div>
          <div className="flex-1 rounded-xl border border-white/[0.06] p-1.5 space-y-2">
            {i < 2 && Array.from({ length: i + 1 }).map((_, j) => (
              <div key={j} className="bg-[#111317] rounded-xl border border-white/[0.06] p-3 space-y-2 animate-pulse">
                <div className="h-3 bg-[#1E2028] rounded w-3/4" />
                <div className="h-2 bg-[#1E2028] rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function isOverdue(lead: Lead) {
  const t = STALE_HOURS[lead.status]
  if (!t) return false
  return (Date.now() - new Date(lead.updated_at).getTime()) / 3600000 >= t
}
function isStaleOnly(lead: Lead) {
  const t = STALE_HOURS[lead.status]
  if (!t) return false
  const h = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000
  return h >= t * 0.6 && h < t
}

export default function Dashboard() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [loading, setLoading]       = useState(true)
  const [chatOpen, setChatOpen]     = useState(false)
  const [activeLead, setActiveLead] = useState<string | null>(null)
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null)
  const [viewMode, setViewMode]     = useState<ViewMode>('board')

  // Filter state
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([])
  const [concernFilter, setConcernFilter] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [urgency, setUrgency]           = useState<UrgencyFilter>('all')
  const [sortKey, setSortKey]           = useState<SortKey>('updated_at')
  const [sortDir, setSortDir]           = useState<SortDir>('desc')

  const router   = useRouter()
  const supabase = createClient()
  const sensors  = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const signOut   = async () => { await supabase.auth.signOut(); router.push('/login') }
  const newLeadFn = () => { setActiveLead(null); setChatOpen(true) }

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/leads')
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') newLeadFn()
      if (e.key === 'r' || e.key === 'R') fetchLeads()
      if (e.key === 'b' || e.key === 'B') setViewMode('board')
      if (e.key === 'l' || e.key === 'L') setViewMode('list')
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [fetchLeads])

  const onLeadCreated = (id: string) => { setActiveLead(id); fetchLeads() }

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingLead(leads.find(l => l.id === e.active.id) ?? null)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingLead(null)
    const { active, over } = e
    if (!over) return
    const leadId    = active.id as string
    const newStatus = over.id as LeadStatus
    const lead      = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    const res = await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status: newStatus }),
    })
    if (!res.ok) setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: lead.status } : l))
  }

  // Handle sidebar status click → switch to list view with filter
  const handleSidebarNav = (type: 'view' | 'status', value: string) => {
    if (type === 'view') { setViewMode(value as ViewMode); setStatusFilter([]) }
    else { setViewMode('list'); setStatusFilter([value as LeadStatus]) }
  }

  // Apply all filters + sort
  const filteredLeads = leads
    .filter(l => {
      if (search) {
        const q = search.toLowerCase()
        if (!`${l.name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(q)) return false
      }
      if (statusFilter.length  > 0 && !statusFilter.includes(l.status))               return false
      const leadConcerns = getLeadConcerns(l)
      if (concernFilter.length > 0 && !leadConcerns.some(c => concernFilter.includes(c))) return false
      if (sourceFilter.length  > 0 && !sourceFilter.includes(l.source ?? ''))          return false
      if (urgency === 'overdue' && !isOverdue(l))   return false
      if (urgency === 'stale'   && !isStaleOnly(l)) return false
      return true
    })
    .sort((a, b) => {
      const av = sortKey === 'score' ? computeScore(a).total : new Date(a[sortKey]).getTime()
      const bv = sortKey === 'score' ? computeScore(b).total : new Date(b[sortKey]).getTime()
      return sortDir === 'desc' ? bv - av : av - bv
    })

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = filteredLeads.filter(l => l.status === s)
    return acc
  }, {} as Record<LeadStatus, Lead[]>)

  const overdueCount = leads.filter(isOverdue).length

  return (
    <div className="h-screen flex overflow-hidden bg-[#08090B]">
      <CommandPalette leads={leads} onNewLead={newLeadFn} onRefresh={fetchLeads} />

      {/* Sidebar */}
      <Sidebar
        leads={leads}
        viewMode={viewMode}
        statusFilter={statusFilter}
        onViewChange={v => { setViewMode(v); setStatusFilter([]) }}
        onStatusFilter={ss => { setStatusFilter(ss); if (ss.length > 0) setViewMode('list') }}
        onNewLead={newLeadFn}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="shrink-0 h-11 border-b border-white/[0.06] bg-[#0B0D10] px-4 flex items-center justify-between gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-[13px] text-[#6B7280]">
            <span><span className="font-semibold text-[#A0A7B3]">{leads.length}</span> leads</span>
            <span><span className="font-semibold text-green-400">{grouped.completed?.length ?? 0}</span> completed</span>
            <span><span className="font-semibold text-purple-400">{grouped.qualified?.length ?? 0}</span> qualified</span>
            {overdueCount > 0 && (
              <span className="text-[#FF453A] font-medium">{overdueCount} overdue</span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1">
            {/* View toggle */}
            <div className="flex items-center border border-white/[0.08] rounded-lg overflow-hidden mr-1">
              <button onClick={() => setViewMode('board')} title="Board (B)"
                className={`p-1.5 transition-colors ${viewMode === 'board'
                  ? 'bg-[#171A1F] text-[#F7F8FA]' : 'text-[#6B7280] hover:bg-[#111317] hover:text-[#A0A7B3]'}`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setViewMode('list')} title="List (L)"
                className={`p-1.5 transition-colors ${viewMode === 'list'
                  ? 'bg-[#171A1F] text-[#F7F8FA]' : 'text-[#6B7280] hover:bg-[#111317] hover:text-[#A0A7B3]'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ⌘K hint */}
            <button
        onClick={() => window.dispatchEvent(new CustomEvent('securelife-command-palette-open'))}
        title="Command palette (Ctrl/Cmd+K)"
        className="hidden sm:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] text-[#6B7280]
          border border-white/[0.08] hover:bg-[#111317] hover:text-[#A0A7B3] transition-colors font-mono"
      >
        <Command className="w-3 h-3" />⌘/Ctrl+K
      </button>

            <button onClick={fetchLeads} disabled={loading}
              className="h-7 px-2.5 rounded-md text-[13px] flex items-center gap-1.5 border border-white/[0.08]
                text-[#6B7280] hover:bg-[#111317] hover:text-[#A0A7B3] transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button onClick={newLeadFn}
              className="h-7 px-2.5 rounded-md text-[13px] flex items-center gap-1.5 bg-[#5E6AD2] hover:bg-[#6B78E7] text-white transition-colors">
              + New Lead
            </button>

            <button onClick={signOut} title="Sign out"
              className="p-1.5 rounded-md text-[#6B7280] hover:text-[#A0A7B3] hover:bg-[#111317] transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Filter bar */}
        <FilterBar
          search={search}            onSearchChange={setSearch}
          statusFilter={statusFilter} onStatusFilter={setStatusFilter}
          concernFilter={concernFilter} onConcernFilter={setConcernFilter}
          sourceFilter={sourceFilter}   onSourceFilter={setSourceFilter}
          urgency={urgency}            onUrgency={setUrgency}
          sortKey={sortKey}            sortDir={sortDir}
          onSort={(k, d) => { setSortKey(k); setSortDir(d) }}
          leads={leads}
          filteredCount={filteredLeads.length}
          totalCount={leads.length}
        />

        {/* Board / List */}
        <main className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full px-4 pt-3 pb-4"><BoardSkeleton /></div>
          ) : viewMode === 'board' ? (
            <div className="h-full px-3 pt-3 pb-4">
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="h-full grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${STATUSES.length}, minmax(0, 1fr))` }}>
                  {STATUSES.map(status => (
                    <PipelineColumn key={status} status={status} leads={grouped[status] ?? []} totalLeads={filteredLeads.length} />
                  ))}
                </div>
                <DragOverlay>
                  {draggingLead && (
                    <div className="rotate-1 scale-105 opacity-90 shadow-2xl">
                      <LeadCard lead={draggingLead} />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-[#0B0D10] border-b border-white/[0.06] z-10">
                  <tr>
                    <th className="w-6 pl-4 py-2.5" />
                    {['Name', 'Email', 'Status', 'Concern', 'Score', 'SLA', 'Updated'].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 text-left text-[11px] font-semibold text-[#4B5058] uppercase tracking-wider ${
                        i === 1 ? 'hidden sm:table-cell' :
                        i >= 2 && i <= 4 ? 'hidden md:table-cell' :
                        i >= 5 ? 'hidden lg:table-cell' : ''
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0
                    ? <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#6B7280]">No leads match your filters</td></tr>
                    : filteredLeads.map(lead => (
                      <ListRow key={lead.id} lead={lead} onClick={() => router.push(`/leads/${lead.id}`)} />
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* New lead dialog */}
      <Dialog open={chatOpen} onOpenChange={open => { setChatOpen(open); if (!open) fetchLeads() }}>
        <DialogContent className="max-w-md h-[600px] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-white/[0.06]">
            <DialogTitle className="text-[14px] font-semibold">New Lead — Chat with Priya</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ChatWindow leadId={activeLead} onLeadCreated={onLeadCreated} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
