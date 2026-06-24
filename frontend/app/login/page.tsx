'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Loader2, ChevronRight } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { label: 'Broker (internal)',   email: 'broker@securelife.com', password: process.env.NEXT_PUBLIC_DEMO_BROKER_PASSWORD ?? '', hint: 'Pipeline dashboard + analysis' },
  { label: 'Customer (prospect)', email: 'customer@demo.com',     password: process.env.NEXT_PUBLIC_DEMO_CUSTOMER_PASSWORD ?? '', hint: 'Chat with Priya' },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.583c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.583 9 3.583z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
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

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (authError) { setError(authError.message); setGoogleLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#08090B] flex flex-col items-center justify-center p-4">
      {/* Subtle grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="relative w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block rounded-2xl overflow-hidden mb-3 bg-white shadow-[0_0_32px_rgba(94,106,210,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/companylogo.png" alt="SecureLife Insurance" width={140} height={140} className="block object-contain" />
          </div>
          <p className="text-[13px] text-[#6B7280] mt-1">Sign in to continue</p>
        </div>

        {/* Google SSO */}
        <button
          onClick={signInWithGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl
            bg-white hover:bg-gray-50 text-[#111317]
            text-[14px] font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors mb-4 shadow-sm"
        >
          {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="text-[11px] text-[#4B5058] font-medium">or</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>

        {/* Email/password form */}
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
                disabled={loading || googleLoading}
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
