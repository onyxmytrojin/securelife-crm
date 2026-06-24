import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { chat, type Message } from '@/lib/ai'
import { buildChatSystemPrompt, CHAT_WELCOME_MESSAGE } from '@/lib/prompts'
import { logger } from '@/lib/logger'
import { redis, chatRatelimit } from '@/lib/redis'

const ROUTE = '/api/chat'

export async function POST(req: NextRequest) {
  const t = Date.now()
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
    const { success, remaining } = await chatRatelimit.limit(ip)
    if (!success) {
      logger.warn(ROUTE, `rate limit hit for ip:${ip}`)
      return NextResponse.json({ error: 'Too many messages. Please wait a moment.' }, { status: 429 })
    }
    logger.debug(ROUTE, `ip:${ip} remaining quota: ${remaining}/20`)

    const { message, leadId, documentContext, userProfile } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Get or create lead
    let currentLeadId = leadId
    if (!currentLeadId) {
      const seedData: Record<string, unknown> = { status: 'chatting', source: 'chatbot' }
      if (userProfile?.name)  seedData.name  = userProfile.name
      if (userProfile?.email) seedData.email = userProfile.email

      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert(seedData)
        .select('id')
        .single()
      if (error) throw error
      currentLeadId = data.id
      revalidateTag('leads', 'max')
      logger.info(ROUTE, `new lead created ${currentLeadId}`, { seeded: Object.keys(seedData) })

      await supabaseAdmin.from('conversations').insert({
        lead_id: currentLeadId,
        role: 'assistant',
        content: CHAT_WELCOME_MESSAGE,
      })
    }

    logger.info(ROUTE, `POST lead:${currentLeadId} msg:"${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`)

    // Save user message
    await supabaseAdmin.from('conversations').insert({
      lead_id: currentLeadId,
      role: 'user',
      content: message,
    })

    // Load conversation history — Redis cache first, Supabase fallback
    const cacheKey = `conv:${currentLeadId}`
    let messages: Message[] = []
    const cached = await redis.get<Message[]>(cacheKey)
    if (cached) {
      messages = cached
      logger.debug(ROUTE, `lead:${currentLeadId} history from cache (${cached.length} msgs)`)
    } else {
      const { data: history } = await supabaseAdmin
        .from('conversations')
        .select('role, content')
        .eq('lead_id', currentLeadId)
        .order('created_at', { ascending: true })
      messages = (history ?? [])
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      logger.debug(ROUTE, `lead:${currentLeadId} history from db (${messages.length} msgs)`)
    }

    if (documentContext) {
      messages.push({
        role: 'user',
        content: `[SYSTEM NOTE — not shown to client] The client just uploaded an insurance document. Here are the extracted fields:\n${documentContext}\n\nPlease acknowledge the document and comment on what you can see from their existing coverage.`,
      })
    }

    // Call AI — inject known profile so it skips asking for name/email
    const aiStart = Date.now()
    const reply = await chat(messages, buildChatSystemPrompt(userProfile))
    logger.info(ROUTE, `AI replied in ${Date.now() - aiStart}ms (${reply.length} chars)`)

    // Parse LEAD_DATA if present and update lead
    // Use a greedy match to capture the full JSON object (arrays use [] not {}, so first } closes the root)
    const leadDataMatch = reply.match(/LEAD_DATA:(\{[^]*?\})(?:\s|$|CHOICES|MULTI_CHOICES)/)
      ?? reply.match(/LEAD_DATA:(\{[^]*\})/)
    const cleanReply = reply.replace(/LEAD_DATA:\{[^]*?\}/, '').trim()

    if (leadDataMatch) {
      try {
        const leadData = JSON.parse(leadDataMatch[1])
        const updates: Record<string, unknown> = {}
        // Prefer LEAD_DATA fields; fall back to userProfile for name/email if AI left them blank
        const resolvedName  = leadData.name  || userProfile?.name  || null
        const resolvedEmail = leadData.email || userProfile?.email || null
        if (resolvedName)               updates.name = resolvedName
        if (resolvedEmail)              updates.email = resolvedEmail
        if (leadData.phone)             updates.phone = leadData.phone
        if (leadData.age)               updates.age = leadData.age
        if (leadData.occupation)        updates.occupation = leadData.occupation
        if (leadData.annual_income)     updates.annual_income = leadData.annual_income
        if (leadData.family_size)       updates.family_size = leadData.family_size
        if (leadData.existing_coverage) updates.existing_coverage = leadData.existing_coverage
        if (Array.isArray(leadData.concerns) && leadData.concerns.length > 0) {
          updates.concerns = Array.from(new Set(leadData.concerns.filter(Boolean)))
          if (!updates.primary_concern) updates.primary_concern = leadData.concerns[0]
        }
        if (leadData.primary_concern) {
          updates.primary_concern = leadData.primary_concern
          if (!updates.concerns) updates.concerns = [leadData.primary_concern]
        }
        if (leadData.location) updates.location = leadData.location

        if (Object.keys(updates).length > 0) {
          // Only mark qualified when we have contact info + at least one concern
          const hasContact = !!(updates.phone || updates.email)
          const hasConcern = !!(updates.primary_concern || (Array.isArray(updates.concerns) && (updates.concerns as string[]).length > 0))
          if (hasContact && hasConcern) updates.status = 'qualified'
          updates.score = Math.min(
            100,
            Object.values(updates).filter(v => v !== null && v !== undefined && v !== '').length * 10
          )
          await supabaseAdmin.from('leads').update(updates).eq('id', currentLeadId)
          logger.info(ROUTE, `lead:${currentLeadId} updated`, { fields: Object.keys(updates), qualified: updates.status === 'qualified' })
        }
      } catch {
        logger.warn(ROUTE, `lead:${currentLeadId} LEAD_DATA parse failed — malformed JSON from AI`)
      }
    }

    // Save assistant reply + invalidate Redis cache so next fetch is fresh
    await supabaseAdmin.from('conversations').insert({
      lead_id: currentLeadId,
      role: 'assistant',
      content: cleanReply,
    })
    await redis.del(`conv:${currentLeadId}`)

    logger.info(ROUTE, `POST done lead:${currentLeadId} (${Date.now() - t}ms total)`)
    return NextResponse.json({ reply: cleanReply, leadId: currentLeadId })
  } catch (err) {
    logger.error(ROUTE, `POST failed (${Date.now() - t}ms)`, { error: String(err) })
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
