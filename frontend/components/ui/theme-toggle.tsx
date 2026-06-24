'use client'
import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen]       = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!mounted) return <div className="w-7 h-7" />

  const icon =
    theme === 'dark'   ? <Moon className="w-3.5 h-3.5" /> :
    theme === 'light'  ? <Sun className="w-3.5 h-3.5" />  :
                         <Monitor className="w-3.5 h-3.5" />

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-md text-gray-400 dark:text-[#6E7480] hover:text-gray-600 dark:hover:text-[#A1A7B3] hover:bg-gray-100 dark:hover:bg-[#171A1F] transition-colors"
        title="Theme"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-[#111317] border border-gray-200 dark:border-[#1E2028] rounded-xl shadow-lg dark:shadow-black/50 z-50 py-1 min-w-[130px] overflow-hidden">
          {([
            ['light',  <Sun className="w-3 h-3" key="sun" />,     'Light'],
            ['dark',   <Moon className="w-3 h-3" key="moon" />,   'Dark'],
            ['system', <Monitor className="w-3 h-3" key="mon" />, 'System'],
          ] as const).map(([t, ic, label]) => (
            <button
              key={t}
              onClick={() => { setTheme(t); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-[#171A1F] transition-colors ${
                theme === t
                  ? 'text-gray-900 dark:text-[#F7F8FA] font-semibold'
                  : 'text-gray-500 dark:text-[#A1A7B3]'
              }`}
            >
              {ic}{label}
              {theme === t && <span className="ml-auto text-[#5E6AD2] text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
