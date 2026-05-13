'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Shield } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'

const TABS = [
  { label: 'Teams', suffix: '/teams' },
  { label: 'Schedule', suffix: '/schedule' },
  { label: 'Results', suffix: '/results' },
  { label: 'Rankings', suffix: '/rankings' },
  { label: 'Compare', suffix: '/compare' },
  { label: 'Predict', suffix: '/predict' },
]

const SCOUT_TABS = [
  { label: 'Scout', suffix: '/scout' },
  { label: 'Pick List', suffix: '/picklist' },
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
  const { isScout, isAdmin } = useScoutMode()
  const base = `/events/${season}/${eventCode}`
  const highlightTeam = searchParams.get('team') ?? ''

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
      {isAdmin && (
        <span className="text-[10px] text-amber-400 font-medium shrink-0">Admin</span>
      )}
      <nav className="flex gap-1 overflow-x-auto">
        {[...TABS, ...(isScout ? SCOUT_TABS : [])].map(tab => {
          const href = `${base}${tab.suffix}`
          const active = pathname === href || pathname.startsWith(href + '/')
          const isScoutTab = tab.suffix === '/scout'
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.suffix)}
              className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? isScoutTab
                    ? 'text-green-400 border-green-400 font-medium'
                    : 'text-sky-400 border-sky-400 font-medium'
                  : isScoutTab
                  ? 'text-green-600 border-transparent hover:text-green-400'
                  : 'text-zinc-500 border-transparent hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

    </div>
  )
}
