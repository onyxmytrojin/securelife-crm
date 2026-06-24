import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { notifyBrokerQualified, notifyCustomerDocsRequested } from '@/lib/notifications'

const ROUTE = '/api/leads'

export async function GET() {
  const t = Date.now()
  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    logger.info(ROUTE, `GET — ${data.length} leads (${Date.now() - t}ms)`)
    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error(ROUTE, `GET failed (${Date.now() - t}ms)`, { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const t = Date.now()
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('leads')
    .insert({ ...body, source: body.source ?? 'manual' })
    .select()
    .single()

  if (error) {
    logger.error(ROUTE, `POST create failed (${Date.now() - t}ms)`, { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag('leads', 'max')
  logger.info(ROUTE, `POST created lead ${data.id} (${Date.now() - t}ms)`)
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const t = Date.now()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('leads').delete().eq('id', id)
  if (error) {
    logger.error(ROUTE, `DELETE ${id} failed (${Date.now() - t}ms)`, { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag('leads', 'max')
  logger.info(ROUTE, `DELETE ${id} (${Date.now() - t}ms)`)
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const t = Date.now()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Fetch current status before update so we know if it changed
  const { data: before } = await supabaseAdmin
    .from('leads').select('status').eq('id', id).single()
  const prevStatus = before?.status as string | undefined

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    logger.error(ROUTE, `PATCH ${id} failed (${Date.now() - t}ms)`, { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag('leads', 'max')
  logger.info(ROUTE, `PATCH ${id} → ${JSON.stringify(updates)} (${Date.now() - t}ms)`)

  // Fire-and-forget email notifications on meaningful status transitions
  const newStatus = updates.status as string | undefined
  if (newStatus && newStatus !== prevStatus) {
    if (newStatus === 'qualified') {
      void notifyBrokerQualified(data).catch(() => {})
    }
    if (newStatus === 'awaiting_docs') {
      void notifyCustomerDocsRequested(data).catch(() => {})
    }
  }

  return NextResponse.json(data)
}
