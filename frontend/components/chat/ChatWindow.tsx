'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, FileText, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildChatWelcome } from '@/lib/prompts'

interface Message { role: 'user' | 'assistant'; content: string }

interface AttachedFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  extractedSummary?: string
  error?: string
}

interface Props {
  leadId: string | null
  userProfile?: { name: string; email: string } | null
  onLeadCreated: (id: string) => void
  onReply?: () => void
  disabled?: boolean
}

function normalizeQuotes(s: string) {
  return s.replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'")
}

function parseChoices(content: string): { text: string; choices: string[]; multi: boolean } {
  const multiMatch  = content.match(/MULTI_CHOICES:(\[[\s\S]*?\])/i)
  const singleMatch = content.match(/CHOICES:(\[[\s\S]*?\])/i)
  const match = multiMatch ?? singleMatch
  const multi = !!multiMatch
  if (!match) return { text: content.trim(), choices: [], multi: false }
  try {
    const choices = JSON.parse(normalizeQuotes(match[1])) as string[]
    const pattern = multi ? /MULTI_CHOICES:\[[\s\S]*?\]/i : /CHOICES:\[[\s\S]*?\]/i
    const text = content.replace(pattern, '').trim()
    return { text, choices, multi }
  } catch {
    // Strip the raw CHOICES line from display even if parse failed
    const text = content.replace(/(?:MULTI_)?CHOICES:\[[\s\S]*?\]/i, '').trim()
    return { text, choices: [], multi: false }
  }
}

