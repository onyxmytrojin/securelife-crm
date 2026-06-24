import type { Lead } from './types'
import { getLeadConcerns } from './lead-utils'

export interface ScoreFactor {
  label: string
  score: number
  max: number
  detail: string
}

export interface ScoreBreakdown {
  total: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  factors: ScoreFactor[]
  headline: string
  recommendation: string
}

/**
 * Multi-factor lead qualification score (0–100).
 *
 * Based on industry-standard lead scoring methods used by insurance brokers:
 * RFM (Recency/Frequency/Monetary), BANT (Budget/Authority/Need/Timeline),
 * and pipeline stage engagement signals.
 */
export function computeScore(lead: Lead): ScoreBreakdown {
  // ─── Factor 1: Profile Completeness (max 20) ───
  // Heavier weight on financial fields — they drive sales decisions
  const profileFields: [string, unknown, number][] = [
    ['name',         lead.name,          3],
    ['email',        lead.email,         3],
    ['phone',        lead.phone,         2],
    ['age',          lead.age,           2],
    ['occupation',   lead.occupation,    3],
    ['income',       lead.annual_income, 4],
    ['location',     lead.location,      2],
    ['family size',  lead.family_size,   1],
  ]
  const profileScore = profileFields.reduce((sum, [, v, pts]) => v != null ? sum + pts : sum, 0)
  const profileFilled = profileFields.filter(([, v]) => v != null).map(([k]) => k)
  const profileMissing = profileFields.filter(([, v]) => v == null).map(([k]) => k)

  // ─── Factor 2: Financial Capacity (max 25) ───
  // Bracketed income scoring: higher income → higher premium willingness
  const income = lead.annual_income ?? 0
  let financial = 0
  let financialBracket = ''
  if (income >= 5_000_000)      { financial = 25; financialBracket = 'Premium (₹50L+)' }
  else if (income >= 2_500_000) { financial = 23; financialBracket = 'High (₹25–50L)' }
  else if (income >= 1_200_000) { financial = 20; financialBracket = 'Mid-High (₹12–25L)' }
  else if (income >= 600_000)   { financial = 15; financialBracket = 'Mid (₹6–12L)' }
  else if (income >= 300_000)   { financial = 10; financialBracket = 'Entry (₹3–6L)' }
  else if (income > 0)          { financial = 5;  financialBracket = 'Low (<₹3L)' }

  // ─── Factor 3: Coverage Need Signal (max 20) ───
  // Cross-sell / gap analysis: having both concern + existing coverage = clearest buying signal
  const concerns = getLeadConcerns(lead)
  const hasConcern = concerns.length > 0
  const hasExisting = !!lead.existing_coverage
  let coverage = 0
  let coverageDetail = ''
  if (hasConcern && hasExisting) {
    coverage = 20
    coverageDetail = `Active need (${concerns.join(', ')}) + existing policy → clear coverage gap opportunity`
  } else if (hasConcern) {
    coverage = 15
    coverageDetail = `Coverage concern identified (${concerns[0]}${concerns.length > 1 ? ` +${concerns.length - 1} more` : ''}) — no existing policy disclosed`
  } else if (hasExisting) {
    coverage = 8
    coverageDetail = 'Existing coverage present — potential upsell / upgrade opportunity'
  } else {
    coverage = 0
    coverageDetail = 'No coverage information provided — hard to assess need'
  }

  // ─── Factor 4: Engagement Depth (max 20) ───
  // Pipeline stage as proxy for conversation depth (BANT: Authority + Timeline signals)
  const engMap: Record<string, number> = {
    new: 3, chatting: 8, qualified: 14,
    awaiting_docs: 17, processing: 19, completed: 20, rejected: 0,
  }
  const engagement = engMap[lead.status] ?? 0
  const engLabel =
    engagement >= 17 ? 'high — documents/analysis stage'
    : engagement >= 14 ? 'strong — qualification completed'
    : engagement >= 8  ? 'moderate — active in chat'
    : engagement >= 3  ? 'early — just entered pipeline'
    : 'none or rejected'

  // ─── Factor 5: Document Readiness (max 15) ───
  // Submitted documents indicate serious intent and enable accurate gap analysis
  let docScore = 0
  let docDetail = ''
  if (['processing', 'completed'].includes(lead.status)) {
    docScore = 15; docDetail = 'Documents submitted and processed — full analysis possible'
  } else if (lead.status === 'awaiting_docs') {
    docScore = 5;  docDetail = 'Documents requested — client has not uploaded yet'
  } else {
    docScore = 0;  docDetail = 'No documents on file — analysis limited to self-reported data'
  }

  const total = Math.min(100, profileScore + financial + coverage + engagement + docScore)
  const grade: ScoreBreakdown['grade'] =
    total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F'

  const headlines: Record<string, string> = {
    A: 'Excellent — strong financial profile, clear coverage gap, high engagement',
    B: 'Strong candidate — most qualification criteria met',
    C: 'Moderate lead — key information still missing, needs nurturing',
    D: 'Early-stage lead — gather more data before prioritising',
    F: 'Insufficient data — complete basic profile first',
  }

  const recs: Record<string, string> = {
    A: 'Priority close — schedule a call within 24h with tailored coverage proposal',
    B: 'Follow up promptly — send personalised coverage options',
    C: 'Nurture — request missing info: ' + (profileMissing.slice(0, 3).join(', ') || 'n/a'),
    D: 'Qualify first — basic profile incomplete',
    F: 'Do not invest heavy resources until lead is better qualified',
  }

  return {
    total,
    grade,
    headline: headlines[grade],
    recommendation: recs[grade],
    factors: [
      {
        label: 'Profile Completeness',
        score: profileScore,
        max: 20,
        detail: profileFilled.length
          ? `Provided: ${profileFilled.join(', ')}${profileMissing.length ? ` · Missing: ${profileMissing.join(', ')}` : ''}`
          : 'No profile fields filled in yet',
      },
      {
        label: 'Financial Capacity',
        score: financial,
        max: 25,
        detail: income
          ? `${financialBracket} — ${financial >= 20 ? 'high premium willingness' : financial >= 15 ? 'moderate premium capacity' : 'budget-sensitive buyer'}`
          : 'Income not disclosed — financial capacity cannot be assessed',
      },
      {
        label: 'Coverage Need Signal',
        score: coverage,
        max: 20,
        detail: coverageDetail,
      },
      {
        label: 'Engagement Depth',
        score: engagement,
        max: 20,
        detail: `Pipeline stage: ${lead.status.replace(/_/g, ' ')} — ${engLabel}`,
      },
      {
        label: 'Document Readiness',
        score: docScore,
        max: 15,
        detail: docDetail,
      },
    ],
  }
}
