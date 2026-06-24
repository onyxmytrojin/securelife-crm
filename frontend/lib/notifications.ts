// Broker emails use RESEND_BROKER_API_KEY (teamedge Resend account → delivers to teamedge@gmail.com)
// Customer emails use RESEND_API_KEY (original Resend account → delivers to account-owner email)

const RESEND_API_KEY        = process.env.RESEND_API_KEY ?? ''
const RESEND_BROKER_API_KEY = process.env.RESEND_BROKER_API_KEY ?? ''
const BROKER_EMAIL          = process.env.BROKER_EMAIL ?? ''
const APP_URL               = process.env.NEXT_PUBLIC_APP_URL ?? 'https://securelife-crm.vercel.app'

const FROM = 'SecureLife CRM <onboarding@resend.dev>'

// ─── Internal send ────────────────────────────────────────────────────────────

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  console.log('[notifications] sendEmail called — to:', to, '| apiKey set:', !!apiKey, '| apiKey prefix:', apiKey.slice(0, 8))
  if (!apiKey || !to) {
    console.warn('[notifications] sendEmail skipped — missing apiKey or to')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    console.error('[notifications] Resend error:', await res.text())
  } else {
    console.log('[notifications] Email sent OK — subject:', subject)
  }
}

// ─── Shared template shell ────────────────────────────────────────────────────

function wrap(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111317;border-radius:12px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr>
          <td style="padding:20px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:15px;font-weight:700;color:#F7F8FA;letter-spacing:-0.3px;">SecureLife</span>
            <span style="font-size:15px;color:#5E6AD2;font-weight:400;"> CRM</span>
          </td>
        </tr>
        <tr><td style="padding:28px;">${content}</td></tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:12px;color:#4B5058;">SecureLife Insurance Brokers · This is an automated notification.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function pill(text: string, color = '#5E6AD2') {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:${color}20;border:1px solid ${color}40;color:${color};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${text}</span>`
}

function cta(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#5E6AD2;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">${label} →</a>`
}

function field(label: string, value: string | null | undefined) {
  if (!value) return ''
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#6B7280;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#A0A7B3;font-weight:500;">${value}</td>
  </tr>`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeadSummary {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
  age?: number | null
  occupation?: string | null
  annual_income?: number | null
  family_size?: number | null
  concerns?: string[] | null
  primary_concern?: string | null
  ticket_number?: number | null
}

function ticketLabel(lead: LeadSummary) {
  return lead.ticket_number != null ? `#${String(lead.ticket_number).padStart(4, '0')} ` : ''
}

function concernList(lead: LeadSummary) {
  const all = [...new Set([...(lead.concerns ?? []), lead.primary_concern].filter(Boolean))]
  return all.length
    ? all.map(c => `<strong style="color:#8B97E8;text-transform:capitalize;">${c}</strong>`).join(', ')
    : 'Not specified'
}

// ─── Broker notifications (use broker Resend account → teamedge inbox) ────────

export async function notifyBrokerQualified(lead: LeadSummary) {
  const name      = lead.name ?? 'Unknown'
  const ticket    = ticketLabel(lead)
  const detailUrl = `${APP_URL}/leads/${lead.id}`
  const incomeStr = lead.annual_income
    ? `₹${(lead.annual_income / 100000).toFixed(1).replace(/\.0$/, '')}L/yr`
    : null

  await sendEmail(
    RESEND_BROKER_API_KEY,
    BROKER_EMAIL,
    `🎯 New qualified lead — ${ticket}${name}`,
    wrap(`
      <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#F7F8FA;">${ticket}${name}</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7280;">Just qualified via chatbot · Needs follow-up within 48h</p>
      ${pill('Qualified', '#22c55e')}
      <table style="margin-top:20px;width:100%;border-collapse:collapse;">
        ${field('Phone',      lead.phone)}
        ${field('Email',      lead.email)}
        ${field('Age',        lead.age ? `${lead.age} yrs` : null)}
        ${field('Occupation', lead.occupation)}
        ${field('Income',     incomeStr)}
        ${field('Family',     lead.family_size ? `${lead.family_size} members` : null)}
        ${field('Interests',  concernList(lead))}
      </table>
      ${cta(detailUrl, 'Open lead')}
    `)
  )
}

export async function notifyBrokerDocsReceived(lead: LeadSummary, docCount: number) {
  const name      = lead.name ?? 'Unknown'
  const ticket    = ticketLabel(lead)
  const detailUrl = `${APP_URL}/leads/${lead.id}`

  await sendEmail(
    RESEND_BROKER_API_KEY,
    BROKER_EMAIL,
    `📄 Documents received — ${ticket}${name}`,
    wrap(`
      <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#F7F8FA;">${ticket}${name}</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7280;">${docCount} document${docCount !== 1 ? 's' : ''} uploaded and extracted · Ready for analysis</p>
      ${pill('Awaiting Analysis', '#f59e0b')}
      <table style="margin-top:20px;width:100%;border-collapse:collapse;">
        ${field('Phone', lead.phone)}
        ${field('Email', lead.email)}
        ${field('Interests', concernList(lead))}
      </table>
      ${cta(detailUrl, 'Run analysis')}
    `)
  )
}

export async function notifyBrokerAnalysisReady(
  lead: LeadSummary,
  analysis: { priority: string; recommendation: string; confidence_score: number }
) {
  const name      = lead.name ?? 'Unknown'
  const ticket    = ticketLabel(lead)
  const detailUrl = `${APP_URL}/leads/${lead.id}`

  const priorityColor =
    analysis.priority === 'urgent' ? '#ef4444' :
    analysis.priority === 'high'   ? '#f59e0b' :
    analysis.priority === 'medium' ? '#5E6AD2' : '#6B7280'

  await sendEmail(
    RESEND_BROKER_API_KEY,
    BROKER_EMAIL,
    `✅ Analysis ready — ${ticket}${name} [${analysis.priority.toUpperCase()}]`,
    wrap(`
      <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#F7F8FA;">${ticket}${name}</p>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7280;">AI analysis complete · Confidence: ${analysis.confidence_score}%</p>
      ${pill(analysis.priority.toUpperCase(), priorityColor)}
      <div style="margin-top:20px;padding:14px 16px;background:#0B0D10;border-radius:8px;border-left:3px solid ${priorityColor};">
        <p style="margin:0;font-size:13px;color:#A0A7B3;line-height:1.6;">${analysis.recommendation.slice(0, 300)}${analysis.recommendation.length > 300 ? '…' : ''}</p>
      </div>
      ${cta(detailUrl, 'View full analysis')}
    `)
  )
}

// ─── Customer notifications (use original Resend account) ────────────────────

export async function notifyCustomerDocsRequested(lead: LeadSummary) {
  if (!lead.email) return
  const name    = lead.name?.split(' ')[0] ?? 'there'
  const chatUrl = `${APP_URL}/chat`

  await sendEmail(
    RESEND_API_KEY,
    lead.email,
    'SecureLife — Please share your policy documents',
    wrap(`
      <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#F7F8FA;">Hi ${name}!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#A0A7B3;line-height:1.7;">
        Thank you for chatting with us. To give you the most accurate insurance analysis and recommendations,
        our advisor team would love to review your existing policy documents.
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#6B7280;">You can upload them directly through your chat portal:</p>
      ${cta(chatUrl, 'Upload documents')}
      <p style="margin:20px 0 0;font-size:12px;color:#4B5058;">
        Accepted formats: PDF. Your documents are stored securely and only accessed by your assigned broker.
      </p>
    `)
  )
}
