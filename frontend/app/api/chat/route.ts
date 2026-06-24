import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { chat, type Message } from '@/lib/ai'
import { CHAT_SYSTEM_PROMPT, CHAT_WELCOME_MESSAGE } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const { message, leadId, documentContext } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    // Get or create lead
    let currentLeadId = leadId
    if (!currentLeadId) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert({ status: 'chatting', source: 'chatbot' })
        .select('id')
        .single()
      if (error) throw error
      currentLeadId = data.id
      revalidateTag('leads', 'max')

      // Persist the welcome message so history loads correctly on refresh
      await supabaseAdmin.from('conversations').insert({
        lead_id: currentLeadId,
        role: 'assistant',
        content: CHAT_WELCOME_MESSAGE,
      })
    }

    // Save user message
    await supabaseAdmin.from('conversations').insert({
      lead_id: currentLeadId,
      role: 'user',
      content: message,
    })

    // Load full conversation history
    const { data: history } = await supabaseAdmin
      .from('conversations')
      .select('role, content')
      .eq('lead_id', currentLeadId)
      .order('created_at', { ascending: true })

    const messages: Message[] = (history ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // If a document was attached, inject its extracted fields as a system note
    // so the AI can discuss the policy without us needing vision/PDF capabilities
    if (documentContext) {
      messages.push({
        role: 'user',
        content: `[SYSTEM NOTE — not shown to client] The client just uploaded an insurance document. Here are the extracted fields:\n${documentContext}\n\nPlease acknowledge the document and comment on what you can see from their existing coverage.`,
      })
    }

    // Call AI
    const reply = await chat(messages, CHAT_SYSTEM_PROMPT)

    // Parse LEAD_DATA if present and update lead
    const leadDataMatch = reply.match(/LEAD_DATA:(\{[\s\S]*?\})/)
    const cleanReply = reply.replace(/LEAD_DATA:\{[\s\S]*?\}/, '').trim()

    if (leadDataMatch) {
      try {
        const leadData = JSON.parse(leadDataMatch[1])
        const updates: Record<string, unknown> = {}
        if (leadData.name) updates.name = leadData.name
        if (leadData.email) updates.email = leadData.email
        if (leadData.phone) updates.phone = leadData.phone
        if (leadData.age) updates.age = leadData.age
        if (leadData.occupation) updates.occupation = leadData.occupation
        if (leadData.annual_income) updates.annual_income = leadData.annual_income
        if (leadData.family_size) updates.family_size = leadData.family_size
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
          updates.status = 'qualified'
          updates.score = Math.min(
            100,
            Object.values(updates).filter(v => v !== null && v !== undefined).length * 10
          )
          await supabaseAdmin.from('leads').update(updates).eq('id', currentLeadId)
        }
      } catch {
        // malformed JSON from AI — ignore and continue
      }
    }

    // Save assistant reply
    await supabaseAdmin.from('conversations').insert({
      lead_id: currentLeadId,
      role: 'assistant',
      content: cleanReply,
    })

    return NextResponse.json({ reply: cleanReply, leadId: currentLeadId })
  } catch (err) {
    console.error('[/api/chat]', err)
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 })
  }
}
