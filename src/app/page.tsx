'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Calendar, MapPin, Users, Shield, Lock } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FTCEvent, EventsResponse } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SEASONS = [
  { value: '2026', label: '2026–27 BioBuzz' },
  { value: '2025', label: '2025–26' },
  { value: '2024', label: '2024–25 Into The Deep' },
  { value: '2023', label: '2023–24 CENTERSTAGE' },
]

const TYPE_ORDER = [
  'Championship',
  'Super Regional',
  'State Championship',
  'Regional Championship',
  'League Tournament',
  'League Meet',
  'Qualifier',
  'Scrimmage',
  'Other',
]

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'Championship':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    case 'Super Regional':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    case 'State Championship':
    case 'Regional Championship':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    case 'League Tournament':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    case 'League Meet':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    default:
      return 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50'
  }
}

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const mo: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  if (s.toDateString() === e.toDateString())
    return s.toLocaleDateString('en-US', { ...mo, year: 'numeric' })
  if (s.getMonth() === e.getMonth())
    return `${s.toLocaleDateString('en-US', mo)}–${e.getDate()}, ${s.getFullYear()}`
  return `${s.toLocaleDateString('en-US', mo)} – ${e.toLocaleDateString('en-US', mo)}, ${s.getFullYear()}`
}

function EventCard({ event, season }: { event: FTCEvent; season: string }) {
  const location = [event.city, event.stateprov, event.country !== 'US' ? event.country : null]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={`/events/${season}/${event.code}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-snug group-hover:text-sky-300 transition-colors">
          {event.name}
        </h3>
        <Badge className={`shrink-0 text-xs border ${typeBadgeClass(event.typeName)}`}>
          {event.typeName}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        {fmtDateRange(event.dateStart, event.dateEnd)}
      </div>
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {location}
        </div>
      )}
      <p className="text-xs text-zinc-700 mt-2 font-mono">{event.code}</p>
    </Link>
  )
}

export default function HomePage() {
  const [season, setSeason] = useState('2025')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [teamInput, setTeamInput] = useState('')
  const [scoutOpen, setScoutOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const router = useRouter()
  const { isScout, unlock, lock } = useScoutMode()

  function handleTeamSearch(e: React.FormEvent) {
    e.preventDefault()
    const num = teamInput.trim()
    if (num) router.push(`/teams/${season}/${num}`)
  }

  function handleScoutLogin(e: React.FormEvent) {
    e.preventDefault()
    const ok = unlock(pinInput)
    if (ok) {
      setScoutOpen(false)
      setPinInput('')
      setPinError(false)
    } else {
      setPinError(true)
      setPinInput('')
    }
  }

  const { data, isLoading, error } = useSWR<EventsResponse>(
    `/api/ftc/${season}/events`,
    fetcher
  )

  const allEvents = data?.events ?? []

  const types = Array.from(new Set(allEvents.map(e => e.typeName))).sort(
    (a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)
  )

  const events = allEvents
    .filter(e => e.published)
    .filter(
      e =>
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.city?.toLowerCase().includes(search.toLowerCase()) ||
        e.code.toLowerCase().includes(search.toLowerCase())
    )
    .filter(e => !typeFilter || e.typeName === typeFilter)
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Nova Pyra" width={44} height={44} className="drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]" />
            <span className="text-base font-bold tracking-tight">FTC Nova Pyra Scout</span>
          </div>
          <form onSubmit={handleTeamSearch} className="flex items-center gap-1.5">
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="number"
                placeholder="Team #"
                value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                className="w-28 h-9 pl-8 pr-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              type="submit"
              disabled={!teamInput.trim()}
              className="h-9 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </form>

          <Select value={season} onValueChange={v => { if (v) setSeason(v) }}>
            <SelectTrigger className="w-52 bg-zinc-800 border-zinc-700 text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {SEASONS.map(s => (
                <SelectItem
                  key={s.value}
                  value={s.value}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isScout ? (
            <button
              onClick={lock}
              className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-md border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors shrink-0"
            >
              <Shield className="w-3.5 h-3.5" />
              Scout Mode
            </button>
          ) : scoutOpen ? (
            <form onSubmit={handleScoutLogin} className="flex items-center gap-1.5 shrink-0">
              <input
                type="password"
                placeholder="PIN"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false) }}
                autoFocus
                className={`w-20 h-9 px-2 text-sm rounded-md border bg-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none ${
                  pinError ? 'border-red-500' : 'border-zinc-700 focus:border-sky-500'
                }`}
              />
              <button type="submit" className="h-9 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 transition-colors">
                Unlock
              </button>
              <button type="button" onClick={() => { setScoutOpen(false); setPinError(false); setPinInput('') }} className="text-zinc-500 hover:text-zinc-300 transition-colors px-1">
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setScoutOpen(true)}
              className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              Scout
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <Input
            placeholder="Search events, cities, codes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 placeholder:text-zinc-600 focus-visible:ring-sky-500/50"
          />
        </div>

        {types.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <FilterChip active={typeFilter === null} onClick={() => setTypeFilter(null)}>
              All
            </FilterChip>
            {types.map(t => (
              <FilterChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              >
                {t}
              </FilterChip>
            ))}
          </div>
        )}

        {isLoading && (
          <p className="text-zinc-500 text-sm py-12 text-center">Loading events…</p>
        )}
        {error && (
          <p className="text-red-400 text-sm py-12 text-center">
            Failed to load events. Check API credentials.
          </p>
        )}

        {!isLoading && !error && (
          <>
            <p className="text-zinc-600 text-xs mb-4">{events.length} events</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {events.map(e => (
                <EventCard key={e.code} event={e} season={season} />
              ))}
            </div>
            {events.length === 0 && (
              <p className="text-zinc-500 text-sm py-12 text-center">
                {season === '2026'
                  ? "BioBuzz events haven't been published yet — check back closer to the season."
                  : 'No events match your search.'}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  )
}
