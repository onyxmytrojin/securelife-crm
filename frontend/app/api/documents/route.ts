import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateJSON } from '@/lib/ai'
import { extractTextFromPDF } from '@/lib/pdf'
import { EXTRACTION_SYSTEM_PROMPT } from '@/lib/prompts'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const ROUTE = '/api/documents'

const ExtractionSchema = z.object({
  policy_number: z.string().nullish(),
  policy_type: z.string().nullish(),
  provider_name: z.string().nullish(),
  policyholder_name: z.string().nullish(),
  sum_insured: z.number().nullish(),
  premium_amount: z.number().nullish(),
  premium_frequency: z.string().nullish(),
  coverage_start: z.string().nullish(),
  coverage_end: z.string().nullish(),
  renewal_date: z.string().nullish(),
  pre_existing_conditions: z.string().nullish(),
  exclusions: z.string().nullish(),
  waiting_period: z.string().nullish(),
  claim_history: z.string().nullish(),
  raw_fields: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const t = Date.now()
  try {
    const formData = await req.formData()
    const file   = formData.get('file') as File | null
    const leadId = formData.get('leadId') as string | null

    if (!file || !leadId) {
      return NextResponse.json({ error: 'file and leadId required' }, { status: 400 })
    }

    logger.info(ROUTE, `POST lead:${leadId} file:"${file.name}" (${(file.size / 1024).toFixed(1)}KB)`)

    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        lead_id: leadId,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/pdf',
        status: 'processing',
      })
      .select()
      .single()

    if (docError) throw docError

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let rawText: string

    try {
      rawText = await extractTextFromPDF(buffer)
      logger.info(ROUTE, `PDF text extracted — ${rawText.length} chars`)
    } catch {
      await supabaseAdmin
        .from('documents')
        .update({ status: 'failed', error: 'no_text_layer' })
        .eq('id', doc.id)
      logger.warn(ROUTE, `lead:${leadId} PDF "${file.name}" has no text layer`)
      return NextResponse.json(
        { error: 'Could not read PDF text. Please upload a text-searchable PDF.' },
        { status: 422 }
      )
    }

    // Ask AI to extract structured data
    const aiStart = Date.now()
    const prompt = `Extract structured insurance data from this document:\n\n${rawText.slice(0, 12000)}`
    const rawJson = await generateJSON(
      [{ role: 'user', content: prompt }],
      EXTRACTION_SYSTEM_PROMPT
    )
    logger.info(ROUTE, `AI extraction done in ${Date.now() - aiStart}ms`)

    let extracted: z.infer<typeof ExtractionSchema>
    try {
      extracted = ExtractionSchema.parse(JSON.parse(rawJson))
    } catch {
      await supabaseAdmin
        .from('documents')
        .update({ status: 'failed', error: 'extraction_parse_failed' })
        .eq('id', doc.id)
      logger.error(ROUTE, `lead:${leadId} AI extraction returned invalid schema`)
      return NextResponse.json({ error: 'AI extraction failed to return valid data' }, { status: 500 })
    }

    if (extracted.error === 'no_text_layer') {
      await supabaseAdmin
        .from('documents')
        .update({ status: 'failed', error: 'no_text_layer' })
        .eq('id', doc.id)
      return NextResponse.json({ error: 'PDF has no readable text layer' }, { status: 422 })
    }

    const { data: extractedRecord, error: extractError } = await supabaseAdmin
      .from('extracted_data')
      .insert({ ...extracted, document_id: doc.id, lead_id: leadId, raw_fields: extracted.raw_fields ?? {} })
      .select()
      .single()

    if (extractError) throw extractError

    await Promise.all([
      supabaseAdmin.from('documents').update({ status: 'extracted' }).eq('id', doc.id),
      supabaseAdmin.from('leads').update({ status: 'processing' }).eq('id', leadId),
    ])

    logger.info(ROUTE, `lead:${leadId} doc:${doc.id} extracted — policy:${extracted.policy_type ?? '?'} provider:${extracted.provider_name ?? '?'} (${Date.now() - t}ms total)`)
    return NextResponse.json({ document: doc, extracted: extractedRecord })
  } catch (err) {
    logger.error(ROUTE, `POST failed (${Date.now() - t}ms)`, { error: String(err) })
    return NextResponse.json({ error: 'Document processing failed' }, { status: 500 })
  }
}
