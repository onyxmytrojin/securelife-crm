'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Plus, X, Check, ChevronRight, ArrowUpDown } from 'lucide-react'
import { StatusIcon, STATUS_LABEL } from '@/components/ui/status-icon'
import type { Lead, LeadStatus } from '@/lib/types'

const ALL_STATUSES: LeadStatus[] = ['new', 'chatting', 'qualified', 'awaiting_docs', 'processing', 'completed', 'rejected']

export type SortKey = 'updated_at' | 'created_at' | 'score'
export type SortDir = 'asc' | 'desc'
export type UrgencyFilter = 'all' | 'overdue' | 'stale'

const SORT_LABELS: Record<SortKey, string> = {
  updated_at: 'Updated',
  created_at: 'Created',
  score:      'Score',
}

const FILTER_TYPES = [
  { id: 'status',  label: 'Status' },
  { id: 'concern', label: 'Concerns' },
  { id: 'source',  label: 'Source' },
  { id: 'urgency', label: 'Priority' },
] as const

type FilterType = typeof FILTER_TYPES[number]['id']

interface FilterBarProps {
  search: string
  onSearchChange: (s: string) => void
  statusFilter:  LeadStatus[]
  onStatusFilter: (s: LeadStatus[]) => void
  concernFilter: string[]
  onConcernFilter: (c: string[]) => void
  sourceFilter:  string[]
  onSourceFilter: (s: string[]) => void
  urgency:       UrgencyFilter
  onUrgency:     (u: UrgencyFilter) => void
  sortKey:       SortKey
  sortDir:       SortDir
  onSort:        (key: SortKey, dir: SortDir) => void
  leads:         Lead[]
  filteredCount: number
  totalCount:    number
}

function MenuPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#16181D] border border-white/[0.08] rounded-xl overflow-hidden min-w-[180px] py-1
      animate-in fade-in-0 zoom-in-95 duration-150">
      {children}
    </div>
  )
}

