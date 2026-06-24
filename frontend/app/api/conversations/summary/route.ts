import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateJSON } from '@/lib/ai'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const ROUTE = '/api/conversations/summary'

const SummarySchema = z.object({
  headline: z.string(),
  key_points: z.array(z.string()),
  lead_intent: z.string(),
  concerns_raised: z.string().nullable().optional().transform(v => v ?? undefined),
  next_step: z.string(),
})

export async function POST(req: NextRequest) {
  const t = Date.now()
  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

  const { data: conversations } = await supabaseAdmin
    .from('conversations')
    .select('role, content')
    .eq('lead_id', leadId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })

  if (!conversations?.length) {
    logger.warn(ROUTE, `lead:${leadId} — no conversation found`)
    return NextResponse.json({ error: 'No conversation found' }, { status: 404 })
  }

  logger.info(ROUTE, `POST lead:${leadId} — summarising ${conversations.length} messages`)

  const transcript = conversations
    .map(m => `${m.role === 'user' ? 'Client' : 'Aria (AI)'}: ${m.content}`)
    .join('\n')

  const prompt = `Summarise this insurance advisor conversation for a broker. Be concise and factual.

CONVERSATION:
${transcript}

Return JSON with:
- headline: one sentence describing the client and their primary need
- key_points: array of 3-5 bullet points (facts captured — age, income, family, existing cover, etc.)
- lead_intent: what insurance they're looking for and why
- concerns_raised: any objections, worries or edge cases the client mentioned (or null)
- next_step: what the broker should do next`

  try {
    const aiStart = Date.now()
    const raw = await generateJSON([{ role: 'user', content: prompt }],
      'You are a concise insurance CRM assistant. Summarise conversations for brokers.')
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned
    const summary = SummarySchema.parse(parsed)
    logger.info(ROUTE, `lead:${leadId} summary done in ${Date.now() - aiStart}ms (${Date.now() - t}ms total)`)
    return NextResponse.json(summary)
  } catch (err) {
    logger.error(ROUTE, `lead:${leadId} summary failed (${Date.now() - t}ms)`, { error: String(err) })
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 })
  }
}
