import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { chat, type Message } from '@/lib/ai'
import {
  buildChatSystemPrompt,
  buildFollowUpSystemPrompt,
  buildFollowUpWelcomeMessage,
  CHAT_WELCOME_MESSAGE,
} from '@/lib/prompts'
import { logger } from '@/lib/logger'
import { redis, chatRatelimit } from '@/lib/redis'
import { extractConcernsFromMessage, extractFieldsFromMessage } from '@/lib/concerns'

const ROUTE = '/api/chat'

const PROFILE_KEYS = ['name', 'phone', 'age', 'occupation', 'annual_income', 'family_size', 'location', 'existing_coverage'] as const

async function syncProfileToSiblings(
  email: string,
  currentLeadId: string,
  profileFields: Record<string, unknown>
) {
  const hasProfileData = PROFILE_KEYS.some(k => profileFields[k] != null && profileFields[k] !== '')
  const hasConcerns = Array.isArray(profileFields.concerns) && (profileFields.concerns as string[]).length > 0
  if (!hasProfileData && !hasConcerns) return

  const { data: siblings } = await supabaseAdmin
    .from('leads')
    .select('id, ' + PROFILE_KEYS.join(', ') + ', concerns, primary_concern')
    .eq('email', email)
    .neq('id', currentLeadId)
    .neq('status', 'rejected')

  for (const sibling of siblings ?? []) {
    const sibUpdate: Record<string, unknown> = {}
    for (const key of PROFILE_KEYS) {
      if (profileFields[key] != null && profileFields[key] !== '' && !(sibling as Record<string, unknown>)[key]) {
        sibUpdate[key] = profileFields[key]
      }
    }
    if (hasConcerns) {
      const incoming = profileFields.concerns as string[]
      const merged = [...new Set([...(sibling.concerns ?? []), ...incoming])]
      if (merged.length > (sibling.concerns ?? []).length) sibUpdate.concerns = merged
      if (!sibling.primary_concern && merged.length > 0) sibUpdate.primary_concern = profileFields.primary_concern as string || merged[0]
    }
    if (Object.keys(sibUpdate).length > 0) {
      await supabaseAdmin.from('leads').update(sibUpdate).eq('id', sibling.id)
    }
  }
}

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

    const { message, leadId, documentContext, userProfile, parentLeadId, sessionType } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const isFollowUp = sessionType === 'follow_up' && !!parentLeadId

    // Get or create lead
    let currentLeadId = leadId
    if (!currentLeadId) {
      const seedData: Record<string, unknown> = { status: 'chatting', source: 'chatbot' }
      if (userProfile?.name)  seedData.name  = userProfile.name
      if (userProfile?.email) seedData.email = userProfile.email
      if (parentLeadId)       seedData.parent_lead_id = parentLeadId
      if (sessionType)        seedData.session_type   = sessionType

      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert(seedData)
        .select('id')
        .single()
      if (error) throw error
      currentLeadId = data.id
      revalidateTag('leads', 'max')
      logger.info(ROUTE, `new lead created ${currentLeadId}`, { seeded: Object.keys(seedData), isFollowUp })

      // Choose welcome message based on session type
      let welcomeContent = CHAT_WELCOME_MESSAGE
      if (isFollowUp) {
        const { data: parentLead } = await supabaseAdmin
          .from('leads')
          .select('name, primary_concern, concerns')
          .eq('id', parentLeadId)
          .single()
        const topic = parentLead?.concerns?.slice(0, 2).join(' & ')
          || parentLead?.primary_concern
          || 'insurance'
        welcomeContent = buildFollowUpWelcomeMessage(userProfile?.name ?? null, topic)
      }
      await supabaseAdmin.from('conversations').insert({
        lead_id: currentLeadId,
        role: 'assistant',
        content: welcomeContent,
      })
    }

    // Always sync auth identity — name/email from login are ground truth, don't wait for AI extraction
    if (userProfile?.name || userProfile?.email) {
      const identityUpdate: Record<string, unknown> = {}
      if (userProfile.name)  identityUpdate.name  = userProfile.name
      if (userProfile.email) identityUpdate.email = userProfile.email
      await supabaseAdmin.from('leads').update(identityUpdate).eq('id', currentLeadId)
    }

    logger.info(ROUTE, `POST lead:${currentLeadId} msg:"${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`)

    // Save user message
    await supabaseAdmin.from('conversations').insert({
      lead_id: currentLeadId,
      role: 'user',
      content: message,
    })

    // Immediately extract and save structured fields from the user's message — don't wait for AI
    const msgConcerns = extractConcernsFromMessage(message)
    const msgFields   = extractFieldsFromMessage(message)
    const hasExtracts = msgConcerns.length > 0 || Object.keys(msgFields).length > 0
    if (hasExtracts) {
      const { data: existingLead } = await supabaseAdmin
        .from('leads').select('concerns, primary_concern, phone, age, family_size').eq('id', currentLeadId).single()
      const immediateUpdate: Record<string, unknown> = {}
      // Concerns
      if (msgConcerns.length > 0) {
        const merged = Array.from(new Set([...(existingLead?.concerns ?? []), ...msgConcerns]))
        immediateUpdate.concerns = merged
        if (!existingLead?.primary_concern) immediateUpdate.primary_concern = msgConcerns[0]
      }
      // Phone — only overwrite if not already set
      if (msgFields.phone && !existingLead?.phone) immediateUpdate.phone = msgFields.phone
      // Age — only overwrite if not already set
      if (msgFields.age && !existingLead?.age) immediateUpdate.age = msgFields.age
      // Family size — only overwrite if not already set
      if (msgFields.family_size && !existingLead?.family_size) immediateUpdate.family_size = msgFields.family_size

      if (Object.keys(immediateUpdate).length > 0) {
        await supabaseAdmin.from('leads').update(immediateUpdate).eq('id', currentLeadId)
        logger.info(ROUTE, `lead:${currentLeadId} fields extracted from message`, { concerns: msgConcerns, fields: msgFields })
        const syncEmail = userProfile?.email
        if (syncEmail) await syncProfileToSiblings(syncEmail, currentLeadId, immediateUpdate)
      }
    }

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

    // Call AI — use follow-up prompt if this is a support session
    let systemPrompt = buildChatSystemPrompt(userProfile)
    if (isFollowUp) {
      const { data: parentLead } = await supabaseAdmin
        .from('leads')
        .select('name, primary_concern, concerns, status, updated_at')
        .eq('id', parentLeadId)
        .single()
      const topic = parentLead?.concerns?.join(', ') || parentLead?.primary_concern || 'insurance'
      const parentContext = [
        `Topic: ${topic}`,
        parentLead?.status ? `Status: ${parentLead.status}` : null,
        parentLead?.updated_at ? `Last updated: ${new Date(parentLead.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : null,
      ].filter(Boolean).join('\n')
      systemPrompt = buildFollowUpSystemPrompt(userProfile, parentContext)
    }
    const aiStart = Date.now()
    const reply = await chat(messages, systemPrompt)
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
          const syncEmail = (updates.email as string) || userProfile?.email
          if (syncEmail) await syncProfileToSiblings(syncEmail, currentLeadId, updates)
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
