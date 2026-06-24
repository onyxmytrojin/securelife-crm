import { describe, it, expect, vi, afterEach } from 'vitest'
import { getUrgency } from '@/lib/urgency'
import type { Lead } from '@/lib/types'

const base: Lead = {
  id: '1', created_at: '', updated_at: new Date().toISOString(),
  name: null, email: null, phone: null,
  status: 'new', score: 0, source: 'chatbot',
  age: null, occupation: null, annual_income: null,
  family_size: null, existing_coverage: null,
  primary_concern: null, concerns: null, location: null, notes: null,
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

afterEach(() => { vi.useRealTimers() })

describe('getUrgency — returns null for non-SLA stages', () => {
  it('returns null for chatting', () => {
    expect(getUrgency({ ...base, status: 'chatting' })).toBeNull()
  })

  it('returns null for completed', () => {
    expect(getUrgency({ ...base, status: 'completed' })).toBeNull()
  })

  it('returns null for rejected', () => {
    expect(getUrgency({ ...base, status: 'rejected' })).toBeNull()
  })
})

describe('getUrgency — new (SLA 24h)', () => {
  it('P3 when well within SLA (2h in)', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(2) })!
    expect(u.level).toBe('P3')
  })

  it('P2 when approaching SLA (16h in = 67%)', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(16) })!
    expect(u.level).toBe('P2')
  })

  it('P1 when SLA just breached (25h in)', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(25) })!
    expect(u.level).toBe('P1')
  })

  it('P0 when SLA breached by >100% (50h in)', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(50) })!
    expect(u.level).toBe('P0')
  })
})

describe('getUrgency — qualified (SLA 48h)', () => {
  it('P3 at 10h (20% of 48h SLA)', () => {
    const u = getUrgency({ ...base, status: 'qualified', updated_at: hoursAgo(10) })!
    expect(u.level).toBe('P3')
  })

  it('P2 at 30h (62% of 48h SLA)', () => {
    const u = getUrgency({ ...base, status: 'qualified', updated_at: hoursAgo(30) })!
    expect(u.level).toBe('P2')
  })

  it('P1 at 50h (just over 48h SLA)', () => {
    const u = getUrgency({ ...base, status: 'qualified', updated_at: hoursAgo(50) })!
    expect(u.level).toBe('P1')
  })

  it('P0 at 100h (>200% of 48h SLA)', () => {
    const u = getUrgency({ ...base, status: 'qualified', updated_at: hoursAgo(100) })!
    expect(u.level).toBe('P0')
  })
})

describe('getUrgency — awaiting_docs (SLA 72h)', () => {
  it('P3 at 20h', () => {
    const u = getUrgency({ ...base, status: 'awaiting_docs', updated_at: hoursAgo(20) })!
    expect(u.level).toBe('P3')
  })

  it('P1 at 75h', () => {
    const u = getUrgency({ ...base, status: 'awaiting_docs', updated_at: hoursAgo(75) })!
    expect(u.level).toBe('P1')
  })
})

describe('getUrgency — processing (SLA 24h)', () => {
  it('P3 at 5h', () => {
    const u = getUrgency({ ...base, status: 'processing', updated_at: hoursAgo(5) })!
    expect(u.level).toBe('P3')
  })

  it('P0 at 55h', () => {
    const u = getUrgency({ ...base, status: 'processing', updated_at: hoursAgo(55) })!
    expect(u.level).toBe('P0')
  })
})

describe('getUrgency — returned shape', () => {
  it('includes all required fields', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(5) })!
    expect(u).toMatchObject({
      level:       expect.stringMatching(/^P[0-3]$/),
      label:       expect.any(String),
      hoursInStage: expect.any(Number),
      threshold:   24,
      pctUsed:     expect.any(Number),
      description: expect.any(String),
      dot:         expect.any(String),
      badge:       expect.any(String),
      text:        expect.any(String),
    })
  })

  it('hoursInStage is floored integer', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(5.7) })!
    expect(Number.isInteger(u.hoursInStage)).toBe(true)
  })

  it('pctUsed reflects time proportion', () => {
    const u = getUrgency({ ...base, status: 'new', updated_at: hoursAgo(12) })!
    expect(u.pctUsed).toBeCloseTo(0.5, 1)
  })
})
