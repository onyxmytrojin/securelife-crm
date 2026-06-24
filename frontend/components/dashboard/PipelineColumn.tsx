'use client'
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { LeadCard } from './LeadCard'
import { StatusIcon, STATUS_LABEL } from '@/components/ui/status-icon'
import type { Lead, LeadStatus } from '@/lib/types'
import { Plus, MoreHorizontal } from 'lucide-react'

const COLUMN_ACCENT: Record<LeadStatus, string> = {
  new:           '#3b82f6',
  chatting:      '#eab308',
  qualified:     '#a855f7',
  awaiting_docs: '#f97316',
  processing:    '#06b6d4',
  completed:     '#22c55e',
  rejected:      '#f87171',
}

export function PipelineColumn({ status, leads, totalLeads }: {
  status:     LeadStatus
  leads:      Lead[]
  totalLeads: number
}) {
  const accent                  = COLUMN_ACCENT[status]
  const { setNodeRef, isOver }  = useDroppable({ id: status })
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-0.5 mb-2 shrink-0 group">
        <StatusIcon status={status} size={13} />
        <span className="text-[12px] font-semibold text-[#A0A7B3] flex-1 truncate">
          {STATUS_LABEL[status]}
        </span>
        <span className="text-[11px] text-[#4B5058] tabular-nums">{leads.length}</span>
        {/* Actions (appear on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-5 h-5 rounded flex items-center justify-center text-[#6B7280] hover:text-[#A0A7B3] hover:bg-[#1C2026] transition-colors"
            title={`Add to ${STATUS_LABEL[status]}`}
          >
            <Plus className="w-3 h-3" />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-5 h-5 rounded flex items-center justify-center text-[#6B7280] hover:text-[#A0A7B3] hover:bg-[#1C2026] transition-colors"
              title="Column options"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#16181D] border border-white/[0.08] rounded-xl py-1 min-w-[140px] overflow-hidden">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left px-3 h-8 text-[13px] text-[#A0A7B3] hover:bg-[#1C2026] transition-colors"
                >
                  {leads.length} leads in {STATUS_LABEL[status]}
                </button>
                {totalLeads > 0 && (
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-3 h-8 text-[13px] text-[#A0A7B3] hover:bg-[#1C2026] transition-colors"
                  >
                    {Math.round((leads.length / totalLeads) * 100)}% of pipeline
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 overflow-y-auto flex flex-col gap-1.5 rounded-xl p-1.5 min-h-[60px]
          border transition-all duration-150
          ${isOver
            ? 'border-[rgba(255,255,255,0.15)] bg-[#111317] ring-1'
            : 'border-white/[0.06] bg-transparent'
          }
        `}
        style={isOver ? { '--tw-ring-color': accent + '40', boxShadow: `0 0 0 1px ${accent}30` } as React.CSSProperties : {}}
        onClick={() => setMenuOpen(false)}
      >
        {leads.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-3 text-center text-[12px] transition-colors ${
            isOver
              ? 'border-white/20 text-[#6B7280]'
              : 'border-white/[0.05] text-[#3A3A3A]'
          }`}>
            {isOver ? '↓ Drop here' : 'No leads'}
          </div>
        ) : (
          leads.map(lead => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  )
}
