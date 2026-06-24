import type { Lead, LeadStatus } from './types'

export type UrgencyLevel = 'P0' | 'P1' | 'P2' | 'P3'

export interface UrgencyInfo {
  level: UrgencyLevel
  label: string
  hoursInStage: number
  threshold: number
  pctUsed: number
  description: string
  dot: string
  badge: string
  text: string
}

/**
 * SLA thresholds (hours) per pipeline stage.
 * Stages without a threshold (completed, rejected, chatting) have no urgency — they're terminal or active.
 */
const SLA: Partial<Record<LeadStatus, number>> = {
  new:           24,
  qualified:     48,
  awaiting_docs: 72,
  processing:    24,
}

/**
 * Priority classification:
 *   P0 Critical — SLA breached by >100% (double overdue)
 *   P1 High     — SLA threshold breached
 *   P2 Medium   — 60–99% of SLA used (approaching deadline)
 *   P3 Low      — <60% of SLA used (within comfortable window)
 */
export function getUrgency(lead: Lead): UrgencyInfo | null {
  const threshold = SLA[lead.status]
  if (!threshold) return null

  const hoursInStage = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000
  const pctUsed = hoursInStage / threshold

  if (pctUsed >= 2) {
    return {
      level: 'P0', label: 'Critical',
      hoursInStage: Math.floor(hoursInStage), threshold, pctUsed,
      description: `SLA breached by ${Math.floor(hoursInStage - threshold)}h — immediate action required`,
      dot:   'bg-red-500',
      badge: 'bg-red-100 dark:bg-red-950 border-red-200 dark:border-red-800',
      text:  'text-red-600 dark:text-red-400',
    }
  }
  if (pctUsed >= 1) {
    return {
      level: 'P1', label: 'High',
      hoursInStage: Math.floor(hoursInStage), threshold, pctUsed,
      description: `SLA exceeded by ${Math.floor(hoursInStage - threshold)}h — follow up immediately`,
      dot:   'bg-orange-500',
      badge: 'bg-orange-100 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
      text:  'text-orange-600 dark:text-orange-400',
    }
  }
  if (pctUsed >= 0.6) {
    return {
      level: 'P2', label: 'Medium',
      hoursInStage: Math.floor(hoursInStage), threshold, pctUsed,
      description: `${Math.floor(threshold - hoursInStage)}h until SLA deadline — act soon`,
      dot:   'bg-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
      text:  'text-amber-600 dark:text-amber-400',
    }
  }
  return {
    level: 'P3', label: 'Low',
    hoursInStage: Math.floor(hoursInStage), threshold, pctUsed,
    description: `${Math.floor(threshold - hoursInStage)}h remaining — comfortably within SLA`,
    dot:   'bg-emerald-400',
    badge: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800',
    text:  'text-emerald-600 dark:text-emerald-400',
  }
}
