'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, RefreshCw } from 'lucide-react'
import type { Lead } from '@/lib/types'

interface Props {
  leads: Lead[]
  onNewLead: () => void
  onRefresh: () => void
}

const OPEN_COMMAND_PALETTE_EVENT = 'securelife-command-palette-open'

export function CommandPalette({ leads, onNewLead, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => { if (!v) { setQuery(''); setSelected(0) } return !v })
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const openPalette = () => setOpen(true)
    document.addEventListener('keydown', down)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette)
    return () => {
      document.removeEventListener('keydown', down)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette)
    }
  }, [])

  const ACTIONS = [
    { id: 'new',     label: 'New Lead',         shortcut: 'N', Icon: Plus,       run: () => { onNewLead(); setOpen(false) } },
    { id: 'refresh', label: 'Refresh Pipeline',  shortcut: 'R', Icon: RefreshCw,  run: () => { onRefresh(); setOpen(false) } },
  ]

  const filteredActions = ACTIONS.filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase()))
  const filteredLeads   = query
    ? leads.filter(l => `${l.name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : []

  const total = filteredActions.length + filteredLeads.length

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, total - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      if (selected < filteredActions.length) filteredActions[selected].run()
      else {
        const lead = filteredLeads[selected - filteredActions.length]
        if (lead) { router.push(`/leads/${lead.id}`); setOpen(false) }
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-[560px]" onClick={e => e.stopPropagation()}>
          <div className="bg-white dark:bg-[#111317] rounded-2xl border border-gray-200 dark:border-[#1E2028] shadow-2xl dark:shadow-black/70 overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-[#1E2028]">
              <Search className="w-4 h-4 shrink-0 text-gray-400 dark:text-[#6E7480]" />
              <input
                autoFocus
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(0) }}
                onKeyDown={handleKey}
                placeholder="Search leads or type a command…"
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-[#F7F8FA] placeholder:text-gray-400 dark:placeholder:text-[#6E7480] outline-none"
              />
              <kbd className="hidden sm:block text-[10px] text-gray-400 dark:text-[#6E7480] border border-gray-200 dark:border-[#2A2A2A] rounded px-1.5 py-0.5 font-mono">ESC</kbd>
            </div>

            {/* Results */}
            <div className="overflow-y-auto max-h-72 py-2">
              {filteredActions.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#6E7480]">Actions</p>
                  {filteredActions.map((action, i) => (
                    <button key={action.id} onClick={action.run}
                      onMouseEnter={() => setSelected(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selected === i ? 'bg-gray-100 dark:bg-[#171A1F]' : 'hover:bg-gray-50 dark:hover:bg-[#171A1F]'
                      }`}
                    >
                      <action.Icon className="w-4 h-4 text-gray-400 dark:text-[#6E7480] shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 dark:text-[#A1A7B3]">{action.label}</span>
                      <kbd className="text-[10px] text-gray-400 dark:text-[#6E7480] border border-gray-200 dark:border-[#2A2A2A] rounded px-1.5 py-0.5 font-mono">{action.shortcut}</kbd>
                    </button>
                  ))}
                </div>
              )}

              {filteredLeads.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#6E7480]">Leads</p>
                  {filteredLeads.map((lead, i) => {
                    const idx = filteredActions.length + i
                    return (
                      <button key={lead.id}
                        onClick={() => { router.push(`/leads/${lead.id}`); setOpen(false) }}
                        onMouseEnter={() => setSelected(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selected === idx ? 'bg-gray-100 dark:bg-[#171A1F]' : 'hover:bg-gray-50 dark:hover:bg-[#171A1F]'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#1E2028] flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-[#A1A7B3] shrink-0">
                          {(lead.name ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-[#A1A7B3] truncate">{lead.name ?? 'Unknown'}</p>
                          {lead.email && <p className="text-xs text-gray-400 dark:text-[#6E7480] truncate">{lead.email}</p>}
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-[#6E7480] capitalize shrink-0">{lead.status.replace('_', ' ')}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {total === 0 && query && (
                <p className="px-4 py-8 text-sm text-gray-400 dark:text-[#6E7480] text-center">No results for &quot;{query}&quot;</p>
              )}
              {total === 0 && !query && (
                <p className="px-4 py-4 text-xs text-gray-400 dark:text-[#6E7480] text-center">Type to search leads or actions</p>
              )}
            </div>

            {/* Footer hints */}
            <div className="border-t border-gray-100 dark:border-[#1E2028] px-4 py-2 flex items-center gap-4">
              {[['↑↓', 'navigate'], ['↵', 'open'], ['⌘/Ctrl+K', 'toggle']].map(([key, label]) => (
                <span key={key} className="text-[10px] text-gray-400 dark:text-[#6E7480] flex items-center gap-1">
                  <kbd className="border border-gray-200 dark:border-[#2A2A2A] rounded px-1.5 py-0.5 font-mono">{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
