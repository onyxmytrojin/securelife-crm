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

export interface ExtractedLeadFields {
  phone?: string
  age?: number
  family_size?: number
  annual_income?: number
  occupation?: string
}

// Map income bracket labels (from CHOICES) to numeric midpoints
const INCOME_LABEL_MAP: [RegExp, number][] = [
  [/above\s*₹?\s*1\s*cr/i,               12500000],
  [/₹?\s*50\s*l[a-z]*.*1\s*cr/i,          7500000],
  [/₹?\s*35\s*l[a-z]*.*50\s*l/i,          4250000],
  [/₹?\s*20\s*l[a-z]*.*35\s*l/i,          2750000],
  [/₹?\s*12\s*l[a-z]*.*20\s*l/i,          1600000],
  [/₹?\s*8\s*l[a-z]*.*12\s*l/i,           1000000],
  [/₹?\s*5\s*l[a-z]*.*8\s*l/i,             650000],
  [/₹?\s*3\s*l[a-z]*.*5\s*l/i,             400000],
  [/under\s*₹?\s*3\s*l/i,                  200000],
]

export function extractFieldsFromMessage(message: string): ExtractedLeadFields {
  const fields: ExtractedLeadFields = {}

  // Phone: Indian mobile (10 digits starting 6-9). Try plain match first, then condensed (strips spaces/dashes between digit groups only).
  const phoneRaw = message.match(/\b([6-9]\d{9})\b/)
  const phoneFmt = message.match(/([6-9]\d{2})[\s\-](\d{3})[\s\-](\d{4})/)
    ?? message.match(/([6-9]\d{4})[\s\-](\d{5})/)
  if (phoneRaw) {
    fields.phone = phoneRaw[1]
  } else if (phoneFmt) {
    fields.phone = phoneFmt.slice(1).join('').replace(/\D/g, '')
  }

  // Age: "I am 47", "i'm 30", "30 years old", "age 35", "aged 28", ", 47"
  const ageMatch =
    message.match(/\bi(?:'m| am)\s+(\d{1,3})\b/i) ??
    message.match(/\b(\d{1,3})\s+years?\s+old\b/i) ??
    message.match(/\baged?\s+(\d{1,3})\b/i) ??
    message.match(/\bage[^0-9]*(\d{1,3})\b/i) ??
    message.match(/,\s*(?:i am|i'm)\s+(\d{2,3})\b/i) ??
    message.match(/\bmy age is\s+(\d{1,3})\b/i)
  if (ageMatch) {
    const age = parseInt(ageMatch[1])
    if (age >= 1 && age <= 100) fields.age = age
  }

  // Family size
  const familyMatch =
    message.match(/\bfamily\s+(?:size\s+is\s+)?(\d+)\b/i) ??
    message.match(/\bfamily\s+of\s+(\d+)\b/i) ??
    message.match(/\b(\d+)\s+(?:member|person|people|children|kids|dependant|dependent)/i) ??
    message.match(/\b(\d+)\s+of\s+us\b/i) ??
    message.match(/\bwe\s+are\s+(\d+)\b/i) ??
    message.match(/\bmy\s+family\s+(?:has|size\s+is)\s+(\d+)/i)
  if (familyMatch) {
    const size = parseInt(familyMatch[1])
    if (size >= 1 && size <= 20) fields.family_size = size
  }

  // Annual income — match bracket labels from CHOICES
  for (const [pattern, amount] of INCOME_LABEL_MAP) {
    if (pattern.test(message)) { fields.annual_income = amount; break }
  }

  // Occupation — match labels from CHOICES (exact match against known categories)
  const OCCUPATION_LABELS = [
    'Salaried – Private Sector',
    'Salaried – Government / PSU',
    'Business Owner / Self-Employed',
    'Doctor / Healthcare',
    'Engineer / IT Professional',
    'Teacher / Educator',
    'Finance / Banking / Insurance',
    'Lawyer / Legal Professional',
    'Student',
    'Homemaker',
    'Retired',
  ]
  for (const label of OCCUPATION_LABELS) {
    if (message.trim() === label || message.includes(label)) { fields.occupation = label; break }
  }

  return fields
}
