import type { Lead } from './types'

export function getLeadConcerns(lead: Lead) {
  return Array.from(new Set([...(lead.concerns ?? []), lead.primary_concern].filter(Boolean))) as string[]
}

export function formatLeadConcerns(lead: Lead) {
  const concerns = getLeadConcerns(lead)
  if (concerns.length === 0) return '—'
  if (concerns.length <= 2) return concerns.join(', ')
  return `${concerns.slice(0, 2).join(', ')} +${concerns.length - 2}`
}
