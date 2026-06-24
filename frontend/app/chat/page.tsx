'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { createClient } from '@/lib/supabase-browser'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LogOut, MessageSquare, User, FileText, CheckCircle, Clock,
  Loader2, AlertCircle, Plus, ArrowLeft, HelpCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Lead, Document } from '@/lib/types'
import { buildFollowUpWelcomeMessage } from '@/lib/prompts'

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; cta?: string }> = {
  new:           { label: 'Inquiry received — chat with Aria to get started', icon: Clock, color: 'text-[#6B7280]' },
  chatting:      { label: 'In conversation with Aria', icon: MessageSquare, color: 'text-amber-400' },
  qualified:     { label: 'Profile complete — upload your existing policy documents so we can review your coverage', icon: FileText, color: 'text-[#5E6AD2]', cta: 'documents' },
  awaiting_docs: { label: 'Awaiting your documents — upload them in the Documents tab to proceed', icon: AlertCircle, color: 'text-orange-400', cta: 'documents' },
  processing:    { label: 'Your documents are being reviewed by our team', icon: Loader2, color: 'text-cyan-400' },
  completed:     { label: 'Review complete — your advisor will be in touch shortly', icon: CheckCircle, color: 'text-green-400' },
  rejected:      { label: 'Application closed', icon: Clock, color: 'text-[#6B7280]' },
}

const SESSION_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  new:           { label: 'New',          color: 'text-[#6B7280]',   dot: 'bg-[#6B7280]' },
  chatting:      { label: 'In progress',  color: 'text-amber-400',   dot: 'bg-amber-400' },
  qualified:     { label: 'Qualified',    color: 'text-[#5E6AD2]',   dot: 'bg-[#5E6AD2]' },
  awaiting_docs: { label: 'Docs needed',  color: 'text-orange-400',  dot: 'bg-orange-400' },
  processing:    { label: 'Processing',   color: 'text-cyan-400',    dot: 'bg-cyan-400' },
  completed:     { label: 'Completed',    color: 'text-green-400',   dot: 'bg-green-400' },
  rejected:      { label: 'Closed',       color: 'text-[#6B7280]',   dot: 'bg-[#6B7280]' },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <p className="text-[12px] text-[#6B7280] shrink-0">{label}</p>
      <p className="text-[13px] font-medium text-right max-w-[60%]">
        {value != null && value !== ''
          ? <span className="text-[#A0A7B3]">{String(value)}</span>
          : <span className="text-[#3A3A3A]">—</span>}
      </p>
    </div>
  )
}

function SessionItem({ session, index, total, isActive, onClick }: {
  session: Lead; index: number; total: number; isActive: boolean; onClick: () => void
}) {
  const meta  = SESSION_STATUS[session.status] ?? SESSION_STATUS.new
  const topic = session.concerns?.length
    ? session.concerns.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
    : session.primary_concern
      ? session.primary_concern.charAt(0).toUpperCase() + session.primary_concern.slice(1)
      : 'Insurance enquiry'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-2.5 py-2 transition-all ${
        isActive
          ? 'bg-[#5E6AD2]/12 border border-[#5E6AD2]/30'
          : 'hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
        <span className="text-[12px] font-medium text-[#A0A7B3] truncate flex-1">
          {session.ticket_number != null
            ? `#${String(session.ticket_number).padStart(4, '0')}`
            : `Session #${total - index}`}
        </span>
        {session.session_type === 'follow_up' && (
          <span className="text-[9px] font-semibold px-1 py-px rounded border border-amber-800/40 bg-amber-950/30 text-amber-400 shrink-0">FU</span>
        )}
      </div>
      <p className="text-[11px] text-[#6B7280] truncate pl-3.5">{topic}</p>
      <p className={`text-[11px] font-medium pl-3.5 mt-0.5 ${meta.color}`}>{meta.label}</p>
    </button>
  )
}

