import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateJSON } from '@/lib/ai'
import { ANALYSIS_SYSTEM_PROMPT } from '@/lib/prompts'
import { z } from 'zod'

const AnalysisSchema = z.object({
  coverage_gaps: z.string(),
  potential_savings: z.string(),
  risk_flags: z.string(),
  recommendation: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  confidence_score: z.number().min(0).max(100),
})

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

    // Fetch lead + all extracted data
    const [{ data: lead }, { data: extractions }] = await Promise.all([
      supabaseAdmin.from('leads').select('*').eq('id', leadId).single(),
      supabaseAdmin.from('extracted_data').select('*').eq('lead_id', leadId),
    ])

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const concerns = Array.from(new Set([...(lead.concerns ?? []), lead.primary_concern].filter(Boolean)))
    const context = `
CLIENT PROFILE:
Name: ${lead.name ?? 'Unknown'}
Age: ${lead.age ?? 'Unknown'}
Occupation: ${lead.occupation ?? 'Unknown'}
Annual Income: ${lead.annual_income ? `₹${lead.annual_income.toLocaleString()}` : 'Unknown'}
Family Size: ${lead.family_size ?? 'Unknown'}
Concerns: ${concerns.length ? concerns.join(', ') : 'Unknown'}
Location: ${lead.location ?? 'Unknown'}
Existing Coverage Summary: ${lead.existing_coverage ?? 'None mentioned'}

EXISTING INSURANCE DOCUMENTS (${extractions?.length ?? 0} found):
${(extractions ?? []).map((e, i) => `
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

    const rawJson = await generateJSON(
      [{ role: 'user', content: `Analyse this insurance client and generate recommendations:\n\n${context}` }],
      ANALYSIS_SYSTEM_PROMPT
    )

    let analysisData: z.infer<typeof AnalysisSchema>
    try {
      analysisData = AnalysisSchema.parse(JSON.parse(rawJson))
    } catch {
      return NextResponse.json({ error: 'AI returned invalid analysis format' }, { status: 500 })
    }

    // Upsert analysis (one per lead)
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

    // Mark lead as completed
    await supabaseAdmin.from('leads').update({ status: 'completed' }).eq('id', leadId)

    return NextResponse.json(analysis)
  } catch (err) {
    console.error('[/api/analysis]', err)
    return NextResponse.json({ error: 'Analysis generation failed' }, { status: 500 })
  }
}
