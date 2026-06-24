export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // pdf-parse v1 uses CJS default export — require at runtime to avoid Vercel build-time canvas errors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  const text = data.text.trim()
  if (!text) throw new Error('no_text_layer')
  return text
}
