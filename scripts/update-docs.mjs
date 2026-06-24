/**
 * Auto-documentation updater for SecureLife Insurance AI CRM.
 *
 * Reads key source files, asks Claude to regenerate the three Mermaid diagrams
 * and the architecture doc, then writes them back to disk.
 *
 * Run:  node scripts/update-docs.mjs
 * Env:  ANTHROPIC_API_KEY must be set
 *
 * Called automatically by .github/workflows/update-docs.yml on every push to master
 * that touches source files. Also runs on a weekly Monday cron.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Files to read as codebase context ───────────────────────────────────────

const SOURCE_FILES = [
  'frontend/lib/types.ts',
  'frontend/lib/concerns.ts',
  'frontend/lib/prompts.ts',
  'frontend/lib/scoring.ts',
  'database/schema.sql',
  'frontend/app/api/chat/route.ts',
  'frontend/app/api/leads/route.ts',
  'frontend/app/api/documents/route.ts',
  'frontend/app/api/analysis/route.ts',
  'frontend/app/page.tsx',
  'frontend/app/chat/page.tsx',
]

function readSources() {
  return SOURCE_FILES
    .map(rel => {
      const full = path.join(ROOT, rel)
      if (!fs.existsSync(full)) return null
      const content = fs.readFileSync(full, 'utf8')
      const lines   = content.split('\n').slice(0, 120).join('\n') // cap per file
      return `\n\n### ${rel}\n\`\`\`\n${lines}\n\`\`\``
    })
    .filter(Boolean)
    .join('')
}

// ─── Diagram generators ───────────────────────────────────────────────────────

async function regenerateDiagram(filename, diagramType, specificInstructions) {
  const currentPath = path.join(ROOT, 'diagrams', filename)
  const current     = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, 'utf8') : ''
  const sources     = readSources()

  console.log(`  Regenerating ${filename}…`)

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a technical documentation bot. Based on the source code below, generate an accurate, up-to-date Mermaid ${diagramType} diagram.

CURRENT DIAGRAM (may be outdated):
\`\`\`
${current}
\`\`\`

SOURCE CODE SNAPSHOT:
${sources}

INSTRUCTIONS:
${specificInstructions}

Reply with ONLY the raw Mermaid diagram — no markdown fences, no explanation, no preamble.`,
    }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : current
}

async function regenerateArchitectureDoc() {
  const docPath = path.join(ROOT, 'docs', 'architecture.md')
  const current = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : ''
  const sources = readSources()

  console.log('  Regenerating docs/architecture.md…')

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a technical documentation bot. Update the architecture document for the SecureLife Insurance AI CRM based on the current source code.

CURRENT DOC:
${current}

SOURCE CODE SNAPSHOT:
${sources}

INSTRUCTIONS:
- Keep the same markdown structure (sections, tables, code blocks)
- Update component list, tech stack table, data flow, and API route descriptions to match actual code
- Mention: Aria chatbot persona, Groq as default AI (llama-3.3-70b), Claude as analysis/fallback, Redis caching, Supabase Realtime, multi-session customer portal, follow-up sessions, ticket numbers, structured chat inputs (CHOICES / NUMBER_INPUT), regex extraction (concerns.ts), cross-session profile sync (syncProfileToSiblings)
- Keep the document concise and scannable — no marketing language
- Output the full updated markdown document only, no preamble`,
    }],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : current
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set — skipping doc update')
    process.exit(1)
  }

  console.log('SecureLife — Auto-updating architecture docs and diagrams\n')

  const results = await Promise.allSettled([
    regenerateDiagram(
      'architecture.mmd',
      'flowchart',
      `Show: Browser pages (/  /chat  /leads/[id]), Next.js API routes (/api/chat /api/leads /api/documents /api/analysis), AI layer (Groq default, Claude fallback/analysis, GPT-4.1-mini extraction fallback, pdf-parse, regex engine), Data layer (Supabase PostgreSQL, Supabase Realtime, Supabase Storage, Upstash Redis). Include: syncProfileToSiblings flow, Realtime push to broker dashboard, regex immediate extraction path.`
    ),
    regenerateDiagram(
      'erd.mmd',
      'erDiagram',
      `Include ALL current leads columns: id, created_at, updated_at, name, email, phone, status, score, source, age, occupation, annual_income, family_size, existing_coverage, primary_concern, concerns (text array), location, notes, parent_lead_id (FK self-referential), session_type, ticket_number. Other tables: conversations, documents, extracted_data, analyses. Show all FK relationships including the self-join on leads for follow-up sessions.`
    ),
    regenerateDiagram(
      'lead-flow.mmd',
      'sequenceDiagram',
      `Participants: Prospect, /chat Portal, /api/chat, Regex Engine, Groq, Supabase, Broker Dashboard. Show: session start with sessions sidebar, CHOICES pill selection → regex extraction → immediate DB update, NUMBER_INPUT widget for age/family size, LEAD_DATA from AI → DB update, syncProfileToSiblings after any update, Realtime push to broker, document upload flow, analysis generation with Arjun Kapoor persona, follow-up session creation with amber badge on broker board.`
    ),
    regenerateArchitectureDoc(),
  ])

  const [archMmd, erdMmd, flowMmd, archDoc] = results

  if (archMmd.status === 'fulfilled') {
    fs.writeFileSync(path.join(ROOT, 'diagrams', 'architecture.mmd'), archMmd.value + '\n')
    console.log('  ✓ diagrams/architecture.mmd')
  } else {
    console.error('  ✗ architecture.mmd failed:', archMmd.reason)
  }

  if (erdMmd.status === 'fulfilled') {
    fs.writeFileSync(path.join(ROOT, 'diagrams', 'erd.mmd'), erdMmd.value + '\n')
    console.log('  ✓ diagrams/erd.mmd')
  } else {
    console.error('  ✗ erd.mmd failed:', erdMmd.reason)
  }

  if (flowMmd.status === 'fulfilled') {
    fs.writeFileSync(path.join(ROOT, 'diagrams', 'lead-flow.mmd'), flowMmd.value + '\n')
    console.log('  ✓ diagrams/lead-flow.mmd')
  } else {
    console.error('  ✗ lead-flow.mmd failed:', flowMmd.reason)
  }

  if (archDoc.status === 'fulfilled') {
    fs.writeFileSync(path.join(ROOT, 'docs', 'architecture.md'), archDoc.value + '\n')
    console.log('  ✓ docs/architecture.md')
  } else {
    console.error('  ✗ architecture.md failed:', archDoc.reason)
  }

  const failed = results.filter(r => r.status === 'rejected').length
  console.log(`\nDone — ${results.length - failed}/${results.length} files updated`)
  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
