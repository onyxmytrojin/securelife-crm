export type LeadStatus =
  | 'new'
  | 'chatting'
  | 'qualified'
  | 'awaiting_docs'
  | 'processing'
  | 'completed'
  | 'rejected'

export type LeadSource = 'chatbot' | 'manual' | 'api'

export type MessageRole = 'user' | 'assistant' | 'system'

export type DocumentStatus = 'pending' | 'processing' | 'extracted' | 'failed'

export type AnalysisPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Lead {
  id: string
  created_at: string
  updated_at: string
  name: string | null
  email: string | null
  phone: string | null
  status: LeadStatus
  score: number
  source: LeadSource
  age: number | null
  occupation: string | null
  annual_income: number | null
  family_size: number | null
  existing_coverage: string | null
  primary_concern: string | null
  concerns: string[] | null
  location: string | null
  notes: string | null
}

export interface Conversation {
  id: string
  lead_id: string
  created_at: string
  role: MessageRole
  content: string
}

export interface Document {
  id: string
  lead_id: string
  created_at: string
  filename: string
  storage_path: string | null
  file_size: number | null
  mime_type: string
  status: DocumentStatus
  error: string | null
}

export interface ExtractedData {
  id: string
  document_id: string
  lead_id: string
  created_at: string
  policy_number: string | null
  policy_type: string | null
  provider_name: string | null
  policyholder_name: string | null
  sum_insured: number | null
  premium_amount: number | null
  premium_frequency: string | null
  coverage_start: string | null
  coverage_end: string | null
  renewal_date: string | null
  pre_existing_conditions: string | null
  exclusions: string | null
  waiting_period: string | null
  claim_history: string | null
  raw_fields: Record<string, unknown>
}

export interface Analysis {
  id: string
  lead_id: string
  created_at: string
  updated_at: string
  coverage_gaps: string | null
  potential_savings: string | null
  risk_flags: string | null
  recommendation: string | null
  priority: AnalysisPriority
  confidence_score: number | null
  raw_analysis: Record<string, unknown>
}

export interface LeadWithDetails extends Lead {
  conversations?: Conversation[]
  documents?: Document[]
  extracted_data?: ExtractedData[]
  analysis?: Analysis | null
}
