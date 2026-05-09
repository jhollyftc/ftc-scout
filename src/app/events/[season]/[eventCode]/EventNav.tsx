'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { Shield } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'

const TABS = [
  { label: 'Schedule', suffix: '/schedule' },
  { label: 'Results', suffix: '/results' },
  { label: 'Rankings', suffix: '/rankings' },
  { label: 'Predict', suffix: '/predict' },
]

export default function EventNav({
  season,
  eventCode,
}: {
  season: string
  eventCode: string
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isScout } = useScoutMode()
  const base = `/events/${season}/${eventCode}`
  const highlightTeam = searchParams.get('team') ?? ''

  const setHighlight = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('team', value)
      } else {
        params.delete('team')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  function tabHref(suffix: string) {
    const href = `${base}${suffix}`
    if (!highlightTeam) return href
    return `${href}?team=${highlightTeam}`
  }

  return (
    <div className="flex items-center gap-3 -mb-px">
      {isScout && (
        <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium shrink-0">
          <Shield className="w-3 h-3" /> Scout
        </span>
      )}
      <nav className="flex gap-1 overflow-x-auto">
        {TABS.map(tab => {
          const href = `${base}${tab.suffix}`
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.suffix)}
              className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'text-orange-400 border-orange-400 font-medium'
                  : 'text-zinc-500 border-transparent hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <input
          type="number"
          placeholder="Highlight team…"
          value={highlightTeam}
          onChange={e => setHighlight(e.target.value)}
          className="w-36 h-7 px-2 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {highlightTeam && (
          <button
            onClick={() => setHighlight('')}
            className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-1"
            aria-label="Clear highlight"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
