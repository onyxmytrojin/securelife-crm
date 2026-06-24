'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Shield, Loader2, ChevronRight } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { label: 'Broker (internal)', email: 'broker@securelife.com', password: process.env.NEXT_PUBLIC_DEMO_BROKER_PASSWORD ?? '', hint: 'Pipeline dashboard + analysis' },
  { label: 'Customer (prospect)', email: 'customer@demo.com', password: process.env.NEXT_PUBLIC_DEMO_CUSTOMER_PASSWORD ?? '', hint: 'Chat with Priya' },
]

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router   = useRouter()
  const supabase = createClient()

  const signIn = async (e?: React.FormEvent, prefill?: { email: string; password: string }) => {
    e?.preventDefault()
    const creds = prefill ?? { email, password }
    if (!creds.email || !creds.password) return
    setLoading(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword(creds)
    if (authError) { setError(authError.message); setLoading(false); return }
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single()
    router.push(profile?.role === 'customer' ? '/chat' : '/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center p-4">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#5E6AD2] rounded-xl mb-4 shadow-[0_0_24px_rgba(94,106,210,0.35)]">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-[22px] font-semibold text-[#F7F8FA] tracking-tight">SecureLife CRM</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Sign in to continue</p>
        </div>

        {/* Form card */}
        <form onSubmit={signIn}
          className="bg-[#111317] rounded-2xl border border-white/[0.07] p-6 flex flex-col gap-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#A0A7B3]">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="broker@securelife.com"
              autoComplete="email"
              className="h-9 px-3 rounded-lg bg-[#0B0D10] border border-white/[0.08]
                text-[14px] text-[#F7F8FA] placeholder:text-[#4B5058]
                focus:outline-none focus:border-[#5E6AD2]/60 focus:ring-0
                transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[#A0A7B3]">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              className="h-9 px-3 rounded-lg bg-[#0B0D10] border border-white/[0.08]
                text-[14px] text-[#F7F8FA] placeholder:text-[#4B5058]
                focus:outline-none focus:border-[#5E6AD2]/60 focus:ring-0
                transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="h-9 w-full rounded-lg bg-[#5E6AD2] hover:bg-[#6B78E7]
              text-[14px] font-medium text-white
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign in'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="mt-5">
          <p className="text-[11px] text-[#4B5058] text-center mb-3 uppercase tracking-widest font-semibold">Demo accounts</p>
          <div className="flex flex-col gap-2">
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => { setEmail(acc.email); setPassword(acc.password); signIn(undefined, acc) }}
                disabled={loading}
                className="w-full flex items-center justify-between bg-[#111317] border border-white/[0.06]
                  rounded-xl px-4 py-3 hover:border-white/[0.12] hover:bg-[#151821]
                  transition-colors text-left group disabled:opacity-50"
              >
                <div>
                  <p className="text-[13px] font-medium text-[#F7F8FA]">{acc.label}</p>
                  <p className="text-[11px] text-[#6B7280] mt-0.5">{acc.hint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#4B5058] font-mono hidden sm:block">{acc.email}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#4B5058] group-hover:text-[#A0A7B3] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
