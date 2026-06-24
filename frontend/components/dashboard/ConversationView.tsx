'use client'
import { useState } from 'react'
import type { Conversation } from '@/lib/types'
import { Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface Summary {
  headline: string
  key_points: string[]
  lead_intent: string
  concerns_raised?: string
  next_step: string
}

function parseChoices(content: string): { text: string } {
  return { text: content.replace(/CHOICES:\[[\s\S]*?\]/, '').trim() }
}

export function ConversationView({ leadId, conversations }: { leadId: string; conversations: Conversation[] }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [error, setError] = useState('')

  const generateSummary = async () => {
    setLoadingSummary(true)
    setError('')
    try {
      const res  = await fetch('/api/conversations/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummary(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoadingSummary(false)
    }
  }

  const visibleMessages = conversations.filter(m => m.role === 'user' || m.role === 'assistant')

  if (!visibleMessages.length) {
    return (
      <div className="flex items-center justify-center h-40 text-[13px] text-[#6B7280]">
        No conversation yet
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* AI Summary */}
      {!summary ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center">
          <Sparkles className="w-5 h-5 text-[#5E6AD2] mx-auto mb-2" />
          <p className="text-[14px] font-medium text-[#F7F8FA] mb-1">Conversation Summary</p>
          <p className="text-[12px] text-[#6B7280] mb-4 leading-relaxed">
            Generate a broker-ready summary — key facts, intent, and next step.
          </p>
          {error && <p className="text-[12px] text-red-400 mb-3">{error}</p>}
          <button
            onClick={generateSummary}
            disabled={loadingSummary}
            className="inline-flex items-center gap-2 h-8 px-4 rounded-lg bg-[#5E6AD2] hover:bg-[#6B78E7]
              text-[13px] text-white font-medium disabled:opacity-50 transition-colors"
          >
            {loadingSummary
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Summarising…</>
              : <><Sparkles className="w-3.5 h-3.5" />Generate Summary</>}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-[#111317] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5E6AD2]" />
              <span className="text-[14px] font-semibold text-[#F7F8FA]">AI Summary</span>
            </div>
            <button
              onClick={generateSummary}
              disabled={loadingSummary}
              className="h-7 px-3 rounded-lg text-[12px] border border-white/[0.08] text-[#A0A7B3]
                hover:bg-[#171A1F] disabled:opacity-50 transition-colors"
            >
              {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
            </button>
          </div>
          <div className="px-4 py-4 flex flex-col gap-4">
            <p className="text-[14px] font-medium text-[#F7F8FA] leading-relaxed">{summary.headline}</p>

            <div>
              <p className="text-[10px] font-semibold text-[#4B5058] uppercase tracking-widest mb-2">Key Facts</p>
              <ul className="flex flex-col gap-1.5">
                {summary.key_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#A0A7B3]">
                    <span className="text-[#3A3A3A] mt-0.5 shrink-0">·</span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-blue-950/20 border border-blue-900/30 p-3">
                <p className="text-[11px] font-semibold text-blue-400 mb-1">Client Intent</p>
                <p className="text-[12px] text-blue-300/80 leading-relaxed">{summary.lead_intent}</p>
              </div>
              {summary.concerns_raised && (
                <div className="rounded-lg bg-amber-950/20 border border-amber-900/30 p-3">
                  <p className="text-[11px] font-semibold text-amber-400 mb-1">Concerns Raised</p>
                  <p className="text-[12px] text-amber-300/80 leading-relaxed">{summary.concerns_raised}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-green-950/20 border border-green-900/30 p-3">
              <p className="text-[11px] font-semibold text-green-400 mb-1">Recommended Next Step</p>
              <p className="text-[12px] text-green-300/80 leading-relaxed">{summary.next_step}</p>
            </div>
          </div>
        </div>
      )}

      {/* Full transcript — collapsed */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setTranscriptOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-[13px]
            text-[#6B7280] hover:bg-[#111317] transition-colors"
        >
          <span className="font-medium">Full transcript ({visibleMessages.length} messages)</span>
          {transcriptOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {transcriptOpen && (
          <div className="border-t border-white/[0.06] px-4 py-3 max-h-80 overflow-y-auto flex flex-col gap-3">
            {visibleMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[#5E6AD2] flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    P
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#5E6AD2] text-white'
                    : 'bg-[#1E2028] text-[#A0A7B3]'
                }`}>
                  {parseChoices(m.content).text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