export default function CustomerChatPage() {
  const [leadId, setLeadId]         = useState<string | null>(null)
  const [lead, setLead]             = useState<Lead | null>(null)
  const [sessions, setSessions]     = useState<Lead[]>([])
  const [documents, setDocuments]   = useState<Document[]>([])
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null)
  const [activeTab, setActiveTab]   = useState('chat')

  // Name prompt
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput]   = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Session type modal
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionModalStep, setSessionModalStep] = useState<'choose' | 'pick-parent'>('choose')
  const [pendingParentId, setPendingParentId]   = useState<string | null>(null)

  const router   = useRouter()
  const supabase = createClient()

  const fetchSessions = useCallback(async (email: string) => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setSessions(data as Lead[])
      const active = (data as Lead[]).find(l => l.status !== 'completed' && l.status !== 'rejected')
               ?? (data as Lead[])[0]
      setLeadId(active.id)
      setLead(active)
    }
  }, [supabase])

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const authEmail = user.email ?? ''
      const { data: p } = await supabase.from('profiles').select('name, email').eq('id', user.id).single()
      const profileName  = (p as { name?: string; email?: string } | null)?.name  || user.user_metadata?.full_name || user.user_metadata?.name || ''
      const profileEmail = (p as { name?: string; email?: string } | null)?.email || authEmail
      const emailPrefix  = profileEmail.split('@')[0]
      if (!profileName || profileName === emailPrefix) setShowNamePrompt(true)
      setUserProfile({ name: profileName, email: profileEmail })
      if (profileEmail) fetchSessions(profileEmail)
    })()
  }, [fetchSessions])

  useEffect(() => {
    if (showNamePrompt) setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [showNamePrompt])

  const saveUserName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || !userProfile) return
    setNameSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ name: trimmed }).eq('id', user.id)
    setUserProfile(prev => prev ? { ...prev, name: trimmed } : prev)
    setShowNamePrompt(false)
    setNameSaving(false)
  }

  const fetchLeadData = useCallback(async (id: string) => {
    const [{ data: l }, { data: docs }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('lead_id', id).order('created_at'),
    ])
    if (l) { setLead(l as Lead); setSessions(prev => prev.map(s => s.id === id ? l as Lead : s)) }
    if (docs) setDocuments(docs)
  }, [supabase])

  const switchSession = (s: Lead) => {
    setLeadId(s.id)
    setLead(s)
    setDocuments([])
    setActiveTab('chat')
    fetchLeadData(s.id)
  }

  // Called when user wants a new session
  const requestNewSession = () => {
    if (sessions.length > 0) {
      setSessionModalStep('choose')
      setShowSessionModal(true)
    } else {
      startBlankSession()
    }
  }

  const startBlankSession = () => {
    setShowSessionModal(false)
    setPendingParentId(null)
    setLeadId(null)
    setLead(null)
    setDocuments([])
    setActiveTab('chat')
  }

  const startFollowUp = (parentId: string) => {
    setShowSessionModal(false)
    setPendingParentId(parentId)
    setLeadId(null)
    setLead(null)
    setDocuments([])
    setActiveTab('chat')
  }

  const onLeadCreated = (id: string) => {
    setLeadId(id)
    fetchLeadData(id)
    setSessions(prev => {
      if (prev.some(s => s.id === id)) return prev
      return [{ id, status: 'chatting', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source: 'chatbot', parent_lead_id: pendingParentId, session_type: pendingParentId ? 'follow_up' : 'new_inquiry' } as Lead, ...prev]
    })
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  const statusMeta = lead ? (STATUS_META[lead.status] ?? STATUS_META.new) : null
  const concerns   = lead?.concerns?.length
    ? lead.concerns
    : lead?.primary_concern ? [lead.primary_concern] : []

  const isDisabled = lead?.status === 'completed' || lead?.status === 'rejected'

  // Build welcome message for follow-up sessions
  const followUpWelcome = pendingParentId
    ? (() => {
        const parent = sessions.find(s => s.id === pendingParentId)
        const topic  = parent?.concerns?.slice(0, 2).join(' & ') || parent?.primary_concern || 'insurance'
        return buildFollowUpWelcomeMessage(userProfile?.name ?? null, topic)
      })()
    : undefined

  return (
    <div className="h-screen bg-[#08090B] flex flex-col overflow-hidden">

      {/* ── Name prompt modal ── */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0B0D10] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-[#5E6AD2]/20 flex items-center justify-center mb-4">
              <User className="w-5 h-5 text-[#5E6AD2]" />
            </div>
            <h2 className="text-[16px] font-semibold text-[#F7F8FA] mb-1">What should we call you?</h2>
            <p className="text-[12px] text-[#6B7280] mb-4">Your advisor Aria will use this to personalise your experience.</p>
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void saveUserName()}
              placeholder="Your full name"
              className="w-full bg-[#111317] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[13px] text-[#F7F8FA]
                placeholder-[#3A3A3A] outline-none focus:border-[#5E6AD2]/60 transition-colors mb-3"
            />
            <button
              onClick={() => void saveUserName()}
              disabled={!nameInput.trim() || nameSaving}
              className="w-full bg-[#5E6AD2] hover:bg-[#4F5BC0] disabled:opacity-40 disabled:cursor-not-allowed
                text-white text-[13px] font-medium py-2.5 rounded-lg transition-colors">
              {nameSaving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      )}

      {/* ── New session type modal ── */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0B0D10] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {sessionModalStep === 'choose' ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-semibold text-[#F7F8FA]">Start a new session</h2>
                  <button onClick={() => setShowSessionModal(false)} className="text-[#6B7280] hover:text-[#A0A7B3]">✕</button>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={startBlankSession}
                    className="w-full text-left rounded-xl border border-white/[0.08] bg-[#111317] hover:border-[#5E6AD2]/40 hover:bg-[#5E6AD2]/06
                      px-4 py-3.5 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-[#5E6AD2]/15 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-[#5E6AD2]" />
                      </div>
                      <span className="text-[14px] font-medium text-[#F7F8FA]">New insurance inquiry</span>
                    </div>
                    <p className="text-[12px] text-[#6B7280] pl-11">Explore new coverage, get a quote, or add to your existing policy</p>
                  </button>

                  <button
                    onClick={() => setSessionModalStep('pick-parent')}
                    className="w-full text-left rounded-xl border border-white/[0.08] bg-[#111317] hover:border-amber-500/40 hover:bg-amber-950/10
                      px-4 py-3.5 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-[14px] font-medium text-[#F7F8FA]">Question about an existing enquiry</span>
                    </div>
                    <p className="text-[12px] text-[#6B7280] pl-11">Clarify policy terms, ask about a claim, or follow up on previous advice</p>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <button onClick={() => setSessionModalStep('choose')} className="text-[#6B7280] hover:text-[#A0A7B3]">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-[15px] font-semibold text-[#F7F8FA]">Which session is this about?</h2>
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {sessions.map((s, i) => {
                    const meta  = SESSION_STATUS[s.status] ?? SESSION_STATUS.new
                    const topic = s.concerns?.length
                      ? s.concerns.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
                      : s.primary_concern ? s.primary_concern.charAt(0).toUpperCase() + s.primary_concern.slice(1)
                      : 'Insurance enquiry'
                    return (
                      <button
                        key={s.id}
                        onClick={() => startFollowUp(s.id)}
                        className="w-full text-left rounded-xl border border-white/[0.06] bg-[#111317] hover:border-[#5E6AD2]/40 px-4 py-3 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#F7F8FA]">
                              {s.ticket_number != null
                                ? `#${String(s.ticket_number).padStart(4, '0')}`
                                : `Session #${sessions.length - i}`}
                            </span>
                            {s.session_type === 'follow_up' && (
                              <span className="text-[9px] font-semibold px-1 py-px rounded border border-amber-800/40 bg-amber-950/30 text-amber-400">FU</span>
                            )}
                          </div>
                          <span className={`text-[12px] font-medium ${meta.color}`}>{meta.label}</span>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mt-0.5">{topic}</p>
                        <p className="text-[11px] text-[#4B5058] mt-0.5">Updated {fmtDate(s.updated_at)}</p>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="h-12 bg-[#0B0D10] border-b border-white/[0.06] px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/companylogo.png" alt="SecureLife" className="block w-full h-full object-contain p-0.5" />
          </div>
          <div>
            <h1 className="text-[13px] font-semibold text-[#F7F8FA] leading-none">SecureLife Insurance</h1>
            <p className="text-[10px] text-[#6B7280] mt-0.5">Your insurance portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {userProfile?.name && <span className="text-[12px] text-[#6B7280]">Hi, {userProfile.name}</span>}
          <button onClick={signOut}
            className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#A0A7B3] transition-colors">
            <LogOut className="w-3.5 h-3.5" />Sign out
          </button>
        </div>
      </header>

      {/* ── Status banner ── */}
      {statusMeta && lead && (
        <div
          className={`bg-[#0B0D10] border-b border-white/[0.04] px-5 py-2 flex items-center gap-2.5 shrink-0
            ${statusMeta.cta ? 'cursor-pointer hover:bg-[#0F1115] transition-colors' : ''}`}
          onClick={() => statusMeta.cta && setActiveTab(statusMeta.cta)}
        >
          <statusMeta.icon className={`w-3.5 h-3.5 ${statusMeta.color} shrink-0`} />
          <p className="text-[12px] text-[#A0A7B3] flex-1">{statusMeta.label}</p>
          {statusMeta.cta && <span className="text-[12px] text-[#5E6AD2] font-medium">Upload now →</span>}
        </div>
      )}

      {/* ── Body: sidebar + main ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sessions sidebar */}
        <aside className="hidden md:flex w-52 lg:w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#08090B]">
          <div className="px-3 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Sessions</p>
            <span className="text-[11px] text-[#4B5058]">{sessions.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {sessions.length === 0 ? (
              <p className="text-[12px] text-[#4B5058] text-center py-6 px-2">Start a chat to create your first session</p>
            ) : (
              sessions.map((s, i) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  index={i}
                  total={sessions.length}
                  isActive={s.id === leadId}
                  onClick={() => switchSession(s)}
                />
              ))
            )}
          </div>
          <div className="p-2.5 border-t border-white/[0.04]">
            <button
              onClick={requestNewSession}
              className="w-full flex items-center justify-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#A0A7B3]
                border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg py-2 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />New session
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">

            {/* Tab bar */}
            <div className="shrink-0 border-b border-white/[0.06] bg-[#0B0D10]">
              <TabsList className="h-11 bg-transparent p-0 rounded-none gap-0 flex w-full">
                {[
                  { value: 'chat',      icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Chat with Aria' },
                  { value: 'details',   icon: <User className="w-3.5 h-3.5" />,          label: 'My Details' },
                  { value: 'documents', icon: <FileText className="w-3.5 h-3.5" />,       label: 'Documents' },
                  { value: 'sessions',  icon: <Clock className="w-3.5 h-3.5" />,          label: `Sessions${sessions.length > 0 ? ` (${sessions.length})` : ''}`, mobileOnly: true },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className={`h-11 rounded-none border-b-2 border-transparent
                      data-[state=active]:border-[#5E6AD2] data-[state=active]:text-[#F7F8FA] data-[state=active]:bg-transparent
                      text-[13px] text-[#6B7280] bg-transparent flex items-center gap-1.5 px-4
                      ${'mobileOnly' in tab && tab.mobileOnly ? 'md:hidden' : ''}`}
                  >
                    {tab.icon}{tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── Chat tab ── */}
            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
              {/* Aria header */}
              <div className="shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-[#0B0D10]">
                <div className="w-9 h-9 rounded-full bg-[#5E6AD2] text-white flex items-center justify-center text-[13px] font-bold shrink-0">
                  A
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-[#F7F8FA] leading-tight">Aria</p>
                  <p className="text-[11px] text-[#6B7280]">
                    SecureLife Advisor · Online
                    {pendingParentId && !leadId && (
                      <span className="ml-2 text-amber-400">Follow-up session</span>
                    )}
                    {lead?.session_type === 'follow_up' && (
                      <span className="ml-2 text-amber-400">Follow-up session</span>
                    )}
                  </p>
                </div>
                {lead?.status === 'completed' ? (
                  <span className="text-[11px] text-green-400 font-medium border border-green-900/40 bg-green-950/20 px-2 py-0.5 rounded-full">
                    Completed
                  </span>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                )}
              </div>

              {/* Chat window fills remaining space */}
              <div className="flex-1 min-h-0 bg-[#08090B]">
                <ChatWindow
                  leadId={leadId}
                  userProfile={userProfile}
                  onLeadCreated={onLeadCreated}
                  onReply={() => { if (leadId) fetchLeadData(leadId) }}
                  disabled={isDisabled}
                  parentLeadId={pendingParentId}
                  sessionType={pendingParentId ? 'follow_up' : 'new_inquiry'}
                  welcomeMessage={followUpWelcome}
                />
              </div>
            </TabsContent>

            {/* ── My Details tab ── */}
            <TabsContent value="details" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden">
              <div className="max-w-xl mx-auto p-5">
                {!lead ? (
                  <div className="text-center py-16">
                    <MessageSquare className="w-8 h-8 text-[#1E2028] mx-auto mb-3" />
                    <p className="text-[13px] text-[#6B7280]">Start a conversation with Aria to build your profile</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest mb-3">Information captured</p>
                    <Field label="Full Name"     value={lead.name} />
                    <Field label="Email"         value={lead.email} />
                    <Field label="Phone"         value={lead.phone} />
                    <Field label="Age"           value={lead.age} />
                    <Field label="Occupation"    value={lead.occupation} />
                    <Field label="Annual Income" value={lead.annual_income ? `₹${Number(lead.annual_income).toLocaleString('en-IN')}` : null} />
                    <Field label="Family Size"   value={lead.family_size} />
                    <Field label="Location"      value={lead.location} />
                    {concerns.length > 0 && (
                      <div className="py-2.5 border-b border-white/[0.04]">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[12px] text-[#6B7280] shrink-0 pt-0.5">Insurance Interests</p>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {concerns.map(c => (
                              <span key={c} className="text-[11px] capitalize bg-[#5E6AD2]/15 text-[#7C7CFF]
                                border border-[#5E6AD2]/25 rounded-full px-2 py-0.5">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <Field label="Existing Coverage" value={lead.existing_coverage} />
                    <p className="text-[11px] text-[#4B5058] mt-4">
                      Something incorrect? Let Aria know in the chat and she'll update it.
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ── My Documents tab ── */}
            <TabsContent value="documents" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden">
              <div className="max-w-xl mx-auto p-5 flex flex-col gap-3">
                {!leadId || documents.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="w-8 h-8 text-[#1E2028] mx-auto mb-3" />
                    <p className="text-[13px] text-[#6B7280] mb-1">No documents uploaded yet</p>
                    <p className="text-[12px] text-[#4B5058]">Use the paperclip icon in the chat to attach your insurance PDFs</p>
                  </div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#111317] p-3">
                      <FileText className="w-4 h-4 text-[#6B7280] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#A0A7B3] truncate">{doc.filename}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB · ` : ''}
                          {fmtDate(doc.created_at)}
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-1 rounded-lg border ${
                        doc.status === 'extracted'  ? 'bg-green-950/40 text-green-400 border-green-900/40' :
                        doc.status === 'processing' ? 'bg-blue-950/40 text-blue-400 border-blue-900/40' :
                        doc.status === 'failed'     ? 'bg-red-950/40 text-red-400 border-red-900/40' :
                        'bg-[#1E2028] text-[#6B7280] border-white/[0.06]'
                      }`}>
                        {doc.status === 'extracted' ? 'Received' : doc.status === 'processing' ? 'Processing…' : doc.status === 'failed' ? 'Failed' : 'Pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* ── Sessions tab (mobile only — sidebar handles desktop) ── */}
            <TabsContent value="sessions" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden md:hidden">
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest">Your sessions</p>
                  <button onClick={requestNewSession} className="text-[12px] text-[#5E6AD2] hover:text-[#7C7CFF] font-medium transition-colors">
                    + New session
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-[#1E2028] mx-auto mb-3" />
                    <p className="text-[13px] text-[#6B7280]">No sessions yet — start a chat with Aria</p>
                  </div>
                ) : (
                  sessions.map((s, i) => {
                    const meta  = SESSION_STATUS[s.status] ?? SESSION_STATUS.new
                    const topic = s.concerns?.length
                      ? s.concerns.slice(0, 2).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')
                      : s.primary_concern ? s.primary_concern.charAt(0).toUpperCase() + s.primary_concern.slice(1)
                      : 'Insurance enquiry'
                    return (
                      <button key={s.id} onClick={() => switchSession(s)}
                        className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                          s.id === leadId
                            ? 'border-[#5E6AD2]/40 bg-[#5E6AD2]/08'
                            : 'border-white/[0.06] bg-[#111317] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#F7F8FA]">
                              {s.ticket_number != null
                                ? `#${String(s.ticket_number).padStart(4, '0')}`
                                : `Session #${sessions.length - i}`}
                            </span>
                            {s.session_type === 'follow_up' && (
                              <span className="text-[9px] font-semibold px-1.5 py-px rounded border border-amber-800/50 bg-amber-950/30 text-amber-400 uppercase tracking-wide">Follow-up</span>
                            )}
                          </div>
                          <span className={`text-[12px] font-medium ${meta.color}`}>{meta.label}</span>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mb-1">{topic}</p>
                        <p className="text-[11px] text-[#4B5058]">Started {fmtDate(s.created_at)}</p>
                      </button>
                    )
                  })
                )}
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  )
}
