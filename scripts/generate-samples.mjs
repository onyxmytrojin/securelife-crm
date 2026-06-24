// Generates two realistic Indian insurance policy PDFs in samples/
// Run: node scripts/generate-samples.mjs

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(ROOT, 'samples'), { recursive: true })

// ─── Minimal PDF builder ──────────────────────────────────────────────────────

function buildPdf(pages) {
  const lines = []
  const offsets = []

  const push = (...parts) => lines.push(...parts)

  push('%PDF-1.4')

  // obj 1 — catalog
  offsets[1] = lines.join('\n').length + 1
  push('1 0 obj', '<< /Type /Catalog /Pages 2 0 R >>', 'endobj')

  // obj 2 — pages dict  (built after we know how many pages)
  const pageRefs = pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')
  offsets[2] = lines.join('\n').length + 1
  push('2 0 obj', `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`, 'endobj')

  // obj 3+ — page + content pairs
  pages.forEach((text, pi) => {
    const pageObjId    = 3 + pi * 2
    const contentObjId = 4 + pi * 2

    // content stream
    const stream = buildStream(text)
    const streamLen = Buffer.byteLength(stream, 'utf8')

    offsets[pageObjId] = lines.join('\n').length + 1
    push(
      `${pageObjId} 0 obj`,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]`,
      `   /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
      `                          /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>`,
      `   /Contents ${contentObjId} 0 R >>`,
      'endobj'
    )

    offsets[contentObjId] = lines.join('\n').length + 1
    push(
      `${contentObjId} 0 obj`,
      `<< /Length ${streamLen} >>`,
      'stream',
      stream,
      'endstream',
      'endobj'
    )
  })

  // xref
  const body      = lines.join('\n') + '\n'
  const xrefStart = Buffer.byteLength(body, 'utf8')
  const objCount  = 2 + pages.length * 2 + 1  // catalog + pages + (page+content)*n

  const xrefLines = [`xref`, `0 ${objCount}`]
  xrefLines.push('0000000000 65535 f ')
  for (let i = 1; i < objCount; i++) {
    xrefLines.push((offsets[i] ?? 0).toString().padStart(10, '0') + ' 00000 n ')
  }
  xrefLines.push('trailer', `<< /Size ${objCount} /Root 1 0 R >>`, 'startxref', String(xrefStart), '%%EOF')

  return body + xrefLines.join('\n')
}

function buildStream(instructions) {
  return instructions.map(([op, ...args]) => {
    if (op === 'text') {
      const [x, y, size, bold, txt] = args
      const font = bold ? 'F2' : 'F1'
      const escaped = txt.replace(/[()\\]/g, c => '\\' + c)
      return `BT /${font} ${size} Tf ${x} ${y} Td (${escaped}) Tj ET`
    }
    if (op === 'line') {
      const [x1, y1, x2, y2] = args
      return `${x1} ${y1} m ${x2} ${y2} l S`
    }
    return ''
  }).join('\n')
}

// ─── LIC Tech Term Plan ───────────────────────────────────────────────────────

