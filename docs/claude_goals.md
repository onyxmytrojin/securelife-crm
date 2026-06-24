# Project Goals, KPIs, and Acceptance Criteria — SecureLife MVP

This document defines clear, measurable goals mapped to the assessment deliverables and the 8-hour constraint. Use these as checkpoints for the Loom walkthrough and README.

## High-level Goals
- Deliver a working MVP demonstrating the core pipeline: conversational lead capture, persistent storage, document extraction, and a dashboard showing results.
- Focus on reliability for the small happy path rather than brittle edge-case coverage.

## Measurable KPIs
- Lead Capture: capture and persist at least 5 sample leads via the chatbot flow.
- Document Processing: successfully extract structured fields from at least 2 sample PDFs with >=80% field completeness.
- Analysis: generate at least one AI analysis (gaps + recommendation) per extracted document.
- Frontend polish: dashboard shows pipeline, lead detail, uploaded document and extraction JSON.

## Acceptance Criteria (per deliverable)

Architecture Document:
- Must include component diagram, data flow, and AI integration strategy.

System Diagrams:
- High-level architecture (Mermaid allowed) and ERD covering `leads`, `conversations`, `documents`, `extracted_data`, `analyses`.

Working MVP:
- Chatbot persists leads to DB.
- Uploaded PDFs attach to a lead and extraction stored to `extracted_data`.
- Dashboard displays the pipeline and an individual lead view.

Loom Walkthrough:
- A clear 10–15 minute recording explaining architecture, demo, AI prompts, and next steps.

## Prioritisation for 8 Hours
1. Architecture & plan (1 hour)
2. Chatbot + persistence (2 hours)
3. Document upload + extraction pipeline (2 hours)
4. Dashboard UI + wiring (1.5 hours)
5. Polish, write README, record Loom (1.5 hours)

## Risk & Mitigation
- API rate limits: mock responses and document failure modes in architecture doc.
- Poor PDF quality: apply OCR fallback (Tesseract) and annotate when uncertain.

## Developer Handoff Notes
- Bundle prompt templates in `lib/prompts.ts` and store schema definitions alongside `lib/types.ts`.
- Use environment variables for API keys and record any rate-limit workarounds in README.
