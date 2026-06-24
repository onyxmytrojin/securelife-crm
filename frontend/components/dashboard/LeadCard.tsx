'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Lead, LeadStatus } from '@/lib/types'
import Link from 'next/link'
import { computeScore } from '@/lib/scoring'
import { getUrgency } from '@/lib/urgency'
import { getLeadConcerns, formatLeadConcerns } from '@/lib/lead-utils'
import { StatusIcon } from '@/components/ui/status-icon'
import { Trash2, ExternalLink } from 'lucide-react'

export const STALE_HOURS: Partial<Record<LeadStatus, number>> = {
  new: 24, qualified: 48, awaiting_docs: 72, processing: 24,
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function ScoreArc({ pct }: { pct: number }) {
  const r     = 7
  const c     = 2 * Math.PI * r
  const color = pct >= 71 ? '#22c55e' : pct >= 41 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round" />
    </svg>
  )
}

export function getStaleness(lead: Lead) {
  const t = STALE_HOURS[lead.status]
  if (!t) return { level: null as null, hoursStale: 0 }
  const h = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 3600000)
  if (h >= t)       return { level: 'urgent'  as const, hoursStale: h }
  if (h >= t * 0.6) return { level: 'warning' as const, hoursStale: h }
  return { level: null as null, hoursStale: 0 }
}

export function LeadCard({ lead, onDelete }: { lead: Lead; onDelete?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   lead.id,
    data: { status: lead.status },
  })
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging ? 0.25 : 1,
    cursor:    isDragging ? 'grabbing' : 'grab',
  }

  const urgency  = getUrgency(lead)
  const score    = computeScore(lead)
  const concerns = formatLeadConcerns(lead)
  const pctUsed  = urgency ? Math.min(urgency.pctUsed * 100, 100) : 0
  const slaColor =
    !urgency               ? '' :
    urgency.level === 'P0' ? 'bg-red-500' :
    urgency.level === 'P1' ? 'bg-orange-500' :
    urgency.level === 'P2' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div
      ref={setNodeRef} style={style} {...listeners} {...attributes}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY }) }}
    >
      <Link href={`/leads/${lead.id}`} onClick={e => isDragging && e.preventDefault()}>
        <div className="
          bg-[#111317] border border-white/[0.07] rounded-xl select-none overflow-hidden
          hover:bg-[#151821] hover:border-white/[0.12] hover:-translate-y-px
          transition-all duration-150 shadow-none
        ">
          <div className="px-3 pt-2.5 pb-2 space-y-1.5">
            {/* Row 0: ticket number + follow-up badge */}
            <div className="flex items-center gap-1.5">
              {lead.ticket_number != null && (
                <span className="text-[10px] font-mono font-semibold text-[#4B5058]">
                  #{String(lead.ticket_number).padStart(4, '0')}
                </span>
              )}
              {lead.session_type === 'follow_up' && (
                <span className="text-[9px] font-semibold px-1.5 py-px rounded border border-amber-800/50 bg-amber-950/30 text-amber-400 uppercase tracking-wide">
                  Follow-up
                </span>
              )}
            </div>

            {/* Row 1: status icon + name + urgency */}
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <StatusIcon status={lead.status} size={12} />
                <span className="text-[13px] font-medium text-[#F7F8FA] truncate">
                  {lead.name ?? 'Unknown'}
                </span>
              </div>
              {urgency && urgency.level !== 'P3' && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${urgency.badge} ${urgency.text}`}>
                  {urgency.level}
                </span>
              )}
            </div>

            {/* Row 2: email */}
            {(lead.email || lead.phone) && (
              <p className="text-[11px] text-[#6B7280] truncate pl-[18px]">
                {lead.email ?? lead.phone}
              </p>
            )}

            {/* Row 3: concern pill + score */}
            <div className="flex items-center justify-between pl-[18px] gap-2">
              {concerns !== '—' ? (
                <span className="text-[11px] bg-[#0F1115] border border-white/[0.06] text-[#6B7280] rounded-full px-2 py-px truncate" title={concerns}>
                  {concerns}
                </span>
              ) : <span />}
              <div className="flex items-center gap-1 shrink-0">
                <ScoreArc pct={score.total} />
                <span className="text-[10px] text-[#6B7280] tabular-nums font-medium">{score.total}</span>
              </div>
            </div>
          </div>

          {/* SLA bar */}
          {urgency && (
            <div className="mx-3 mb-1 h-px bg-white/[0.05] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${slaColor} transition-all`} style={{ width: `${pctUsed}%` }} />
            </div>
          )}

          {/* Footer: dates */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1 text-[10px] text-[#4B5058]">
            <span>{fmtDate(lead.created_at)}</span>
            <span>{fmtDate(lead.updated_at)}</span>
          </div>
        </div>
      </Link>

      {/* Right-click context menu */}
      {menu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999 }}
          className="bg-[#16181D] border border-white/[0.08] rounded-xl py-1 min-w-[160px] shadow-2xl
            animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <button
            onClick={e => { e.stopPropagation(); setMenu(null); window.location.href = `/leads/${lead.id}` }}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-[#A0A7B3] hover:bg-[#1C2026] transition-colors text-left"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />Open lead
          </button>
          <div className="border-t border-white/[0.05] my-1" />
          <button
            onClick={e => { e.stopPropagation(); setMenu(null); onDelete?.(lead.id) }}
            className="w-full flex items-center gap-2.5 px-3 h-8 text-[13px] text-red-400 hover:bg-red-950/30 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />Delete lead
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
