import type { LeadStatus } from '@/lib/types'

const META: Record<LeadStatus, { color: string; pct: number; kind: 'empty' | 'arc' | 'done' | 'x' }> = {
  new:           { color: '#6B7280', pct: 0,     kind: 'empty' },
  chatting:      { color: '#F59E0B', pct: 0.25,  kind: 'arc' },
  qualified:     { color: '#A855F7', pct: 0.5,   kind: 'arc' },
  awaiting_docs: { color: '#F97316', pct: 0.625, kind: 'arc' },
  processing:    { color: '#06B6D4', pct: 0.75,  kind: 'arc' },
  completed:     { color: '#22C55E', pct: 1,     kind: 'done' },
  rejected:      { color: '#6B7280', pct: 0,     kind: 'x' },
}

export function StatusIcon({ status, size = 14 }: { status: LeadStatus; size?: number }) {
  const m  = META[status] ?? META.new
  const cx = size / 2
  const r  = size * 0.38
  const c  = 2 * Math.PI * r
  const sw = Math.max(1.2, size * 0.11)

  if (m.kind === 'done') {
    const p = size * 0.5
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={cx - 0.5} fill={m.color} />
        <polyline
          points={`${size*0.28},${size*0.52} ${size*0.45},${size*0.67} ${size*0.72},${size*0.36}`}
          fill="none" stroke="white" strokeWidth={Math.max(1.2, size*0.13)}
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (m.kind === 'x') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={r + sw/2} fill="none" stroke={m.color} strokeWidth={sw} />
        <line x1={cx - r*0.5} y1={cx - r*0.5} x2={cx + r*0.5} y2={cx + r*0.5}
          stroke={m.color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={cx + r*0.5} y1={cx - r*0.5} x2={cx - r*0.5} y2={cx + r*0.5}
          stroke={m.color} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    )
  }

  if (m.kind === 'empty') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cx} r={r + sw/2} fill="none" stroke={m.color} strokeWidth={sw}
          strokeDasharray={`${sw * 0.8} ${sw * 1.2}`} />
      </svg>
    )
  }

  // arc (partial donut, starting at 12 o'clock = -90deg rotation)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0"
      style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={sw} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={m.color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={c * (1 - m.pct)} strokeLinecap="round" />
    </svg>
  )
}

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new:           'New',
  chatting:      'Chatting',
  qualified:     'Qualified',
  awaiting_docs: 'Awaiting Docs',
  processing:    'Processing',
  completed:     'Completed',
  rejected:      'Rejected',
}
