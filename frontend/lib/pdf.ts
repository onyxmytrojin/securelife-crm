// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer)
  const text = data.text.trim()
  if (!text) throw new Error('no_text_layer')
  return text
}
