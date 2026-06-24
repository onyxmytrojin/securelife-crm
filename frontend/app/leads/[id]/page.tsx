'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConversationView } from '@/components/dashboard/ConversationView'
import { UploadZone } from '@/components/documents/UploadZone'
import { ExtractedFields } from '@/components/documents/ExtractedFields'
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel'
import { Sidebar } from '@/components/layout/sidebar'
import { StatusIcon, STATUS_LABEL } from '@/components/ui/status-icon'
import { supabase } from '@/lib/supabase'
import { computeScore } from '@/lib/scoring'
import { getUrgency } from '@/lib/urgency'
import { getLeadConcerns } from '@/lib/lead-utils'
import type { LeadWithDetails, LeadStatus } from '@/lib/types'
import { ArrowLeft, MessageSquare, FileText, BarChart3, ChevronDown, Check, ChevronRight, Info, Trash2, Pencil, X } from 'lucide-react'

const ALL_STATUSES: LeadStatus[] = ['new', 'chatting', 'qualified', 'awaiting_docs', 'processing', 'completed', 'rejected']

function ScoreBreakdownPanel({ lead }: { lead: LeadWithDetails }) {
  const breakdown = computeScore(lead)
  const urgency   = getUrgency(lead)

  const gradeColor =
    breakdown.grade === 'A' ? 'text-green-400 bg-green-950/40' :
    breakdown.grade === 'B' ? 'text-blue-400 bg-blue-950/40' :
    breakdown.grade === 'C' ? 'text-amber-400 bg-amber-950/40' :
    'text-[#6B7280] bg-[#1E2028]'

  return (
    <div className="space-y-5">
      {/* Score hero */}
      <div className="flex items-center gap-4 p-4 bg-[#111317] rounded-xl border border-white/[0.07]">
        <div className="relative shrink-0 w-[72px] h-[72px]">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90 absolute inset-0">
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
            <circle cx="36" cy="36" r="28" fill="none"
              stroke={breakdown.total >= 71 ? '#22c55e' : breakdown.total >= 41 ? '#f59e0b' : '#ef4444'}
              strokeWidth="5"
              strokeDasharray={2 * Math.PI * 28}
              strokeDashoffset={2 * Math.PI * 28 * (1 - breakdown.total / 100)}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold tabular-nums ${breakdown.total >= 71 ? 'text-green-400' : breakdown.total >= 41 ? 'text-amber-400' : 'text-red-400'}`}>
              {breakdown.total}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[13px] font-bold px-2 py-0.5 rounded ${gradeColor}`}>Grade {breakdown.grade}</span>
          </div>
          <p className="text-[14px] text-[#A0A7B3] font-medium leading-snug">{breakdown.headline}</p>
          <p className="text-[13px] text-[#5E6AD2] mt-1">{breakdown.recommendation}</p>
        </div>
      </div>

      {/* Factor bars */}
      <div>
        <p className="text-[11px] font-semibold text-[#4B5058] uppercase tracking-widest mb-3">Score Breakdown</p>
        <div className="space-y-4">
          {breakdown.factors.map(f => {
            const pct      = (f.score / f.max) * 100
            const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
            const numColor = pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
            return (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-[#A0A7B3]">{f.label}</span>
                  <span className="tabular-nums">
                    <span className={`text-[13px] font-bold ${numColor}`}>{f.score}</span>
                    <span className="text-[13px] text-[#4B5058]">/{f.max}</span>
                  </span>
                </div>
                <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-[#6B7280] leading-snug">{f.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* SLA urgency */}
      {urgency && (
        <div className={`p-3 rounded-xl border ${urgency.badge}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[13px] font-semibold ${urgency.text}`}>{urgency.level} — {urgency.label} Priority</span>
            <span className={`text-[11px] ${urgency.text} tabular-nums`}>{urgency.hoursInStage}h / {urgency.threshold}h SLA</span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full ${urgency.dot}`} style={{ width: `${Math.min(urgency.pctUsed * 100, 100)}%` }} />
          </div>
          <p className={`text-[11px] ${urgency.text}`}>{urgency.description}</p>
        </div>
      )}
    </div>
  )
}

export default function LeadDetail() {
  const { id }     = useParams<{ id: string }>()
  const router     = useRouter()
  const [lead, setLead]             = useState<LeadWithDetails | null>(null)
  const [loading, setLoading]       = useState(true)
  const [statusOpen, setStatusOpen]       = useState(false)
  const [lastActivityAt, setLastActivityAt] = useState<string | null>(null)
  const [editingNotes, setEditingNotes]   = useState(false)
  const [notesVal, setNotesVal]           = useState('')
  const [notesSaving, setNotesSaving]     = useState(false)
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const notesRef     = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setStatusOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchLead = useCallback(async () => {
    const [{ data: leadData }, { data: convs }, { data: docs }, { data: extractions }, { data: analysis }] =
      await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase.from('conversations').select('*').eq('lead_id', id).order('created_at'),
        supabase.from('documents').select('*').eq('lead_id', id).order('created_at'),
        supabase.from('extracted_data').select('*').eq('lead_id', id),
        supabase.from('analyses').select('*').eq('lead_id', id).single(),
      ])
    if (leadData) {
      setLead({ ...leadData, conversations: convs ?? [], documents: docs ?? [], extracted_data: extractions ?? [], analysis: analysis ?? null })
      // Track the latest conversation message time for stale-analysis detection
      const latest = (convs ?? []).at(-1)?.created_at ?? null
      setLastActivityAt(latest)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchLead() }, [fetchLead])

  // Realtime: watch for new conversation messages + lead profile updates
  useEffect(() => {
    const channel = supabase
      .channel(`lead-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations', filter: `lead_id=eq.${id}` },
        (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new
          const msgTime = newMsg.created_at as string | undefined
          if (msgTime) setLastActivityAt(msgTime)
          setLead(prev => {
            if (!prev) return prev
            const conv = newMsg as unknown as import('@/lib/types').Conversation
            const already = prev.conversations?.some(c => c.id === conv.id)
            if (already) return prev
            return { ...prev, conversations: [...(prev.conversations ?? []), conv] }
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${id}` },
        (payload: { new: Record<string, unknown> }) => {
          // Merge incoming field updates into lead state — properties panel updates instantly
          setLead(prev => prev ? { ...prev, ...(payload.new as Partial<LeadWithDetails>) } : prev)
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [id, supabase])

  const deleteLead = async () => {
    if (!confirm('Delete this lead permanently? This cannot be undone.')) return
    await fetch('/api/leads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    router.push('/')
  }

  const startEditingNotes = () => {
    setNotesVal(lead?.notes ?? '')
    setEditingNotes(true)
    setTimeout(() => { notesRef.current?.focus(); notesRef.current?.select() }, 50)
  }

  const saveNotes = async () => {
    if (!lead) return
    setNotesSaving(true)
    setLead(prev => prev ? { ...prev, notes: notesVal || null } : prev)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: notesVal || null }),
    })
    setNotesSaving(false)
    setEditingNotes(false)
  }

  const changeStatus = async (newStatus: LeadStatus) => {
    if (!lead || lead.status === newStatus) return
    setStatusOpen(false)
    setLead(prev => prev ? { ...prev, status: newStatus } : prev)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  if (loading) return (
    <div className="h-screen flex bg-[#08090B]">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px] text-[#6B7280]">Loading…</div>
      </div>
    </div>
  )
  if (!lead) return (
    <div className="h-screen flex bg-[#08090B]">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-[13px] text-[#6B7280]">Lead not found</div>
      </div>
    </div>
  )

  const initials     = lead.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'
  const score        = computeScore(lead)
  const urgency      = getUrgency(lead)
  const allConcerns  = getLeadConcerns(lead)
  const fmtDate      = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  const fmtIncome    = (n: number) => {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')} Cr`
    if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`
    return `₹${n.toLocaleString('en-IN')}`
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#08090B]">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Breadcrumb */}
        <div className="shrink-0 h-11 border-b border-white/[0.06] bg-[#0B0D10] px-4 flex items-center gap-2">
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-[#A0A7B3] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Pipeline
          </button>
          <ChevronRight className="w-3 h-3 text-[#3A3A3A]" />
          {lead.ticket_number != null && (
            <span className="text-[12px] font-mono font-semibold text-[#4B5058]">
              #{String(lead.ticket_number).padStart(4, '0')}
            </span>
          )}
          <span className="text-[13px] text-[#A0A7B3] font-medium">{lead.name ?? 'Lead'}</span>
          {lead.session_type === 'follow_up' && (
            <span className="text-[10px] font-semibold px-1.5 py-px rounded border border-amber-800/50 bg-amber-950/30 text-amber-400 uppercase tracking-wide">
              Follow-up
            </span>
          )}

          {/* Quick status change + delete */}
          <div className="flex items-center gap-2 ml-auto">
            {lead.status === 'new' && (
              <button onClick={() => changeStatus('chatting')}
                className="h-7 px-3 rounded-lg text-[13px] border border-white/[0.08] text-[#A0A7B3] hover:bg-[#171A1F] transition-colors">
                Start Chat →
              </button>
            )}
            {lead.status === 'qualified' && (
              <button onClick={() => changeStatus('awaiting_docs')}
                className="h-7 px-3 rounded-lg text-[13px] border border-white/[0.08] text-[#A0A7B3] hover:bg-[#171A1F] transition-colors">
                Request Docs →
              </button>
            )}
            {lead.status === 'awaiting_docs' && (
              <button onClick={() => changeStatus('processing')}
                className="h-7 px-3 rounded-lg text-[13px] border border-white/[0.08] text-[#A0A7B3] hover:bg-[#171A1F] transition-colors">
                Mark Received →
              </button>
            )}
            {lead.status === 'processing' && (
              <button onClick={() => changeStatus('completed')}
                className="h-7 px-3 rounded-lg text-[13px] bg-[#5E6AD2] hover:bg-[#6B78E7] text-white border-0 transition-colors">
                Complete →
              </button>
            )}
            <button
              onClick={() => void deleteLead()}
              title="Delete lead"
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/[0.06] text-[#6B7280] hover:border-red-900/60 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Lead header */}
        <div className="shrink-0 border-b border-white/[0.06] bg-[#0B0D10] px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#5E6AD2] text-white flex items-center justify-center text-[14px] font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[18px] font-semibold text-[#F7F8FA]">{lead.name ?? 'Unknown'}</h1>
                {lead.ticket_number != null && (
                  <span className="text-[12px] font-mono text-[#4B5058] mt-0.5">#{String(lead.ticket_number).padStart(4, '0')}</span>
                )}
                {lead.session_type === 'follow_up' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-800/50 bg-amber-950/30 text-amber-400 uppercase tracking-wide mt-0.5">
                    Follow-up
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[13px] text-[#6B7280]">
                {lead.email && <span>{lead.email}</span>}
                {lead.phone && <span>{lead.phone}</span>}
                <span className="text-[#2A2A2A]">·</span>
                <span>Created {fmtDate(lead.created_at)}</span>
                <span>Updated {fmtDate(lead.updated_at)}</span>

                {/* Status dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button onClick={() => setStatusOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/[0.08] text-[13px] font-medium text-[#A0A7B3] hover:bg-[#171A1F] transition-colors">
                    <StatusIcon status={lead.status} size={12} />
                    {STATUS_LABEL[lead.status]}
                    <ChevronDown className={`w-3 h-3 text-[#6B7280] transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {statusOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-[#16181D] border border-white/[0.08] rounded-xl z-50 py-1 overflow-hidden
                      animate-in fade-in-0 zoom-in-95 duration-150">
                      {ALL_STATUSES.map(s => (
                        <button key={s} onClick={() => changeStatus(s)}
                          className="w-full flex items-center gap-2 px-3 h-8 text-[13px] hover:bg-[#1C2026] transition-colors">
                          <StatusIcon status={s} size={12} />
                          <span className={lead.status === s ? 'text-[#F7F8FA] font-semibold flex-1' : 'text-[#A0A7B3] flex-1'}>
                            {STATUS_LABEL[s]}
                          </span>
                          {lead.status === s && <Check className="w-3 h-3 text-[#5E6AD2]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {urgency && urgency.level !== 'P3' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${urgency.badge} ${urgency.text}`}>
                    {urgency.level} · {urgency.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Properties sidebar */}
          <div className="w-60 shrink-0 border-r border-white/[0.06] overflow-y-auto bg-[#0B0D10]">
            <div className="px-4 py-4 space-y-4">

              {/* Insurance interests — chips */}
              {allConcerns.length > 0 && (
                <div className="pb-4 border-b border-white/[0.05]">
                  <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest mb-2">Insurance Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allConcerns.map(c => (
                      <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-[#5E6AD2]/10 text-[#8B97E8] border border-[#5E6AD2]/20 capitalize font-medium">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial profile */}
              {(lead.annual_income || lead.occupation) && (
                <div className="pb-4 border-b border-white/[0.05] space-y-3">
                  <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Financial Profile</p>
                  {lead.annual_income && (
                    <div>
                      <p className="text-[11px] text-[#6B7280] mb-0.5">Annual Income</p>
                      <p className="text-[15px] font-semibold text-[#F7F8FA]">{fmtIncome(Number(lead.annual_income))}</p>
                      <p className="text-[11px] text-[#4B5058]">₹{Number(lead.annual_income).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                  {lead.occupation && (
                    <div>
                      <p className="text-[11px] text-[#6B7280] mb-0.5">Occupation</p>
                      <p className="text-[13px] font-medium text-[#A0A7B3] leading-snug">{lead.occupation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Personal details */}
              {(lead.age != null || lead.family_size != null || lead.location || lead.existing_coverage) && (
                <div className="pb-4 border-b border-white/[0.05] space-y-2">
                  <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Personal Details</p>
                  {[
                    ['Age',              lead.age != null ? `${lead.age} yrs` : null],
                    ['Family',           lead.family_size != null ? `${lead.family_size} member${Number(lead.family_size) !== 1 ? 's' : ''}` : null],
                    ['Location',         lead.location],
                    ['Existing Cover',   lead.existing_coverage],
                  ].filter(([, v]) => v != null).map(([label, value]) => (
                    <div key={String(label)} className="flex items-start justify-between gap-2">
                      <span className="text-[12px] text-[#6B7280] shrink-0">{label}</span>
                      <span className="text-[12px] font-medium text-[#A0A7B3] text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Source */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#4B5058] uppercase tracking-widest font-semibold">Source</span>
                <span className="text-[12px] text-[#6B7280] capitalize">{lead.source ?? '—'}</span>
              </div>

              {/* Notes — editable by broker */}
              <div className="pb-4 border-b border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Broker Notes</p>
                  {!editingNotes && (
                    <button onClick={startEditingNotes}
                      className="flex items-center gap-1 text-[11px] text-[#6B7280] hover:text-[#5E6AD2] transition-colors">
                      <Pencil className="w-3 h-3" />{lead.notes ? 'Edit' : 'Add note'}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      ref={notesRef}
                      value={notesVal}
                      onChange={e => setNotesVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingNotes(false) }}
                      rows={4}
                      placeholder="Add internal notes about this lead…"
                      className="w-full bg-[#111317] border border-[#5E6AD2]/30 rounded-lg px-3 py-2
                        text-[12px] text-[#E8EAF0] placeholder:text-[#3A3A3A] resize-none
                        focus:outline-none focus:border-[#5E6AD2]/60 transition-colors leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveNotes()}
                        disabled={notesSaving}
                        className="flex-1 text-[12px] py-1.5 rounded-lg bg-[#5E6AD2] hover:bg-[#6B78E7]
                          text-white font-medium disabled:opacity-50 transition-colors"
                      >
                        {notesSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="w-8 flex items-center justify-center rounded-lg border border-white/[0.08]
                          text-[#6B7280] hover:text-[#A0A7B3] transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : lead.notes ? (
                  <p className="text-[12px] text-[#A0A7B3] leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
                ) : (
                  <p className="text-[12px] text-[#3A3A3A] italic">No notes yet</p>
                )}
              </div>

              {/* Score */}
              <div>
                <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest mb-2">Score</p>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${score.total >= 71 ? 'bg-green-500' : score.total >= 41 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${score.total}%` }} />
                  </div>
                  <span className="text-[13px] font-bold text-[#F7F8FA] tabular-nums">{score.total}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-px rounded ${
                    score.grade === 'A' ? 'bg-green-950/60 text-green-400' :
                    score.grade === 'B' ? 'bg-blue-950/60 text-blue-400' :
                    score.grade === 'C' ? 'bg-amber-950/60 text-amber-400' :
                    'bg-[#1E2028] text-[#6B7280]'
                  }`}>{score.grade}</span>
                </div>
                <p className="text-[11px] text-[#6B7280] flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />See Score tab for breakdown
                </p>
              </div>

            </div>
          </div>

          {/* Right — tabs */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#08090B]">
            <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 border-b border-white/[0.06] px-6 bg-[#0B0D10]">
                <TabsList className="h-10 bg-transparent p-0 gap-0">
                  {[
                    { value: 'chat',     icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Conversation', badge: lead.conversations?.length },
                    { value: 'docs',     icon: <FileText className="w-3.5 h-3.5" />,     label: 'Documents' },
                    { value: 'analysis', icon: <BarChart3 className="w-3.5 h-3.5" />,    label: 'Analysis',    extra: 'Broker only' },
                    { value: 'score',    icon: <Info className="w-3.5 h-3.5" />,         label: 'Score' },
                  ].map(({ value, icon, label, badge, extra }) => (
                    <TabsTrigger key={value} value={value}
                      className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-[#5E6AD2] data-[state=active]:text-[#F7F8FA] text-[13px] text-[#6B7280] bg-transparent px-3 flex items-center gap-1.5">
                      {icon}{label}
                      {badge != null && badge > 0 && (
                        <span className="text-[10px] bg-[#1E2028] text-[#A0A7B3] rounded-full px-1.5 py-px">{badge}</span>
                      )}
                      {extra && <span className="text-[10px] bg-amber-950/40 text-amber-400 rounded px-1.5 py-px font-medium">{extra}</span>}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="chat"     className="flex-1 overflow-y-auto m-0 px-6 py-4">
                <ConversationView leadId={id} conversations={lead.conversations ?? []} />
              </TabsContent>
              <TabsContent value="docs"     className="flex-1 overflow-y-auto m-0 px-6 py-4 flex flex-col gap-4">
                <UploadZone leadId={id} onSuccess={fetchLead} />
                {(lead.extracted_data ?? []).length > 0
                  ? lead.extracted_data!.map(e => <ExtractedFields key={e.id} data={e} />)
                  : <p className="text-[13px] text-[#6B7280] text-center py-6">No documents uploaded yet</p>}
              </TabsContent>
              <TabsContent value="analysis" className="flex-1 overflow-y-auto m-0 px-6 py-4">
                <AnalysisPanel leadId={id} existing={lead.analysis ?? null} lastActivityAt={lastActivityAt} />
              </TabsContent>
              <TabsContent value="score"    className="flex-1 overflow-y-auto m-0 px-6 py-6">
                <ScoreBreakdownPanel lead={lead} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
