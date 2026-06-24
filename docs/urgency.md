# Lead Urgency / Priority System — Methodology

> **File:** `frontend/lib/urgency.ts`  
> **System:** P0 → P1 → P2 → P3 (Critical → Low)

---

## Overview

Each active pipeline stage has a **Service Level Agreement (SLA)** — a maximum number of hours a lead should sit in that stage before the broker takes action. The urgency level is automatically calculated from how much of the SLA has been consumed.

This mirrors how engineering teams use priority flags in Linear/Jira, adapted for insurance lead management.

---

## SLA Thresholds by Stage

| Stage | SLA (hours) | Rationale |
|-------|-------------|-----------|
| `new` | 24h | New leads go cold within a day — same-day contact is industry best practice |
| `qualified` | 48h | Qualified leads need a proposal within 48h or interest drops sharply |
| `awaiting_docs` | 72h | Clients need up to 3 days to gather documents — escalate if not received |
| `processing` | 24h | Once documents are in, analysis should be same-day to maintain momentum |
| `chatting` | — | No SLA — lead is actively engaging, bot handles it |
| `completed` | — | Terminal state — no action needed |
| `rejected` | — | Terminal state — no action needed |

---

## Priority Classification Matrix

| Priority | Label | SLA Used | Visual | Condition |
|----------|-------|----------|--------|-----------|
| **P0** | Critical | >200% | 🔴 Red badge | Overdue by 2× threshold (e.g., 48h+ in `new`) |
| **P1** | High | 100–200% | 🟠 Orange badge | SLA breached (1×–2× threshold) |
| **P2** | Medium | 60–99% | 🟡 Amber badge | Approaching deadline |
| **P3** | Low | <60% | 🟢 Green badge | Comfortably within SLA |
| — | None | — | No badge | Stage has no SLA (`chatting`, `completed`, `rejected`) |

---

## Examples

| Lead | Stage | Hours in stage | Priority | Reason |
|------|-------|---------------|----------|--------|
| Sarthak | `new` | 1h | P3 Low | 4% of 24h SLA used |
| Priya | `new` | 16h | P2 Medium | 67% of 24h SLA used |
| Rahul | `qualified` | 52h | P1 High | SLA exceeded by 4h |
| Meena | `awaiting_docs` | 180h | P0 Critical | 250% of 72h SLA — 2.5× overdue |

---

## UI Representation

On each lead card:
- **P-level badge** shown in top-right corner (P0/P1/P2/P3)
- **SLA progress bar** at the bottom of the card (fills red/orange/amber/green)
- **Description** shown in the bar tooltip area (e.g., "SLA exceeded by 4h — follow up immediately")
- **Stats bar** in the dashboard header shows total overdue count

On the filter bar:
- `Overdue` filter shows all P1 + P0 leads
- `Stale` filter shows all P2 leads (approaching deadline)

---

## Escalation Endpoint

`POST /api/leads/escalate` (also supports `GET` for Vercel Cron)

Flags stale leads in the `notes` field with an auto-message:
```
[AUTO] Lead going cold — no conversation started — stale for 26h as of 24/06/2026
```

To wire up automatic daily escalation in production, add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/leads/escalate",
    "schedule": "0 9 * * *"
  }]
}
```

This runs at 9 AM IST every day and flags all overdue leads.
