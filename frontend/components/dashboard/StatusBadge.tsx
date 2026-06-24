'use client'
import { Badge } from '@/components/ui/badge'
import type { LeadStatus } from '@/lib/types'

const config: Record<LeadStatus, { label: string; className: string }> = {
  new:           { label: 'New',           className: 'bg-blue-50 text-blue-700 border-blue-200' },
  chatting:      { label: 'Chatting',      className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  qualified:     { label: 'Qualified',     className: 'bg-purple-50 text-purple-700 border-purple-200' },
  awaiting_docs: { label: 'Awaiting Docs', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  processing:    { label: 'Processing',    className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  completed:     { label: 'Completed',     className: 'bg-green-50 text-green-700 border-green-200' },
  rejected:      { label: 'Rejected',      className: 'bg-red-50 text-red-700 border-red-200' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = config[status] ?? config.new
  return (
    <Badge variant="outline" className={`text-xs font-medium ${className}`}>
      {label}
    </Badge>
  )
}