export function ChatWindow({ leadId, userProfile, onLeadCreated, onReply, disabled = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: buildChatWelcome(null) }
  ])

  // Update welcome message once profile loads (async) — only if chat hasn't started
  useEffect(() => {
    if (!userProfile?.name) return
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{ role: 'assistant', content: buildChatWelcome(userProfile.name) }]
      }
      return prev
    })
  }, [userProfile?.name])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(leadId)
  const [attachment, setAttachment] = useState<AttachedFile | null>(null)
  const [selectedChoices, setSelectedChoices] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async (id: string) => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('role, content')
      .eq('lead_id', id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
    if (data && data.length > 0) setMessages(data as Message[])
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    if (leadId) { setCurrentLeadId(leadId); loadHistory(leadId) }
  }, [leadId, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, attachment])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setAttachment({ file, status: 'error', error: 'Only PDF files are supported' })
      return
    }
    setAttachment({ file, status: 'uploading' })
    let activeLeadId = currentLeadId
    if (!activeLeadId) {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'chatting', source: 'chatbot' }),
      })
      const data = await res.json()
      activeLeadId = data.id
      setCurrentLeadId(activeLeadId)
      onLeadCreated(activeLeadId!)
    }
    const form = new FormData()
    form.append('file', file)
    form.append('leadId', activeLeadId!)
    try {
      const res = await fetch('/api/documents', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      const e = data.extracted
      const lines = [
        e.policy_type             && `Policy type: ${e.policy_type}`,
        e.provider_name           && `Provider: ${e.provider_name}`,
        e.sum_insured             && `Sum insured: ₹${Number(e.sum_insured).toLocaleString('en-IN')}`,
        e.premium_amount          && `Premium: ₹${Number(e.premium_amount).toLocaleString('en-IN')} ${e.premium_frequency ?? ''}`,
        e.renewal_date            && `Renewal date: ${e.renewal_date}`,
        e.exclusions              && `Exclusions: ${e.exclusions}`,
        e.pre_existing_conditions && `Pre-existing conditions: ${e.pre_existing_conditions}`,
      ].filter(Boolean).join('\n')
      setAttachment({ file, status: 'done', extractedSummary: lines || 'Document processed' })
    } catch (err: unknown) {
      setAttachment({ file, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  const doSend = async (textToSend: string) => {
    const hasAttachment = attachment?.status === 'done'
    if (!textToSend && !hasAttachment) return

    let userContent = textToSend
    if (hasAttachment && !textToSend) userContent = `I've uploaded my insurance document: ${attachment!.file.name}`
    if (hasAttachment && textToSend) userContent = `${textToSend}\n\n[Attached: ${attachment!.file.name}]`

    setMessages(prev => [...prev, { role: 'user', content: userContent }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          leadId: currentLeadId,
          documentContext: hasAttachment ? attachment!.extractedSummary : undefined,
          userProfile: userProfile ?? undefined,
        }),
      })
      const data = await res.json()
      if (data.leadId && !currentLeadId) {
        setCurrentLeadId(data.leadId)
        onLeadCreated(data.leadId)
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (hasAttachment) setAttachment(null)
      onReply?.()
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting. Please try again." }])
    } finally {
      setLoading(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && attachment?.status !== 'done') || loading) return
    setInput('')
    await doSend(text)
  }

  const sendChoice = async (choice: string) => {
    if (loading) return
    setSelectedChoices([])
    await doSend(choice)
  }

  const toggleMultiChoice = (choice: string) => {
    setSelectedChoices(prev =>
      prev.includes(choice) ? prev.filter(c => c !== choice) : [...prev, choice]
    )
  }

  const confirmMultiChoices = async () => {
    if (!selectedChoices.length || loading) return
    const text = selectedChoices.join(', ')
    setSelectedChoices([])
    await doSend(text)
  }

  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1)

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {historyLoading ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-[#6B7280]">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const parsed = parseChoices(m.content)
              const showChoices = parsed.choices.length > 0 && i === lastAssistantIdx && !loading
              return (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                    {m.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-[#5E6AD2] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mb-0.5">
                        A
                      </div>
                    )}
                    <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#5E6AD2] text-white rounded-br-sm'
                        : 'bg-[#1E2028] text-[#E8EAF0] rounded-bl-sm'
                    }`}>
                      {parsed.text}
                    </div>
                  </div>

                  {showChoices && (
                    <div className="flex flex-col gap-2 mt-2 ml-9 max-w-[85%]">
                      <div className="flex flex-wrap gap-2">
                        {parsed.choices.map(choice => {
                          const isSelected = selectedChoices.includes(choice)
                          return (
                            <button
                              key={choice}
                              onClick={() => parsed.multi ? toggleMultiChoice(choice) : sendChoice(choice)}
                              className={`text-[13px] px-3 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer
                                ${isSelected && parsed.multi
                                  ? 'bg-[#5E6AD2] text-white border-[#5E6AD2]'
                                  : 'border-white/[0.12] bg-[#111317] text-[#A0A7B3] hover:bg-[#5E6AD2] hover:text-white hover:border-[#5E6AD2]'
                                }`}
                            >
                              {parsed.multi && isSelected && <span className="mr-1">✓</span>}
                              {choice}
                            </button>
                          )
                        })}
                      </div>
                      {parsed.multi && (
                        <button
                          onClick={confirmMultiChoices}
                          disabled={!selectedChoices.length}
                          className="self-start text-[13px] px-4 py-1.5 rounded-lg
                            bg-[#5E6AD2] hover:bg-[#6B78E7] text-white font-medium
                            disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Confirm ({selectedChoices.length} selected)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-[#5E6AD2] text-white flex items-center justify-center text-[11px] font-bold shrink-0">P</div>
                <div className="bg-[#1E2028] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-[#5E6AD2] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Attachment preview */}
      {attachment && (
        <div className={`mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${
          attachment.status === 'error'   ? 'bg-red-950/30 text-red-400 border border-red-900/40' :
          attachment.status === 'done'    ? 'bg-green-950/30 text-green-400 border border-green-900/40' :
                                            'bg-blue-950/30 text-blue-400 border border-blue-900/40'
        }`}>
          {attachment.status === 'uploading'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            : <FileText className="w-3.5 h-3.5 shrink-0" />
          }
          <span className="flex-1 truncate font-medium">{attachment.file.name}</span>
          <span className="shrink-0 text-[11px]">
            {attachment.status === 'uploading' && 'Extracting…'}
            {attachment.status === 'done'      && 'Ready to send'}
            {attachment.status === 'error'     && (attachment.error ?? 'Failed')}
          </span>
          {attachment.status !== 'uploading' && (
            <button onClick={() => setAttachment(null)} className="shrink-0 ml-1 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Input bar — hidden when conversation is closed */}
      {disabled ? (
        <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <p className="text-[13px] text-[#6B7280]">
            This conversation is complete. Start a new session if you need further assistance.
          </p>
        </div>
      ) : (
        <div className="border-t border-white/[0.06] px-3 py-2.5 flex gap-2 items-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[#6B7280] hover:text-[#A0A7B3] transition-colors p-1 shrink-0"
            title="Attach insurance PDF"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
          />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void send()}
            placeholder={attachment?.status === 'done' ? 'Add a message or just send…' : 'Type a message…'}
            className="flex-1 text-[14px] bg-[#111317] border border-white/[0.08] rounded-xl px-3 py-2
              text-[#F7F8FA] placeholder:text-[#4B5058]
              focus:outline-none focus:border-[#5E6AD2]/50 transition-colors"
            disabled={loading || attachment?.status === 'uploading'}
          />
          <button
            onClick={() => void send()}
            disabled={loading || attachment?.status === 'uploading' || (!input.trim() && attachment?.status !== 'done')}
            className="w-8 h-8 rounded-xl bg-[#5E6AD2] hover:bg-[#6B78E7] disabled:opacity-40
              text-white flex items-center justify-center shrink-0 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
