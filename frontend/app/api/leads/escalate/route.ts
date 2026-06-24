import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Escalation rules: how many hours a lead can sit in a status before being flagged
const RULES: Record<string, { hours: number; action: string }> = {
  new:           { hours: 24,  action: 'Lead going cold — no conversation started' },
  qualified:     { hours: 48,  action: 'Qualified lead not reviewed by broker' },
  awaiting_docs: { hours: 72,  action: 'Client has not uploaded documents' },
  processing:    { hours: 24,  action: 'Documents uploaded but analysis not generated' },
}

export async function POST() {
  const now = Date.now()
  const results: { id: string; name: string | null; status: string; action: string; hoursStale: number }[] = []

  for (const [status, rule] of Object.entries(RULES)) {
    const cutoff = new Date(now - rule.hours * 3600 * 1000).toISOString()

    const { data: staleLeads } = await supabaseAdmin
      .from('leads')
      .select('id, name, status, updated_at')
      .eq('status', status)
      .lt('updated_at', cutoff)

    if (!staleLeads?.length) continue

    for (const lead of staleLeads) {
      const hoursStale = Math.floor((now - new Date(lead.updated_at).getTime()) / 3600000)

      // Add a note to the lead flagging it
      await supabaseAdmin.from('leads').update({
        notes: `[AUTO] ${rule.action} — stale for ${hoursStale}h as of ${new Date().toLocaleDateString('en-IN')}`,
      }).eq('id', lead.id)

      results.push({ id: lead.id, name: lead.name, status, action: rule.action, hoursStale })
    }
  }

  if (results.length) revalidateTag('leads', 'max')

  return NextResponse.json({
    processed: results.length,
    flagged: results,
    ranAt: new Date().toISOString(),
  })
}

// Also allow GET so a Vercel cron can call it with: GET /api/leads/escalate
export async function GET() {
  return POST()
}
