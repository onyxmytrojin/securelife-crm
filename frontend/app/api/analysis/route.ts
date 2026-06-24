import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateJSON } from '@/lib/ai'
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/prompts'
import { logger } from '@/lib/logger'
import { notifyBrokerAnalysisReady } from '@/lib/notifications'
import { z } from 'zod'

const ROUTE = '/api/analysis'

const AnalysisSchema = z.object({
  coverage_gaps: z.string(),
  potential_savings: z.string(),
  risk_flags: z.string(),
  recommendation: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  confidence_score: z.number().min(0).max(100),
})

export async function POST(req: NextRequest) {
  const t = Date.now()
  try {
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

    logger.info(ROUTE, `POST generating analysis for lead:${leadId}`)

    const [{ data: lead }, { data: extractions }, { data: conversations }] = await Promise.all([
      supabaseAdmin.from('leads').select('*').eq('id', leadId).single(),
      supabaseAdmin.from('extracted_data').select('*').eq('lead_id', leadId),
      supabaseAdmin.from('conversations').select('role, content').eq('lead_id', leadId).order('created_at', { ascending: true }),
    ])

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    logger.info(ROUTE, `lead:${leadId} — ${extractions?.length ?? 0} docs, ${conversations?.length ?? 0} messages, concerns: ${[...(lead.concerns ?? []), lead.primary_concern].filter(Boolean).join(', ')}`)

    const concerns = Array.from(new Set([...(lead.concerns ?? []), lead.primary_concern].filter(Boolean)))

    // Build conversation transcript (exclude system messages; cap at last 40 messages to stay within token budget)
    const transcript = (conversations ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-40)
      .map(m => `${m.role === 'user' ? 'Client' : 'Aria (advisor)'}: ${m.content}`)
      .join('\n')

    const context = `
CLIENT PROFILE (structured fields captured during chat):
Name: ${lead.name ?? 'Unknown'}
Age: ${lead.age ?? 'Unknown'}
Occupation: ${lead.occupation ?? 'Unknown'}
Annual Income: ${lead.annual_income ? `₹${lead.annual_income.toLocaleString()}` : 'Unknown'}
Family Size: ${lead.family_size ?? 'Unknown'}
Insurance Concerns: ${concerns.length ? concerns.join(', ') : 'Unknown'}
Location: ${lead.location ?? 'Unknown'}
Existing Coverage (self-reported): ${lead.existing_coverage ?? 'None mentioned'}

FULL CONVERSATION TRANSCRIPT (${(conversations ?? []).length} messages — use this to understand what the client actually said about their needs, situation, and concerns):
${transcript || 'No conversation recorded yet.'}

EXISTING INSURANCE DOCUMENTS (${extractions?.length ?? 0} uploaded and extracted):
${(extractions ?? []).length === 0
  ? 'No documents uploaded yet.'
  : (extractions ?? []).map((e, i) => `
Document ${i + 1}:
  Policy Type: ${e.policy_type ?? 'Unknown'}
  Provider: ${e.provider_name ?? 'Unknown'}
  Sum Insured: ${e.sum_insured ? `₹${Number(e.sum_insured).toLocaleString()}` : 'Unknown'}
  Premium: ${e.premium_amount ? `₹${Number(e.premium_amount).toLocaleString()} ${e.premium_frequency ?? ''}` : 'Unknown'}
  Coverage: ${e.coverage_start ?? '?'} to ${e.coverage_end ?? '?'}
  Renewal Date: ${e.renewal_date ?? 'Unknown'}
  Pre-existing Conditions: ${e.pre_existing_conditions ?? 'None declared'}
  Exclusions: ${e.exclusions ?? 'None listed'}
  Claim History: ${e.claim_history ?? 'None'}
`).join('\n')}
`.trim()

    const aiStart = Date.now()
    const rawJson = await generateJSON(
      [{ role: 'user', content: `A new client file has landed on your desk. Review it thoroughly and produce your full advisory analysis. Do not hold back — the broker needs your honest, senior assessment to walk into this meeting prepared.\n\n${context}` }],
      ANALYSIS_SYSTEM_PROMPT
    )
    logger.info(ROUTE, `AI analysis generated in ${Date.now() - aiStart}ms`)

    let analysisData: z.infer<typeof AnalysisSchema>
    try {
      analysisData = AnalysisSchema.parse(JSON.parse(rawJson))
    } catch {
      logger.error(ROUTE, `lead:${leadId} — AI returned invalid analysis format`)
      return NextResponse.json({ error: 'AI returned invalid analysis format' }, { status: 500 })
    }

    const { data: existing } = await supabaseAdmin
      .from('analyses')
      .select('id')
      .eq('lead_id', leadId)
      .single()

    const { data: analysis, error } = existing
      ? await supabaseAdmin
          .from('analyses')
          .update({ ...analysisData, raw_analysis: JSON.parse(rawJson) })
          .eq('id', existing.id)
          .select()
          .single()
      : await supabaseAdmin
          .from('analyses')
          .insert({ ...analysisData, lead_id: leadId, raw_analysis: JSON.parse(rawJson) })
          .select()
          .single()

    if (error) throw error

    await supabaseAdmin.from('leads').update({ status: 'completed' }).eq('id', leadId)

    // Fire-and-forget broker notification
    void notifyBrokerAnalysisReady(lead, analysisData).catch(() => {})

    logger.info(ROUTE, `lead:${leadId} analysis ${existing ? 'updated' : 'created'} priority:${analysisData.priority} confidence:${analysisData.confidence_score}% (${Date.now() - t}ms total)`)
    return NextResponse.json(analysis)
  } catch (err) {
    logger.error(ROUTE, `POST failed (${Date.now() - t}ms)`, { error: String(err) })
    return NextResponse.json({ error: 'Analysis generation failed' }, { status: 500 })
  }
}
