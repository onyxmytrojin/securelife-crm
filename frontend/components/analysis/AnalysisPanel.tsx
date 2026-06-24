'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Analysis } from '@/lib/types'
import { AlertTriangle, TrendingDown, Zap, ArrowRight, Loader2, BarChart3 } from 'lucide-react'

const priorityColors: Record<string, string> = {
  low:    'bg-gray-50 dark:bg-[#1E2028] text-gray-600 dark:text-[#A1A7B3] border-gray-200 dark:border-[#2A2A2A]',
  medium: 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50',
  high:   'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50',
  urgent: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50',
}

function Section({ icon: Icon, title, content, color }: {
  icon: React.ElementType
  title: string
  content: string
  color: string
}) {
  return (
    <div className={`rounded-xl p-4 border ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  )
}

export function AnalysisPanel({ leadId, existing }: { leadId: string; existing: Analysis | null }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(existing)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const generate = async () => {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAnalysis(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate analysis')
    } finally {
      setLoading(false)
    }
  }

  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#1E2028] p-8 text-center">
        <BarChart3 className="w-8 h-8 text-gray-300 dark:text-[#3A3A3A] mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-[#A1A7B3] mb-1">No analysis yet</p>
        <p className="text-xs text-gray-400 dark:text-[#6E7480] mb-4">
          Generate an AI-powered gap analysis based on the client profile and uploaded documents.
        </p>
        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-3">{error}</p>}
        <Button onClick={generate} disabled={loading} size="sm"
          className="bg-[#5E6AD2] hover:bg-[#6B78E7] text-white border-0">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</> : 'Generate Analysis'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-[#F7F8FA]">AI Analysis</span>
          <Badge variant="outline" className={`text-xs capitalize ${priorityColors[analysis.priority] ?? priorityColors.low}`}>
            {analysis.priority} priority
          </Badge>
          {analysis.confidence_score != null && (
            <span className="text-xs text-gray-400 dark:text-[#6E7480]">{analysis.confidence_score}% confidence</span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={generate} disabled={loading}
          className="border-gray-200 dark:border-[#1E2028] dark:text-[#A1A7B3] dark:bg-transparent dark:hover:bg-[#171A1F]">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      <Section icon={AlertTriangle} title="Coverage Gaps"
        content={analysis.coverage_gaps ?? ''}
        color="bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300 border-orange-100 dark:border-orange-900/40" />
      <Section icon={TrendingDown} title="Potential Savings"
        content={analysis.potential_savings ?? ''}
        color="bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 border-green-100 dark:border-green-900/40" />
      <Section icon={Zap} title="Risk Flags"
        content={analysis.risk_flags ?? ''}
        color="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-100 dark:border-red-900/40" />
      <Section icon={ArrowRight} title="Broker Recommendation"
        content={analysis.recommendation ?? ''}
        color="bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-900/40" />
    </div>
  )
}
