export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Primary: unpdf (serverless-safe, WASM-based pdfjs-dist, no canvas dependency)
  try {
    const { extractText } = await import('unpdf')
    const uint8 = new Uint8Array(buffer)
    const { text } = await extractText(uint8, { mergePages: true })
    const trimmed = (text as string).trim()
    if (trimmed.length > 20) return trimmed
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
