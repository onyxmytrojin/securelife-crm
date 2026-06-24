'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { createClient } from '@/lib/supabase-browser'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogOut, MessageSquare, User, FileText, CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Lead, Document } from '@/lib/types'

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string; cta?: string }> = {
  new:           { label: 'Inquiry received — chat with Priya to get started', icon: Clock, color: 'text-[#6B7280]' },
  chatting:      { label: 'In conversation with Priya', icon: MessageSquare, color: 'text-amber-400' },
  qualified:     { label: 'Profile complete — upload your existing policy documents so we can review your coverage', icon: FileText, color: 'text-[#5E6AD2]', cta: 'documents' },
  awaiting_docs: { label: 'Awaiting your documents — upload them in the Documents tab to proceed', icon: AlertCircle, color: 'text-orange-400', cta: 'documents' },
  processing:    { label: 'Your documents are being reviewed by our team', icon: Loader2, color: 'text-cyan-400' },
  completed:     { label: 'Review complete — your advisor will be in touch shortly', icon: CheckCircle, color: 'text-green-400' },
  rejected:      { label: 'Application closed', icon: Clock, color: 'text-[#6B7280]' },
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

export default function CustomerChatPage() {
  const [leadId, setLeadId]       = useState<string | null>(null)
  const [lead, setLead]           = useState<Lead | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const authEmail = user.email ?? ''
      const { data: p } = await supabase.from('profiles').select('name, email').eq('id', user.id).single()
      const profileName  = (p as { name?: string; email?: string } | null)?.name  || user.user_metadata?.full_name || user.user_metadata?.name || ''
      const profileEmail = (p as { name?: string; email?: string } | null)?.email || authEmail
      // Show name prompt if name is missing or is just the email prefix (DB trigger fallback)
      const emailPrefix = profileEmail.split('@')[0]
      const nameIsPlaceholder = !profileName || profileName === emailPrefix
      if (nameIsPlaceholder) setShowNamePrompt(true)
      setUserProfile({ name: profileName, email: profileEmail })
    })()
  }, [])

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
    if (l) setLead(l)
    if (docs) setDocuments(docs)
  }, [])

  const onLeadCreated = (id: string) => { setLeadId(id); fetchLeadData(id) }
  const signOut = async () => { await supabase.auth.signOut(); router.push('/login') }

  const statusMeta = lead ? (STATUS_META[lead.status] ?? STATUS_META.new) : null
  const concerns   = lead?.concerns?.length
    ? lead.concerns
    : lead?.primary_concern ? [lead.primary_concern] : []

  return (
    <div className="min-h-screen bg-[#08090B] flex flex-col">
      {/* Name prompt modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0B0D10] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-[#5E6AD2]/20 flex items-center justify-center mb-4">
              <User className="w-5 h-5 text-[#5E6AD2]" />
            </div>
            <h2 className="text-[16px] font-semibold text-[#F7F8FA] mb-1">What should we call you?</h2>
            <p className="text-[12px] text-[#6B7280] mb-4">Your advisor Priya will use this to personalise your experience.</p>
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

      {/* Header */}
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

      {/* Status banner */}
      {statusMeta && lead && (
        <div
          className={`bg-[#0B0D10] border-b border-white/[0.04] px-5 py-2.5 flex items-center gap-2.5
            ${statusMeta.cta ? 'cursor-pointer hover:bg-[#0F1115] transition-colors' : ''}`}
          onClick={() => statusMeta.cta && setActiveTab(statusMeta.cta)}
        >
          <statusMeta.icon className={`w-3.5 h-3.5 ${statusMeta.color} shrink-0`} />
          <p className="text-[12px] text-[#A0A7B3] flex-1">{statusMeta.label}</p>
          {statusMeta.cta && (
            <span className="text-[12px] text-[#5E6AD2] font-medium">Upload now →</span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex items-start justify-center px-4 py-5">
        <div className="w-full max-w-[600px]">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Tab bar */}
            <div className="bg-[#0B0D10] rounded-xl border border-white/[0.06] mb-3 overflow-hidden">
              <TabsList className="h-11 w-full bg-transparent p-0 rounded-none gap-0">
                {[
                  { value: 'chat',      icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Chat with Priya' },
                  { value: 'details',   icon: <User className="w-3.5 h-3.5" />,          label: 'My Details' },
                  { value: 'documents', icon: <FileText className="w-3.5 h-3.5" />,       label: 'My Documents' },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="flex-1 h-11 rounded-none border-b-2 border-transparent
                      data-[state=active]:border-[#5E6AD2] data-[state=active]:text-[#F7F8FA] data-[state=active]:bg-transparent
                      text-[13px] text-[#6B7280] bg-transparent flex items-center gap-1.5 px-3">
                    {tab.icon}{tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Chat tab */}
            <TabsContent value="chat" className="m-0">
              <div className="bg-[#0B0D10] rounded-xl border border-white/[0.06] overflow-hidden flex flex-col"
                style={{ height: 'calc(100vh - 210px)' }}>
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[#5E6AD2] text-white flex items-center justify-center text-[12px] font-bold">
                    P
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#F7F8FA]">Priya</p>
                    <p className="text-[11px] text-[#6B7280]">SecureLife Advisor · Online</p>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                </div>
                <div className="flex-1 min-h-0 bg-[#08090B]">
                  <ChatWindow
                    leadId={leadId}
                    userProfile={userProfile}
                    onLeadCreated={onLeadCreated}
                    onReply={() => { if (leadId) fetchLeadData(leadId) }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* My Details tab */}
            <TabsContent value="details" className="m-0">
              <div className="bg-[#0B0D10] rounded-xl border border-white/[0.06] p-5">
                {!lead ? (
                  <div className="text-center py-10">
                    <MessageSquare className="w-8 h-8 text-[#1E2028] mx-auto mb-3" />
                    <p className="text-[13px] text-[#6B7280]">Start a conversation with Priya to build your profile</p>
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
                      Something incorrect? Let Priya know in the chat and she'll update it.
                    </p>
                  </>
                )}
              </div>
            </TabsContent>

            {/* My Documents tab */}
            <TabsContent value="documents" className="m-0">
              <div className="bg-[#0B0D10] rounded-xl border border-white/[0.06] p-5 flex flex-col gap-3">
                {!leadId || documents.length === 0 ? (
                  <div className="text-center py-10">
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
                          {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
          </Tabs>
        </div>
      </div>
    </div>
  )
}