const licPage1 = [
  ['text', 50, 800, 16, true,  'LIC of India — Tech Term (Plan No. 854)'],
  ['text', 50, 780, 10, false, 'Central Office: Yogakshema, Jeevan Bima Marg, Mumbai 400 021'],
  ['line', 50, 772, 545, 772],
  ['text', 50, 755, 12, true,  'POLICY SCHEDULE'],
  ['text', 50, 735, 10, false, 'Policy Number          :  854-76543210-00'],
  ['text', 50, 718, 10, false, 'Policy Type            :  Pure Term Insurance (Online)'],
  ['text', 50, 701, 10, false, 'Policyholder Name      :  Arjun Mehta'],
  ['text', 50, 684, 10, false, 'Date of Birth          :  15-Mar-1990'],
  ['text', 50, 667, 10, false, 'Age at Entry           :  34 years'],
  ['text', 50, 650, 10, false, 'Gender                 :  Male'],
  ['text', 50, 633, 10, false, 'Smoker Status          :  Non-Smoker'],
  ['text', 50, 616, 10, false, 'Nominee Name           :  Priya Mehta (Spouse)'],
  ['line', 50, 608, 545, 608],
  ['text', 50, 591, 12, true,  'COVERAGE DETAILS'],
  ['text', 50, 571, 10, false, 'Basic Sum Assured      :  Rs. 1,50,00,000 (One Crore Fifty Lakhs)'],
  ['text', 50, 554, 10, false, 'Policy Term            :  30 years'],
  ['text', 50, 537, 10, false, 'Premium Payment Term   :  30 years (Regular Pay)'],
  ['text', 50, 520, 10, false, 'Date of Commencement   :  01-Apr-2024'],
  ['text', 50, 503, 10, false, 'Date of Maturity       :  01-Apr-2054'],
  ['text', 50, 486, 10, false, 'Next Premium Due Date  :  01-Apr-2025'],
  ['line', 50, 478, 545, 478],
  ['text', 50, 461, 12, true,  'PREMIUM DETAILS'],
  ['text', 50, 441, 10, false, 'Annual Premium         :  Rs. 14,756 (exclusive of GST)'],
  ['text', 50, 424, 10, false, 'GST @ 18%             :  Rs. 2,656'],
  ['text', 50, 407, 10, false, 'Total Annual Premium   :  Rs. 17,412'],
  ['text', 50, 390, 10, false, 'Premium Frequency      :  Annual'],
  ['text', 50, 373, 10, false, 'Mode Rebate            :  Nil'],
  ['line', 50, 365, 545, 365],
  ['text', 50, 348, 12, true,  'RIDERS (OPTIONAL BENEFITS)'],
  ['text', 50, 328, 10, false, 'Accidental Death Benefit Rider  :  Rs. 25,00,000'],
  ['text', 50, 311, 10, false, 'Premium Waiver Benefit Rider    :  Not opted'],
  ['line', 50, 303, 545, 303],
  ['text', 50, 286, 12, true,  'EXCLUSIONS'],
  ['text', 50, 266, 10, false, '1. Death due to suicide within 12 months of policy commencement or revival'],
  ['text', 50, 249, 10, false, '2. Death under influence of alcohol or narcotics'],
  ['text', 50, 232, 10, false, '3. Death arising from participation in hazardous activities'],
  ['line', 50, 224, 545, 224],
  ['text', 50, 207, 12, true,  'TAX BENEFITS'],
  ['text', 50, 187, 10, false, 'Premium eligible for deduction under Section 80C of Income Tax Act, 1961'],
  ['text', 50, 170, 10, false, 'Death benefit is tax-free under Section 10(10D)'],
  ['line', 50, 162, 545, 162],
  ['text', 50, 145, 10, false, 'This policy is issued subject to the terms and conditions of the policy document.'],
  ['text', 50, 128, 10, false, 'For claims or queries: 1800-227-717 (Toll Free) | licindia.in'],
  ['text', 50, 111, 10, false, 'Authorised Signatory: Zonal Manager, Western Zone, LIC of India'],
]

// ─── Star Health Family Floater ───────────────────────────────────────────────