function MenuItem({ label, active, onClick, onHover, icon, hasChevron }: {
  label: string
  active?: boolean
  onClick?: () => void
  onHover?: () => void
  icon?: React.ReactNode
  hasChevron?: boolean
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-2 px-3 h-8 text-[13px] text-left transition-colors hover:bg-[#1C2026]
        ${active ? 'text-[#F7F8FA]' : 'text-[#A0A7B3]'}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {active && !hasChevron && <Check className="w-3 h-3 shrink-0 text-[#5E6AD2]" />}
      {hasChevron && <ChevronRight className="w-3 h-3 shrink-0 text-[#6B7280]" />}
    </button>
  )
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 h-6 rounded-md text-[12px] font-medium
      bg-[#5E6AD2]/15 text-[#7C7CFF] border border-[#5E6AD2]/25">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors rounded p-0.5 hover:bg-[#5E6AD2]/20">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  )
}

export function FilterBar({
  search, onSearchChange,
  statusFilter, onStatusFilter,
  concernFilter, onConcernFilter,
  sourceFilter, onSourceFilter,
  urgency, onUrgency,
  sortKey, sortDir, onSort,
  leads, filteredCount, totalCount,
}: FilterBarProps) {
  const [filterOpen, setFilterOpen]     = useState(false)
  const [activeType, setActiveType]     = useState<FilterType | null>(null)
  const [sortOpen, setSortOpen]         = useState(false)
  const [sortHover, setSortHover]       = useState<SortKey | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const sortRef   = useRef<HTMLDivElement>(null)

  // Derived options from live data
  const concerns = Array.from(new Set(leads.flatMap(l => [...(l.concerns ?? []), l.primary_concern].filter(Boolean)))) as string[]
  const sources  = Array.from(new Set(leads.map(l => l.source).filter(Boolean))) as string[]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false); setActiveType(null)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false); setSortHover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleStatus  = (s: LeadStatus) => onStatusFilter(statusFilter.includes(s) ? statusFilter.filter(x => x !== s) : [...statusFilter, s])
  const toggleConcern = (c: string)     => onConcernFilter(concernFilter.includes(c) ? concernFilter.filter(x => x !== c) : [...concernFilter, c])
  const toggleSource  = (s: string)     => onSourceFilter(sourceFilter.includes(s) ? sourceFilter.filter(x => x !== s) : [...sourceFilter, s])

  const handleSort = (key: SortKey, dir: SortDir) => {
    onSort(key, dir)
    setSortOpen(false)
    setSortHover(null)
  }

  // Active filter count (for display)
  const hasFilters = statusFilter.length > 0 || concernFilter.length > 0 || sourceFilter.length > 0 || urgency !== 'all'
  const clearAll   = () => {
    onStatusFilter([]); onConcernFilter([]); onSourceFilter([]); onUrgency('all')
    setFilterOpen(false); setActiveType(null)
  }

  return (
    <div className="shrink-0 border-b border-white/[0.06] px-4 py-2 flex items-center gap-2 bg-[#08090B] flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
        <input
          type="text"
          placeholder="Search leads…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="h-7 pl-7 pr-3 text-[13px] bg-[#111317] border border-white/[0.08] rounded-lg w-40
            focus:outline-none focus:border-[#5E6AD2]/50 focus:ring-0
            placeholder:text-[#4B5058] text-[#A0A7B3] transition-colors"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#A0A7B3]">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Active filter pills */}
      {statusFilter.map(s => (
        <FilterPill key={s} label={STATUS_LABEL[s]} onRemove={() => onStatusFilter(statusFilter.filter(x => x !== s))} />
      ))}
      {concernFilter.map(c => (
        <FilterPill key={c} label={c} onRemove={() => onConcernFilter(concernFilter.filter(x => x !== c))} />
      ))}
      {sourceFilter.map(s => (
        <FilterPill key={s} label={s} onRemove={() => onSourceFilter(sourceFilter.filter(x => x !== s))} />
      ))}
      {urgency !== 'all' && (
        <FilterPill
          label={urgency === 'overdue' ? 'Overdue' : 'Stale'}
          onRemove={() => onUrgency('all')}
        />
      )}

      {/* + Filter button (cascading) */}
      <div className="relative" ref={filterRef}>
        <button
          onClick={() => { setFilterOpen(v => !v); setActiveType(null) }}
          className={`h-7 px-2.5 rounded-lg text-[13px] flex items-center gap-1.5 border transition-colors
            ${filterOpen
              ? 'bg-[#16181D] border-white/[0.12] text-[#F7F8FA]'
              : 'border-white/[0.08] text-[#6B7280] hover:bg-[#111317] hover:text-[#A0A7B3]'
            }`}
        >
          <Plus className="w-3 h-3" />Filter
        </button>

        {filterOpen && (
          <div className="absolute top-full left-0 mt-1.5 z-50 flex gap-0">
            {/* Left panel — filter types */}
            <MenuPanel>
              {FILTER_TYPES.map(ft => (
                <MenuItem
                  key={ft.id}
                  label={ft.label}
                  active={activeType === ft.id}
                  onHover={() => setActiveType(ft.id)}
                  onClick={() => setActiveType(activeType === ft.id ? null : ft.id)}
                  hasChevron
                />
              ))}
              {hasFilters && (
                <>
                  <div className="my-1 border-t border-white/[0.05]" />
                  <MenuItem label="Clear all filters" onClick={clearAll} />
                </>
              )}
            </MenuPanel>

            {/* Right panel — filter options */}
            {activeType === 'status' && (
              <MenuPanel>
                {ALL_STATUSES.map(s => (
                  <MenuItem
                    key={s}
                    label={STATUS_LABEL[s]}
                    active={statusFilter.includes(s)}
                    onClick={() => toggleStatus(s)}
                    icon={<StatusIcon status={s} size={13} />}
                  />
                ))}
              </MenuPanel>
            )}

            {activeType === 'concern' && (
              <MenuPanel>
                {concerns.length === 0
                  ? <p className="px-3 py-2 text-[12px] text-[#6B7280]">No concerns in data</p>
                  : concerns.map(c => (
                    <MenuItem key={c} label={c} active={concernFilter.includes(c)} onClick={() => toggleConcern(c)} />
                  ))}
              </MenuPanel>
            )}

            {activeType === 'source' && (
              <MenuPanel>
                {sources.length === 0
                  ? <p className="px-3 py-2 text-[12px] text-[#6B7280]">No sources in data</p>
                  : sources.map(s => (
                    <MenuItem key={s} label={s} active={sourceFilter.includes(s)} onClick={() => toggleSource(s)} />
                  ))}
              </MenuPanel>
            )}

            {activeType === 'urgency' && (
              <MenuPanel>
                {([['all', 'All leads'], ['overdue', 'Overdue (SLA breached)'], ['stale', 'Stale (approaching SLA)']] as const).map(([u, label]) => (
                  <MenuItem key={u} label={label} active={urgency === u} onClick={() => { onUrgency(u); setFilterOpen(false); setActiveType(null) }} />
                ))}
              </MenuPanel>
            )}
          </div>
        )}
      </div>

      {/* Sort — cascading */}
      <div className="relative ml-auto" ref={sortRef}>
        <button
          onClick={() => { setSortOpen(v => !v); setSortHover(null) }}
          className={`h-7 px-2.5 rounded-lg text-[13px] flex items-center gap-1.5 border transition-colors
            ${sortOpen
              ? 'bg-[#16181D] border-white/[0.12] text-[#F7F8FA]'
              : 'border-white/[0.08] text-[#6B7280] hover:bg-[#111317] hover:text-[#A0A7B3]'
            }`}
        >
          <ArrowUpDown className="w-3 h-3" />
          {SORT_LABELS[sortKey]} {sortDir === 'desc' ? '↓' : '↑'}
        </button>

        {sortOpen && (
          <div className="absolute top-full right-0 mt-1.5 z-50 flex gap-0">
            {/* Left — sort fields */}
            <MenuPanel>
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                <MenuItem
                  key={key}
                  label={label}
                  active={sortKey === key}
                  onHover={() => setSortHover(key)}
                  onClick={() => {
                    if (sortKey === key) { onSort(key, sortDir === 'desc' ? 'asc' : 'desc'); setSortOpen(false) }
                    else { setSortHover(key) }
                  }}
                  hasChevron={sortKey !== key}
                />
              ))}
            </MenuPanel>

            {/* Right — direction (shows for hovered/active field) */}
            {(sortHover || sortKey) && (
              <MenuPanel>
                {(['desc', 'asc'] as SortDir[]).map(dir => (
                  <MenuItem
                    key={dir}
                    label={dir === 'desc' ? '↓ Descending' : '↑ Ascending'}
                    active={sortKey === (sortHover ?? sortKey) && sortDir === dir}
                    onClick={() => handleSort(sortHover ?? sortKey, dir)}
                  />
                ))}
              </MenuPanel>
            )}
          </div>
        )}
      </div>

      {/* Count */}
      {filteredCount !== totalCount && (
        <span className="text-[12px] text-[#6B7280] tabular-nums whitespace-nowrap">
          {filteredCount} / {totalCount}
        </span>
      )}
    </div>
  )
}
