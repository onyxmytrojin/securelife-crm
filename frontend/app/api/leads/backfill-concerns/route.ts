import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractConcernsFromMessage, extractFieldsFromMessage } from '@/lib/concerns'
import { logger } from '@/lib/logger'

const ROUTE = '/api/leads/backfill-concerns'

export async function POST() {
  const t = Date.now()
  try {
    // Fetch all leads — backfill any missing fields
    const { data: leads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, concerns, primary_concern, phone, age, family_size')

    if (leadsErr) throw leadsErr

    let updated = 0
    for (const lead of leads ?? []) {
      const missingConcerns    = !lead.concerns?.length || !lead.primary_concern
      const missingPhone       = !lead.phone
      const missingAge         = !lead.age
      const missingFamilySize  = !lead.family_size
      if (!missingConcerns && !missingPhone && !missingAge && !missingFamilySize) continue

      const { data: convs } = await supabaseAdmin
        .from('conversations')
        .select('content')
        .eq('lead_id', lead.id)
        .eq('role', 'user')

      const allText = (convs ?? []).map(m => m.content).join(' ')
      const update: Record<string, unknown> = {}

      // Concerns
      if (missingConcerns) {
        const found  = (convs ?? []).flatMap(m => extractConcernsFromMessage(m.content))
        const merged = Array.from(new Set([...(lead.concerns ?? []), ...found]))
        if (merged.length > 0) {
          update.concerns = merged
          if (!lead.primary_concern) update.primary_concern = merged[0]
        }
      }

      // Phone, age, family_size — scan all user messages
      const fields = extractFieldsFromMessage(allText)
      if (missingPhone      && fields.phone)       update.phone       = fields.phone
      if (missingAge        && fields.age)         update.age         = fields.age
      if (missingFamilySize && fields.family_size) update.family_size = fields.family_size

      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from('leads').update(update).eq('id', lead.id)
        updated++
      }
    }

    logger.info(ROUTE, `backfill done — ${updated}/${leads?.length ?? 0} leads updated (${Date.now() - t}ms)`)
    return NextResponse.json({ processed: leads?.length ?? 0, updated })
  } catch (err) {
    logger.error(ROUTE, `backfill failed`, { error: String(err) })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
