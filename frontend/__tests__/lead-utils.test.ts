import { describe, it, expect } from 'vitest'
import { getLeadConcerns, formatLeadConcerns } from '@/lib/lead-utils'
import type { Lead } from '@/lib/types'

const base: Lead = {
  id: '1', created_at: '', updated_at: '',
  name: null, email: null, phone: null,
  status: 'new', score: 0, source: 'chatbot',
  age: null, occupation: null, annual_income: null,
  family_size: null, existing_coverage: null,
  primary_concern: null, concerns: null, location: null, notes: null,
  parent_lead_id: null, session_type: null, ticket_number: null,
}

describe('getLeadConcerns', () => {
  it('returns empty array when no concerns set', () => {
    expect(getLeadConcerns(base)).toEqual([])
  })

  it('returns primary_concern when concerns array is null', () => {
    expect(getLeadConcerns({ ...base, primary_concern: 'health' })).toEqual(['health'])
  })

  it('returns concerns array when primary_concern is null', () => {
    expect(getLeadConcerns({ ...base, concerns: ['life', 'auto'] })).toEqual(['life', 'auto'])
  })

  it('merges concerns and primary_concern without duplicates', () => {
    const result = getLeadConcerns({ ...base, primary_concern: 'health', concerns: ['health', 'life'] })
    expect(result).toEqual(['health', 'life'])
  })

  it('places primary_concern first when not already in array', () => {
    const result = getLeadConcerns({ ...base, primary_concern: 'health', concerns: ['life', 'auto'] })
    expect(result).toContain('health')
    expect(result).toContain('life')
    expect(result).toContain('auto')
    expect(result).toHaveLength(3)
  })

  it('filters out null/undefined from concerns array', () => {
    const result = getLeadConcerns({ ...base, concerns: ['health', null as unknown as string, 'life'] })
    expect(result).toEqual(['health', 'life'])
  })
})

describe('formatLeadConcerns', () => {
  it('returns dash when no concerns', () => {
    expect(formatLeadConcerns(base)).toBe('—')
  })

  it('formats a single concern', () => {
    expect(formatLeadConcerns({ ...base, primary_concern: 'health' })).toBe('health')
  })

  it('joins two concerns with comma', () => {
    expect(formatLeadConcerns({ ...base, concerns: ['health', 'life'] })).toBe('health, life')
  })

  it('truncates to first two with overflow count', () => {
    expect(formatLeadConcerns({ ...base, concerns: ['health', 'life', 'auto'] })).toBe('health, life +1')
  })

  it('shows correct overflow count for many concerns', () => {
    expect(formatLeadConcerns({ ...base, concerns: ['health', 'life', 'auto', 'property', 'travel'] }))
      .toBe('health, life +3')
  })
})

