export function extractConcernsFromMessage(message: string): string[] {
  const msg = message.toLowerCase()
  const found: string[] = []
  if (/health|medical|hospitali|mediclaim|doctor|hospital/.test(msg)) found.push('health')
  if (/\blife\b|term.?plan|death.?benefit|mortality/.test(msg)) found.push('life')
  if (/\bauto\b|car |vehicle|motor|bike|two.?wheel|four.?wheel/.test(msg)) found.push('auto')
  if (/home |property|house|flat|building|real.?estate/.test(msg)) found.push('property')
  if (/\bloan\b|mortgage|\bemi\b|credit.?protect/.test(msg)) found.push('loan')
  if (/retire|pension|annuity|provident|nps/.test(msg)) found.push('retirement')
  if (/travel|trip|abroad|international|visa/.test(msg)) found.push('travel')
  return found
}
