'use client'
import type { ExtractedData } from '@/lib/types'
import { FileText } from 'lucide-react'

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">
        {value != null && value !== '' ? String(value) : <span className="text-gray-300 font-normal">Not found</span>}
      </p>
    </div>
  )
}

function currency(val: number | null | undefined) {
  if (val == null) return null
  return `₹${Number(val).toLocaleString('en-IN')}`
}

export function ExtractedFields({ data }: { data: ExtractedData }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Extracted Policy Data</span>
      </div>
      <div className="px-4 divide-y divide-gray-50">
        <div className="grid grid-cols-2 gap-x-6">
          <Field label="Policy Number" value={data.policy_number} />
          <Field label="Policy Type" value={data.policy_type} />
          <Field label="Provider" value={data.provider_name} />
          <Field label="Policyholder" value={data.policyholder_name} />
          <Field label="Sum Insured" value={currency(data.sum_insured)} />
          <Field label="Premium" value={data.premium_amount ? `${currency(data.premium_amount)} / ${data.premium_frequency ?? 'year'}` : null} />
          <Field label="Coverage Start" value={data.coverage_start} />
          <Field label="Coverage End" value={data.coverage_end} />
          <Field label="Renewal Date" value={data.renewal_date} />
          <Field label="Waiting Period" value={data.waiting_period} />
        </div>
        {data.pre_existing_conditions && <Field label="Pre-existing Conditions" value={data.pre_existing_conditions} />}
        {data.exclusions && <Field label="Exclusions" value={data.exclusions} />}
        {data.claim_history && <Field label="Claim History" value={data.claim_history} />}
      </div>
    </div>
  )
}
