export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = (await import('pdf-parse')) as unknown as (buf: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  const text = data.text.trim()
  if (!text) throw new Error('no_text_layer')
  return text
}
