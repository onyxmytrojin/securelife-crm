import { describe, it, expect } from 'vitest'
import { computeScore } from '@/lib/scoring'
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

const fullLead: Lead = {
  ...base,
  name: 'Arjun Sharma', email: 'arjun@example.com', phone: '+91 98765 43210',
  age: 35, occupation: 'Software Engineer', annual_income: 1_500_000,
  family_size: 3, location: 'Mumbai', existing_coverage: 'Term life â‚¹1Cr',
  primary_concern: 'health', concerns: ['health', 'life'],
  status: 'completed',
}

describe('computeScore â€” total range', () => {
  it('returns 0â€“100 for a bare lead', () => {
    const { total } = computeScore(base)
    expect(total).toBeGreaterThanOrEqual(0)
    expect(total).toBeLessThanOrEqual(100)
  })

  it('full lead scores above 70', () => {
    expect(computeScore(fullLead).total).toBeGreaterThan(70)
  })

  it('never exceeds 100', () => {
    expect(computeScore(fullLead).total).toBeLessThanOrEqual(100)
  })
})

describe('computeScore â€” grade thresholds', () => {
  it('grades F for empty lead', () => {
    expect(computeScore(base).grade).toBe('F')
  })

  it('grades A for high-value completed lead', () => {
    const lead: Lead = { ...fullLead, annual_income: 6_000_000 }
    expect(computeScore(lead).grade).toBe('A')
  })
})

describe('computeScore â€” financial capacity factor', () => {
  it('scores 0 financial when income is null', () => {
    const { factors } = computeScore(base)
    const f = factors.find(x => x.label === 'Financial Capacity')!
    expect(f.score).toBe(0)
  })

  it('scores 5 for income below â‚¹3L', () => {
    const { factors } = computeScore({ ...base, annual_income: 100_000 })
    const f = factors.find(x => x.label === 'Financial Capacity')!
    expect(f.score).toBe(5)
  })

  it('scores 25 for income above â‚¹50L', () => {
    const { factors } = computeScore({ ...base, annual_income: 6_000_000 })
    const f = factors.find(x => x.label === 'Financial Capacity')!
    expect(f.score).toBe(25)
  })

  it('scores 15 for income â‚¹6â€“12L', () => {
    const { factors } = computeScore({ ...base, annual_income: 800_000 })
    const f = factors.find(x => x.label === 'Financial Capacity')!
    expect(f.score).toBe(15)
  })
})

describe('computeScore â€” coverage need factor', () => {
  it('scores 0 with no concern and no existing coverage', () => {
    const { factors } = computeScore(base)
    const f = factors.find(x => x.label === 'Coverage Need Signal')!
    expect(f.score).toBe(0)
  })

  it('scores 15 with concern but no existing coverage', () => {
    const { factors } = computeScore({ ...base, primary_concern: 'health' })
    const f = factors.find(x => x.label === 'Coverage Need Signal')!
    expect(f.score).toBe(15)
  })

  it('scores 8 with existing coverage but no concern', () => {
    const { factors } = computeScore({ ...base, existing_coverage: 'LIC term plan' })
    const f = factors.find(x => x.label === 'Coverage Need Signal')!
    expect(f.score).toBe(8)
  })

  it('scores 20 with both concern and existing coverage', () => {
    const { factors } = computeScore({ ...base, primary_concern: 'health', existing_coverage: 'LIC' })
    const f = factors.find(x => x.label === 'Coverage Need Signal')!
    expect(f.score).toBe(20)
  })
})

describe('computeScore â€” engagement factor', () => {
  it('scores 3 for new status', () => {
    const { factors } = computeScore({ ...base, status: 'new' })
    const f = factors.find(x => x.label === 'Engagement Depth')!
    expect(f.score).toBe(3)
  })

  it('scores 20 for completed status', () => {
    const { factors } = computeScore({ ...base, status: 'completed' })
    const f = factors.find(x => x.label === 'Engagement Depth')!
    expect(f.score).toBe(20)
  })

  it('scores 0 for rejected status', () => {
    const { factors } = computeScore({ ...base, status: 'rejected' })
    const f = factors.find(x => x.label === 'Engagement Depth')!
    expect(f.score).toBe(0)
  })
})

describe('computeScore â€” document readiness factor', () => {
  it('scores 0 when no docs (new status)', () => {
    const { factors } = computeScore(base)
    const f = factors.find(x => x.label === 'Document Readiness')!
    expect(f.score).toBe(0)
  })

  it('scores 5 when awaiting_docs', () => {
    const { factors } = computeScore({ ...base, status: 'awaiting_docs' })
    const f = factors.find(x => x.label === 'Document Readiness')!
    expect(f.score).toBe(5)
  })

  it('scores 15 when processing', () => {
    const { factors } = computeScore({ ...base, status: 'processing' })
    const f = factors.find(x => x.label === 'Document Readiness')!
    expect(f.score).toBe(15)
  })
})

describe('computeScore â€” factors structure', () => {
  it('always returns exactly 5 factors', () => {
    expect(computeScore(base).factors).toHaveLength(5)
    expect(computeScore(fullLead).factors).toHaveLength(5)
  })

  it('each factor has score <= max', () => {
    computeScore(fullLead).factors.forEach(f => {
      expect(f.score).toBeLessThanOrEqual(f.max)
      expect(f.score).toBeGreaterThanOrEqual(0)
    })
  })

  it('total equals sum of factor scores (capped at 100)', () => {
    const result = computeScore(fullLead)
    const sum = result.factors.reduce((acc, f) => acc + f.score, 0)
    expect(result.total).toBe(Math.min(100, sum))
  })
})

