# Lead Qualification Score — Methodology

> **File:** `frontend/lib/scoring.ts`  
> **Score range:** 0 – 100  
> **Grade:** A (≥85) · B (≥70) · C (≥55) · D (≥40) · F (<40)

---

## Overview

The score uses a **multi-factor weighted model** drawing from three industry-standard lead scoring frameworks:

| Framework | What it captures |
|-----------|-----------------|
| **RFM** (Recency / Frequency / Monetary) | How recently and how often the lead engages, and their financial value |
| **BANT** (Budget / Authority / Need / Timeline) | Budget = financial capacity; Need = coverage gap; Timeline = pipeline stage |
| **Pipeline stage weighting** | Actual behaviour in the CRM as a signal of buying intent |

---

## Factor Breakdown

### Factor 1 — Profile Completeness `max 20 pts`

Measures how much we know about the lead. Heavier weight on financial fields that directly affect premium decisions.

| Field | Points |
|-------|--------|
| Name | 3 |
| Email | 3 |
| Occupation | 3 |
| Annual Income | **4** |
| Phone | 2 |
| Age | 2 |
| Location | 2 |
| Family Size | 1 |
| **Total** | **20** |

---

### Factor 2 — Financial Capacity `max 25 pts`

Bracketed annual income scoring. Higher income → higher premium willingness → higher conversion probability. Based on Indian income brackets (SEBI / insurance affordability studies).

| Annual Income | Points | Bracket Label |
|--------------|--------|---------------|
| ≥ ₹50,00,000 | 25 | Premium |
| ₹25L – ₹50L | 23 | High |
| ₹12L – ₹25L | 20 | Mid-High |
| ₹6L – ₹12L | 15 | Mid |
| ₹3L – ₹6L | 10 | Entry |
| < ₹3L | 5 | Low |
| Not disclosed | 0 | Unknown |

---

### Factor 3 — Coverage Need Signal `max 20 pts`

Cross-sell / gap analysis signal. A lead with *both* an existing policy *and* a new concern has the clearest unmet need — they know what insurance is and are actively looking for more.

| Situation | Points | Rationale |
|-----------|--------|-----------|
| Has specific concern **+** existing coverage | **20** | Clear coverage gap — strongest buying signal |
| Has specific concern, no existing coverage | 15 | First-time buyer, motivated |
| Has existing coverage only | 8 | Upsell / upgrade opportunity |
| No coverage info provided | 0 | Cannot assess need |

---

### Factor 4 — Engagement Depth `max 20 pts`

Pipeline stage used as a proxy for conversation depth and buying intent (BANT: Authority + Timeline signals). More advanced stages require the lead to have actively engaged with the broker.

| Stage | Points |
|-------|--------|
| Completed | 20 |
| Processing | 19 |
| Awaiting Docs | 17 |
| Qualified | 14 |
| Chatting | 8 |
| New | 3 |
| Rejected | 0 |

---

### Factor 5 — Document Readiness `max 15 pts`

Document submission is the strongest intent signal available. A lead who uploads their existing policy documents is actively seeking analysis — conversion rate is significantly higher.

| Situation | Points |
|-----------|--------|
| Documents uploaded + in processing or completed | 15 |
| Documents requested (awaiting_docs stage) | 5 |
| No documents | 0 |

---

## Score-to-Grade Mapping

| Score | Grade | Interpretation |
|-------|-------|---------------|
| 85 – 100 | A | Excellent — close immediately |
| 70 – 84 | B | Strong — follow up promptly |
| 55 – 69 | C | Moderate — nurture and qualify |
| 40 – 54 | D | Early-stage — gather more data |
| 0 – 39 | F | Insufficient — basic profile needed |

---

## Hover Explanation (UI)

When a broker hovers over the score bar on a lead card, the UI shows:

1. The **headline** (e.g. "Excellent — strong financial profile, clear coverage gap, high engagement")
2. A **per-factor bar chart** showing each factor's contribution
3. A **recommendation** (e.g. "Priority close — schedule a call within 24h with tailored coverage proposal")

This lets brokers immediately understand *why* a lead scored 85 vs 70 without opening the lead detail view.

---

## Future Improvements

- Incorporate actual conversation message count (requires joining `conversations` table)
- Weight recency of last contact (use `updated_at` delta)
- Add survey-based data (family dependents count → life insurance multiplier)
- Machine learning re-weighting based on historical conversion data
