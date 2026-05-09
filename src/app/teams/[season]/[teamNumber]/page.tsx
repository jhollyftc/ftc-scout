'use client'

import { use } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import Image from 'next/image'
import { ArrowLeft, Calendar, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TeamsResponse, EventsResponse, FTCEvent } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SEASONS: Record<string, string> = {
  '2026': '2026–27 BioBuzz',
  '2025': '2025–26',
  '2024': '2024–25 Into The Deep',
  '2023': '2023–24 CENTERSTAGE',
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'Championship':
      return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    case 'Super Regional':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30'
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

function EventRow({ event, season, teamNumber }: { event: FTCEvent; season: string; teamNumber: string }) {
  const location = [event.city, event.stateprov, event.country !== 'US' ? event.country : null]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      href={`/events/${season}/${event.code}/teams/${teamNumber}`}
      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="font-medium text-sm leading-snug group-hover:text-orange-300 transition-colors flex-1">
            {event.name}
          </span>
          <Badge className={`shrink-0 text-xs border ${typeBadgeClass(event.typeName)}`}>
            {event.typeName}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Calendar className="w-3 h-3 shrink-0" />
            {fmtDateRange(event.dateStart, event.dateEnd)}
          </span>
          {location && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="w-3 h-3 shrink-0" />
              {location}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-zinc-600 font-mono shrink-0">{event.code}</span>
    </Link>
  )
}

export default function TeamSeasonPage({
  params,
}: {
  params: Promise<{ season: string; teamNumber: string }>
}) {
  const { season, teamNumber } = use(params)

  const { data: teamData, isLoading: teamLoading } = useSWR<TeamsResponse>(
    `/api/ftc/${season}/teams?teamNumber=${teamNumber}`,
    fetcher
  )

  const { data: eventsData, isLoading: eventsLoading } = useSWR<EventsResponse>(
    `/api/ftc/${season}/events?teamNumber=${teamNumber}`,
    fetcher
  )

  const team = teamData?.teams[0]
  const events = (eventsData?.events ?? [])
    .filter(e => e.published)
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())

  const isLoading = teamLoading || eventsLoading

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Image src="/logo.png" alt="Nova Pyra" width={28} height={28} className="drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]" />
          <span className="text-base font-bold tracking-tight">FTC Nova Pyra Scout</span>
          <span className="text-zinc-700 ml-1">·</span>
          <span className="text-sm text-zinc-400">{SEASONS[season] ?? season}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isLoading ? (
          <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-zinc-100">Team {teamNumber}</h1>
              {team ? (
                <>
                  <p className="text-zinc-400 text-lg mt-0.5">{team.nameShort}</p>
                  <p className="text-zinc-500 text-sm mt-1">
                    {[team.schoolName, team.city, team.stateProv, team.country !== 'US' ? team.country : null]
                      .filter(Boolean)
                      .join(' · ')}
                    {team.rookieYear ? ` · Rookie ${team.rookieYear}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-zinc-600 text-sm mt-1">Team not found for this season</p>
              )}
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300">Events This Season</h2>
              {events.length > 0 && (
                <span className="text-xs text-zinc-500">{events.length} event{events.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {events.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">
                No events found for team {teamNumber} in this season.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map(e => (
                  <EventRow key={e.code} event={e} season={season} teamNumber={teamNumber} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
