import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

export type Message = { role: 'user' | 'assistant'; content: string }

const provider = process.env.AI_PROVIDER ?? 'groq'

// ── Groq (free, fast — default) ───────────────────────────────────────────────

const groqClient = provider === 'groq'
  ? new Groq({ apiKey: process.env.GROQ_API_KEY! })
  : null

async function groqChat(messages: Message[], systemPrompt: string): Promise<string> {
  const response = await groqClient!.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    max_tokens: 1024,
  })
  return response.choices[0].message.content ?? ''
}

async function groqJSON(messages: Message[], systemPrompt: string): Promise<string> {
  const response = await groqClient!.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.' },
      ...messages,
    ],
    max_tokens: 2048,
    response_format: { type: 'json_object' },
  })
  return response.choices[0].message.content ?? '{}'
}

// ── Gemini ────────────────────────────────────────────────────────────────────

const geminiClient = provider === 'gemini'
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  : null

async function geminiChat(messages: Message[], systemPrompt: string): Promise<string> {
  const model = geminiClient!.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  })
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const chat = model.startChat({ history })
  const last = messages[messages.length - 1]
  const result = await chat.sendMessage(last.content)
  return result.response.text()
}

async function geminiJSON(messages: Message[], systemPrompt: string): Promise<string> {
  const model = geminiClient!.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.',
    generationConfig: { responseMimeType: 'application/json' },
  })
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n')
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ── Anthropic (production) ────────────────────────────────────────────────────

const anthropicClient = provider === 'anthropic'
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  : null

async function anthropicChat(messages: Message[], systemPrompt: string): Promise<string> {
  const response = await anthropicClient!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })
  return (response.content[0] as { text: string }).text
}

async function anthropicJSON(messages: Message[], systemPrompt: string): Promise<string> {
  const response = await anthropicClient!.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt + '\n\nRespond ONLY with valid JSON. No markdown, no explanation.',
    messages,
  })
  return (response.content[0] as { text: string }).text
}

// ── Unified interface ─────────────────────────────────────────────────────────

export async function chat(messages: Message[], systemPrompt: string): Promise<string> {
  if (provider === 'anthropic') return anthropicChat(messages, systemPrompt)
  if (provider === 'gemini') return geminiChat(messages, systemPrompt)
  return groqChat(messages, systemPrompt)
}

export async function generateJSON(messages: Message[], systemPrompt: string): Promise<string> {
  if (provider === 'anthropic') return anthropicJSON(messages, systemPrompt)
  if (provider === 'gemini') return geminiJSON(messages, systemPrompt)
  return groqJSON(messages, systemPrompt)
}
