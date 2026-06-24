/**
 * Twilio WhatsApp webhook — receives inbound WhatsApp messages and runs them
 * through the same Aria chat pipeline used by the web chatbot.
 *
 * Setup:
 *   1. In Twilio Console → Messaging → Senders → WhatsApp sandbox (or production number)
 *   2. Set "When a message comes in" webhook URL to:
 *      https://your-vercel-app.vercel.app/api/webhooks/whatsapp
 *   3. Method: HTTP POST
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { chat, type Message } from '@/lib/ai'
import { buildChatSystemPrompt } from '@/lib/prompts'
import { extractConcernsFromMessage, extractFieldsFromMessage } from '@/lib/concerns'
import { logger } from '@/lib/logger'

const ROUTE = '/api/webhooks/whatsapp'

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? ''
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN  ?? ''
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER ?? ''  // e.g. +14155238886

// ─── Send WhatsApp reply via Twilio REST API ──────────────────────────────────

async function sendWhatsApp(to: string, body: string) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    logger.warn(ROUTE, 'Twilio env vars not set — reply not sent')
    return
  }
  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')
  const res  = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${FROM_NUMBER}`,
        To:   `whatsapp:${to}`,
        Body: body,
      }).toString(),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    logger.error(ROUTE, `Twilio send failed: ${err}`)
  }
}

// ─── Strip WhatsApp prefix from phone number ──────────────────────────────────

function parsePhone(twilioFrom: string) {
  // Twilio sends "whatsapp:+919876543210"
  return twilioFrom.replace(/^whatsapp:/, '')
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t = Date.now()

  try {
    // Parse Twilio's form-encoded body
    const formData = await req.formData()
    const from    = formData.get('From')    as string | null
    const body    = formData.get('Body')    as string | null
    const profile = formData.get('ProfileName') as string | null  // WhatsApp display name (sandbox only)

    if (!from || !body?.trim()) {
      return new NextResponse('', { status: 200 }) // Twilio expects 200 even on skip
    }

    const phone   = parsePhone(from)
    const message = body.trim()

    logger.info(ROUTE, `Inbound WhatsApp from ${phone}: "${message.slice(0, 60)}"`)

    // ── Find or create lead ──────────────────────────────────────────────────
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, phone, status, concerns, primary_concern, age, occupation, annual_income, family_size')
      .eq('phone', phone)
      .eq('source', 'whatsapp')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let leadId: string
    let leadName: string | null = existingLead?.name ?? profile ?? null

    if (existingLead) {
      leadId = existingLead.id
      logger.info(ROUTE, `Resuming WhatsApp lead ${leadId}`)
    } else {
      // New contact — create lead
      const seedData: Record<string, unknown> = {
        status:       'chatting',
        source:       'whatsapp',
        phone,
        session_type: 'new_inquiry',
      }
      if (profile) seedData.name = profile

      const { data: newLead, error } = await supabaseAdmin
        .from('leads')
        .insert(seedData)
        .select('id')
        .single()
      if (error) throw error
      leadId   = newLead.id
      logger.info(ROUTE, `New WhatsApp lead created: ${leadId}`)

      // Save welcome message as first assistant turn
      const welcome = leadName
        ? `Hi ${leadName.split(' ')[0]}! I'm Aria from SecureLife Insurance. I'm here to understand your insurance needs and help you find the right coverage. What brings you here today?`
        : "Hi! I'm Aria from SecureLife Insurance. I'm here to understand your insurance needs and help you find the right coverage. Could you start by telling me your name?"
      await supabaseAdmin.from('conversations').insert({
        lead_id: leadId, role: 'assistant', content: welcome,
      })
    }

    // ── Save inbound message ─────────────────────────────────────────────────
    await supabaseAdmin.from('conversations').insert({
      lead_id: leadId, role: 'user', content: message,
    })

    // ── Immediate regex extraction (same as web chat) ─────────────────────────
    const msgConcerns = extractConcernsFromMessage(message)
    const msgFields   = extractFieldsFromMessage(message)

    if (msgConcerns.length > 0 || Object.keys(msgFields).length > 0) {
      const { data: current } = await supabaseAdmin
        .from('leads')
        .select('concerns, primary_concern, phone, age, family_size, annual_income, occupation')
        .eq('id', leadId)
        .single()

      const update: Record<string, unknown> = {}
      if (msgConcerns.length > 0) {
        const merged = [...new Set([...(current?.concerns ?? []), ...msgConcerns])]
        update.concerns = merged
        if (!current?.primary_concern) update.primary_concern = msgConcerns[0]
      }
      if (msgFields.phone          && !current?.phone)          update.phone          = msgFields.phone
      if (msgFields.age            && !current?.age)            update.age            = msgFields.age
      if (msgFields.family_size    && !current?.family_size)    update.family_size    = msgFields.family_size
      if (msgFields.annual_income  && !current?.annual_income)  update.annual_income  = msgFields.annual_income
      if (msgFields.occupation     && !current?.occupation)     update.occupation     = msgFields.occupation
      if (Object.keys(update).length > 0) {
        await supabaseAdmin.from('leads').update(update).eq('id', leadId)
      }
    }

    // ── Load conversation history ─────────────────────────────────────────────
    const { data: history } = await supabaseAdmin
      .from('conversations')
      .select('role, content')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    const messages: Message[] = (history ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-30) // cap to keep token budget manageable on WhatsApp threads
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // ── Call AI ───────────────────────────────────────────────────────────────
    const userProfile = leadName ? { name: leadName, email: existingLead?.email ?? null } : undefined
    const systemPrompt = buildChatSystemPrompt(userProfile ?? undefined)
    const aiStart = Date.now()
    const reply   = await chat(messages, systemPrompt)
    logger.info(ROUTE, `AI replied in ${Date.now() - aiStart}ms`)

    // Strip LEAD_DATA from reply before sending to user (not relevant on WhatsApp)
    const cleanReply = reply
      .replace(/LEAD_DATA:\{[^]*?\}/g, '')
      .replace(/CHOICES:\[[\s\S]*?\]/g, '')
      .replace(/MULTI_CHOICES:\[[\s\S]*?\]/g, '')
      .replace(/NUMBER_INPUT:\{[^}]+\}/g, '')
      .trim()

    // Parse LEAD_DATA if present and update lead
    const leadDataMatch = reply.match(/LEAD_DATA:(\{[^]*?\})/)
    if (leadDataMatch) {
      try {
        const leadData = JSON.parse(leadDataMatch[1])
        const updates: Record<string, unknown> = {}
        if (leadData.name)             updates.name          = leadData.name
        if (leadData.email)            updates.email         = leadData.email
        if (leadData.age)              updates.age           = leadData.age
        if (leadData.occupation)       updates.occupation    = leadData.occupation
        if (leadData.annual_income)    updates.annual_income = leadData.annual_income
        if (leadData.family_size)      updates.family_size   = leadData.family_size
        if (leadData.existing_coverage) updates.existing_coverage = leadData.existing_coverage
        if (leadData.location)         updates.location      = leadData.location
        if (Array.isArray(leadData.concerns) && leadData.concerns.length > 0) {
          updates.concerns = Array.from(new Set(leadData.concerns.filter(Boolean)))
          updates.primary_concern = leadData.concerns[0]
        }
        const hasContact = !!(updates.phone || updates.email)
        const hasConcern = !!(updates.primary_concern || (Array.isArray(updates.concerns) && (updates.concerns as string[]).length > 0))
        if (hasContact && hasConcern) updates.status = 'qualified'
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from('leads').update(updates).eq('id', leadId)
        }
      } catch { /* ignore malformed LEAD_DATA */ }
    }

    // ── Save AI reply to DB ───────────────────────────────────────────────────
    await supabaseAdmin.from('conversations').insert({
      lead_id: leadId, role: 'assistant', content: cleanReply,
    })

    // ── Send WhatsApp reply ───────────────────────────────────────────────────
    await sendWhatsApp(phone, cleanReply)

    logger.info(ROUTE, `WhatsApp handled lead:${leadId} (${Date.now() - t}ms)`)

    // Twilio expects an empty 200 (or a TwiML response — empty is fine for REST API webhooks)
    return new NextResponse('', { status: 200 })

  } catch (err) {
    logger.error(ROUTE, `POST failed (${Date.now() - t}ms)`, { error: String(err) })
    return new NextResponse('', { status: 200 }) // Always 200 to Twilio to avoid retries
  }
}