const starPage1 = [
  ['text', 50, 800, 16, true,  'Star Health and Allied Insurance Co. Ltd.'],
  ['text', 50, 780, 10, false, 'No. 1, New Tank Street, Valluvar Kottam High Road, Chennai 600 034'],
  ['line', 50, 772, 545, 772],
  ['text', 50, 755, 12, true,  'COMPREHENSIVE HEALTH INSURANCE POLICY — SCHEDULE'],
  ['text', 50, 735, 10, false, 'Policy Number          :  P/211121/01/2024/008834'],
  ['text', 50, 718, 10, false, 'Policy Type            :  Family Floater — Star Comprehensive'],
  ['text', 50, 701, 10, false, 'Policyholder Name      :  Sunita Reddy'],
  ['text', 50, 684, 10, false, 'Date of Birth          :  22-Aug-1982'],
  ['text', 50, 667, 10, false, 'Age at Entry           :  42 years'],
  ['text', 50, 650, 10, false, 'Address                :  Flat 4B, Prestige Towers, Banjara Hills, Hyderabad 500 034'],
  ['line', 50, 642, 545, 642],
  ['text', 50, 625, 12, true,  'INSURED MEMBERS'],
  ['text', 50, 605, 10, false, '1. Sunita Reddy (Self)        — DOB: 22-Aug-1982  Age: 42'],
  ['text', 50, 588, 10, false, '2. Ramesh Reddy (Spouse)      — DOB: 14-Feb-1979  Age: 45'],
  ['text', 50, 571, 10, false, '3. Aryan Reddy (Son)          — DOB: 03-Jun-2012  Age: 12'],
  ['line', 50, 563, 545, 563],
  ['text', 50, 546, 12, true,  'COVERAGE DETAILS'],
  ['text', 50, 526, 10, false, 'Sum Insured (Floater)  :  Rs. 10,00,000 (Ten Lakhs)'],
  ['text', 50, 509, 10, false, 'Policy Period          :  01-Jun-2024 to 31-May-2025'],
  ['text', 50, 492, 10, false, 'Renewal Date           :  01-Jun-2025'],
  ['text', 50, 475, 10, false, 'Room Eligibility       :  Single Private AC Room'],
  ['text', 50, 458, 10, false, 'ICU Charges            :  Covered (Actuals)'],
  ['text', 50, 441, 10, false, 'Day Care Procedures    :  540 procedures covered'],
  ['text', 50, 424, 10, false, 'Pre-Hospitalisation    :  60 days'],
  ['text', 50, 407, 10, false, 'Post-Hospitalisation   :  90 days'],
  ['line', 50, 399, 545, 399],
  ['text', 50, 382, 12, true,  'PREMIUM DETAILS'],
  ['text', 50, 362, 10, false, 'Basic Premium          :  Rs. 22,450'],
  ['text', 50, 345, 10, false, 'GST @ 18%             :  Rs. 4,041'],
  ['text', 50, 328, 10, false, 'Total Premium Paid     :  Rs. 26,491'],
  ['text', 50, 311, 10, false, 'Payment Mode           :  Annual'],
  ['line', 50, 303, 545, 303],
  ['text', 50, 286, 12, true,  'PRE-EXISTING CONDITIONS & WAITING PERIODS'],
  ['text', 50, 266, 10, false, 'Declared Pre-existing Conditions  :  Hypertension (Sunita Reddy)'],
  ['text', 50, 249, 10, false, 'Waiting Period — Pre-existing     :  36 months from policy inception'],
  ['text', 50, 232, 10, false, 'Waiting Period — Specific Disease  :  24 months (listed conditions)'],
  ['text', 50, 215, 10, false, 'Initial Waiting Period            :  30 days (except accidents)'],
  ['line', 50, 207, 545, 207],
  ['text', 50, 190, 12, true,  'EXCLUSIONS (KEY)'],
  ['text', 50, 170, 10, false, '1. Cosmetic surgery, dental treatment (unless due to accident)'],
  ['text', 50, 153, 10, false, '2. Maternity and newborn expenses (not opted)'],
  ['text', 50, 136, 10, false, '3. Treatment for obesity, weight control'],
  ['text', 50, 119, 10, false, '4. Self-inflicted injuries, substance abuse'],
  ['line', 50, 111, 545, 111],
  ['text', 50, 94, 10, false,  'TAX BENEFIT: Premium eligible under Section 80D — Rs. 25,000 (self/family)'],
  ['text', 50, 77, 10, false,  'Claims: 1800-425-2255 (24x7 Toll Free) | starhealth.in | cashless@starhealth.in'],
]

// ─── Write files ──────────────────────────────────────────────────────────────

const licPdf  = buildPdf([licPage1])
const starPdf = buildPdf([starPage1])

writeFileSync(join(ROOT, 'samples', 'lic-tech-term-plan.pdf'),           licPdf,  'utf8')
writeFileSync(join(ROOT, 'samples', 'star-health-family-floater.pdf'),   starPdf, 'utf8')

console.log('✅ Generated:')
console.log('   samples/lic-tech-term-plan.pdf')
console.log('   samples/star-health-family-floater.pdf')
