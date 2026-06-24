export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Primary: pdf-parse v1 (fast, free, works for text-layer PDFs)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    const text = data.text.trim()
    if (text.length > 20) return text
  } catch {
    // fall through to Claude vision
  }

  // Fallback: Claude native PDF reading — handles scanned / image-based PDFs via OCR
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key') {
    throw new Error('no_text_layer')
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const base64 = buffer.toString('base64')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client.messages.create as any)({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        },
        {
          type: 'text',
          text: 'Extract all text content from this insurance document. Return the raw text exactly as it appears, preserving all fields, values, dates, and numbers. Do not summarise.',
        },
      ],
    }],
  })

  const extracted = (response.content[0] as { text: string }).text.trim()
  if (!extracted) throw new Error('no_text_layer')
  return extracted
}
