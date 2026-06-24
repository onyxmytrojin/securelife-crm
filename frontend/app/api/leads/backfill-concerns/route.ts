import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractConcernsFromMessage } from '@/lib/concerns'
import { logger } from '@/lib/logger'

const ROUTE = '/api/leads/backfill-concerns'

export async function POST() {
  const t = Date.now()
  try {
    // Fetch leads with no concerns set
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, concerns, primary_concern')
      .or('concerns.is.null,primary_concern.is.null')

    if (leadsErr) throw leadsErr

    let updated = 0
    for (const lead of leads ?? []) {
      if (lead.concerns?.length > 0 && lead.primary_concern) continue

      const { data: convs } = await supabaseAdmin
        .from('conversations')
        .select('content')
        .eq('lead_id', lead.id)
        .eq('role', 'user')

      const found = (convs ?? []).flatMap(m => extractConcernsFromMessage(m.content))
      const merged = Array.from(new Set([...(lead.concerns ?? []), ...found]))
      if (merged.length === 0) continue

      await supabaseAdmin.from('leads').update({
        concerns: merged,
        primary_concern: lead.primary_concern || merged[0],
      }).eq('id', lead.id)
      updated++
    }

    logger.info(ROUTE, `backfill done — ${updated}/${leads?.length ?? 0} leads updated (${Date.now() - t}ms)`)
    return NextResponse.json({ processed: leads?.length ?? 0, updated })
  } catch (err) {
    logger.error(ROUTE, `backfill failed`, { error: String(err) })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
