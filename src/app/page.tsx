'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, Calendar, MapPin, Users, Shield, Lock, ChevronRight } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FTCEvent, EventsResponse } from '@/lib/ftc-client'

const NOVA_PYRA = '25619'
const fetcher = (url: string) => fetch(url).then(r => r.json())

const SEASONS = [
  { value: '2026', label: '2026–27 BioBuzz' },
  { value: '2025', label: '2025–26 Decode' },
  { value: '2024', label: '2024–25 Into The Deep' },
  { value: '2023', label: '2023–24 Centerstage' },
]

const TYPE_ORDER = [
  'Championship', 'Super Regional', 'State Championship', 'Regional Championship',
  'League Tournament', 'League Meet', 'Qualifier', 'Scrimmage', 'Other',
]

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'Championship':         return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    case 'Super Regional':       return 'bg-sky-500/15 text-sky-300 border-sky-500/30'
    case 'State Championship':
    case 'Regional Championship':return 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    case 'League Tournament':    return 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    case 'League Meet':          return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    default:                     return 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50'
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
    .filter(Boolean).join(', ')
  return (
    <Link
      href={`/events/${season}/${event.code}`}
      className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-snug group-hover:text-sky-300 transition-colors">{event.name}</h3>
        <Badge className={`shrink-0 text-xs border ${typeBadgeClass(event.typeName)}`}>{event.typeName}</Badge>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        {fmtDateRange(event.dateStart, event.dateEnd)}
      </div>
      {location && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin className="w-3.5 h-3.5 shrink-0" />{location}
        </div>
      )}
      <p className="text-xs text-zinc-700 mt-2 font-mono">{event.code}</p>
    </Link>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export default function HomePage() {
  const [season, setSeason] = useState('2025')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [teamInput, setTeamInput] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [scoutOpen, setScoutOpen] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const router = useRouter()
  const { isScout, isAdmin, scoutName, login, logout } = useScoutMode()

  const { data: scoutsData } = useSWR<{ names: string[] }>('/api/auth/scouts', fetcher)

  // Nova Pyra's events — always fetched, small payload
  const { data: novaData } = useSWR<EventsResponse>(
    `/api/ftc/${season}/events?teamNumber=${NOVA_PYRA}`,
    fetcher
  )

  // All events — lazy: only fetches when search section is activated
  const { data: allData, isLoading: allLoading } = useSWR<EventsResponse>(
    searchActive ? `/api/ftc/${season}/events` : null,
    fetcher
  )

  function handleTeamSearch(e: React.FormEvent) {
    e.preventDefault()
    const num = teamInput.trim()
    if (num) router.push(`/teams/${season}/${num}`)
  }

  async function handleScoutLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedName) return
    const ok = await login(selectedName, pinInput)
    if (ok) { setScoutOpen(false); setPinInput(''); setSelectedName(''); setPinError(false) }
    else { setPinError(true); setPinInput('') }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const novaEvents = (novaData?.events ?? [])
    .filter(e => e.published)
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())

  const nextEvent = novaEvents.find(e => new Date(e.dateEnd) >= today) ?? null

  function daysUntil(dateStr: string): number {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  function statusLabel(event: FTCEvent): { text: string; color: string } {
    const start = new Date(event.dateStart); start.setHours(0, 0, 0, 0)
    const end = new Date(event.dateEnd); end.setHours(0, 0, 0, 0)
    if (end < today)    return { text: 'Past', color: 'text-zinc-600' }
    if (start <= today) return { text: 'Now', color: 'text-green-400' }
    const days = daysUntil(event.dateStart)
    if (days === 1)     return { text: 'Tomorrow', color: 'text-sky-300' }
    if (days <= 7)      return { text: `${days} days`, color: 'text-sky-400' }
    return { text: fmtDateRange(event.dateStart, event.dateEnd), color: 'text-zinc-500' }
  }

  const filteredAll = (allData?.events ?? [])
    .filter(e => e.published)
    .filter(e =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.city?.toLowerCase().includes(search.toLowerCase()) ||
      e.code.toLowerCase().includes(search.toLowerCase())
    )
    .filter(e => !typeFilter || e.typeName === typeFilter)
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())

  const allTypes = Array.from(new Set((allData?.events ?? []).map(e => e.typeName)))
    .sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Image
              src="/logo.png" alt="Nova Pyra" width={44} height={44}
              className="drop-shadow-[0_0_6px_rgba(96,165,250,0.5)] shrink-0"
            />
            <span className="text-base font-bold tracking-tight">FTC Nova Pyra Scout</span>
            {isScout && scoutName && (
              <span className="hidden sm:block text-sm text-zinc-400 ml-1">
                Hey, <span className="text-green-400 font-medium">{scoutName}</span>!
              </span>
            )}
          </div>

          {/* Scout mode */}
          {isScout ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-md border border-green-500/30 bg-green-500/10 text-green-400">
                <Shield className="w-3.5 h-3.5" /> {scoutName}
              </span>
              {isAdmin && (
                <span className="flex items-center h-9 px-2 text-xs rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  Admin
                </span>
              )}
              <button onClick={logout} className="text-zinc-500 hover:text-zinc-300 transition-colors px-1 h-9 flex items-center" aria-label="Log out">
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : scoutOpen ? (
            <form onSubmit={handleScoutLogin} className="flex items-center gap-1.5 shrink-0">
              <select
                value={selectedName}
                onChange={e => { setSelectedName(e.target.value); setPinError(false) }}
                className="h-9 px-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">— name —</option>
                {(scoutsData?.names ?? []).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                type="password" placeholder="PIN" value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false) }}
                autoFocus
                className={`w-16 h-9 px-2 text-sm rounded-md border bg-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none ${pinError ? 'border-red-500' : 'border-zinc-700 focus:border-sky-500'}`}
              />
              <button type="submit" className="h-9 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 transition-colors">
                Log in
              </button>
              <button type="button" onClick={() => { setScoutOpen(false); setPinError(false); setPinInput(''); setSelectedName('') }} className="text-zinc-500 hover:text-zinc-300 px-1">✕</button>
            </form>
          ) : (
            <button onClick={() => setScoutOpen(true)} className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors shrink-0">
              <Lock className="w-3.5 h-3.5" /> Scout
            </button>
          )}

          {/* Season selector */}
          <div className="w-full sm:w-52">
            <Select value={season} onValueChange={v => { if (v) setSeason(v) }}>
              <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {SEASONS.map(s => (
                  <SelectItem key={s.value} value={s.value} className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Nova Pyra Events ── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Image src="/logo.png" alt="" width={18} height={18} className="opacity-60 shrink-0" />
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nova Pyra · Team {NOVA_PYRA}</h2>
          </div>

          {/* Next event card */}
          {nextEvent && (
            <Link
              href={`/events/${season}/${nextEvent.code}`}
              className="block rounded-xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500/50 transition-colors p-5 mb-4 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${statusLabel(nextEvent).color}`}>
                      {new Date(nextEvent.dateStart) <= today ? '● Now' : `Next · ${statusLabel(nextEvent).text}`}
                    </span>
                    <Badge className={`text-xs border ${typeBadgeClass(nextEvent.typeName)}`}>
                      {nextEvent.typeName}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-100 group-hover:text-sky-300 transition-colors leading-snug mb-2">
                    {nextEvent.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {fmtDateRange(nextEvent.dateStart, nextEvent.dateEnd)}
                    </span>
                    {[nextEvent.city, nextEvent.stateprov].filter(Boolean).join(', ') && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {[nextEvent.city, nextEvent.stateprov].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-sky-500/40 group-hover:text-sky-400 shrink-0 mt-1 transition-colors" />
              </div>
            </Link>
          )}

          {/* All season events compact list */}
          {novaEvents.length > 1 && (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              {novaEvents.map(event => {
                const isPast = new Date(event.dateEnd) < today
                const isNext = event.code === nextEvent?.code
                const { text, color } = statusLabel(event)
                return (
                  <Link
                    key={event.code}
                    href={`/events/${season}/${event.code}`}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/60 transition-colors ${isPast ? 'opacity-50' : ''}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNext ? 'bg-sky-400' : isPast ? 'bg-zinc-700' : 'bg-zinc-600'}`} />
                    <span className={`text-sm min-w-0 flex-1 truncate ${isNext ? 'text-sky-300 font-medium' : isPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                      {event.name}
                    </span>
                    <span className={`text-xs shrink-0 ${color}`}>{text}</span>
                    <Badge className={`shrink-0 text-[10px] border ${typeBadgeClass(event.typeName)}`}>
                      {event.typeName}
                    </Badge>
                  </Link>
                )
              })}
            </div>
          )}

          {novaData && novaEvents.length === 0 && (
            <p className="text-zinc-600 text-sm">No published events for Team {NOVA_PYRA} this season.</p>
          )}
          {!novaData && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 h-28 animate-pulse" />
          )}
        </section>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600 uppercase tracking-wider">Other teams &amp; events</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* ── Secondary: team search + event search ── */}
        <section>
          <form onSubmit={handleTeamSearch} className="flex items-center gap-2 mb-6">
            <div className="relative">
              <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="number" placeholder="Team #" value={teamInput}
                onChange={e => setTeamInput(e.target.value)}
                className="w-32 h-9 pl-8 pr-2 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <button
              type="submit" disabled={!teamInput.trim()}
              className="h-9 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-40"
            >
              Go
            </button>
          </form>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              placeholder="Search all events, cities, codes…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchActive(true) }}
              onFocus={() => setSearchActive(true)}
              className="w-full h-10 pl-9 pr-3 text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {searchActive && (
            <>
              {allLoading && <p className="text-zinc-500 text-sm py-8 text-center">Loading events…</p>}
              {!allLoading && allData && (
                <>
                  {allTypes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      <FilterChip active={typeFilter === null} onClick={() => setTypeFilter(null)}>All</FilterChip>
                      {allTypes.map(t => (
                        <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>{t}</FilterChip>
                      ))}
                    </div>
                  )}
                  <p className="text-zinc-600 text-xs mb-3">{filteredAll.length} events</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAll.map(e => <EventCard key={e.code} event={e} season={season} />)}
                  </div>
                  {filteredAll.length === 0 && (
                    <p className="text-zinc-500 text-sm py-8 text-center">No events match your search.</p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
