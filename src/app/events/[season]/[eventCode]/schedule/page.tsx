'use client'

import { use } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { calculateOPR, type TeamOPR } from '@/lib/opr'
import type { HybridMatch, HybridScheduleResponse } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function TeamLink({ teamNumber, teamName, season, eventCode }: { teamNumber: number; teamName: string; season: string; eventCode: string }) {
  return (
    <Link href={`/events/${season}/${eventCode}/teams/${teamNumber}`} className="group min-w-0">
      <span className="text-xs font-medium group-hover:underline block">{teamNumber}</span>
      <span className="text-[10px] text-zinc-600 block truncate">{teamName}</span>
    </Link>
  )
}

function allianceNopr(teams: HybridMatch['teams'], side: 'Red' | 'Blue', opr: Record<number, TeamOPR>): number | null {
  const alliance = teams.filter(t => t.station.startsWith(side))
  if (alliance.every(t => opr[t.teamNumber] === undefined)) return null
  return alliance.reduce((sum, t) => sum + (opr[t.teamNumber]?.nopr ?? 0), 0)
}

function MatchRow({ match, nextMatchNumber, season, eventCode, highlightTeam, opr }: { match: HybridMatch; nextMatchNumber: number | null; season: string; eventCode: string; highlightTeam: number | null; opr: Record<number, TeamOPR> }) {
  const done = match.scoreRedFinal !== null && match.scoreBlueFinal !== null
  const isNext = !done && match.matchNumber === nextMatchNumber
  const red = match.teams.filter(t => t.station.startsWith('Red'))
  const blue = match.teams.filter(t => t.station.startsWith('Blue'))
  const redWon = done && match.scoreRedFinal! > match.scoreBlueFinal!
  const blueWon = done && match.scoreBlueFinal! > match.scoreRedFinal!

  const predRed = !done ? allianceNopr(match.teams, 'Red', opr) : null
  const predBlue = !done ? allianceNopr(match.teams, 'Blue', opr) : null
  const hasPred = predRed !== null && predBlue !== null
  const predRedFavored = hasPred && predRed! > predBlue!
  const predBlueFavored = hasPred && predBlue! > predRed!

  const hasHighlight = highlightTeam !== null
  const isHighlighted = hasHighlight && match.teams.some(t => t.teamNumber === highlightTeam)
  const isDimmed = hasHighlight && !isHighlighted

  return (
    <tr
      className={`border-b border-zinc-800 transition-colors ${
        isDimmed
          ? 'opacity-25'
          : isHighlighted
          ? 'bg-sky-500/10 border-l-2 border-l-sky-500'
          : isNext
          ? 'bg-sky-500/5'
          : 'hover:bg-zinc-900/60'
      }`}
    >
      <td className="py-2.5 px-3 w-16">
        <span className="text-xs font-mono text-zinc-500">Q{match.matchNumber}</span>
        {isNext && (
          <span className="block text-xs text-sky-400 font-medium">Next</span>
        )}
      </td>
      <td className="py-2.5 px-3">
        <div className="grid grid-cols-2 gap-x-4">
          {red.map(t => (
            <div key={t.teamNumber} className="text-red-400 min-w-0">
              <TeamLink teamNumber={t.teamNumber} teamName={t.teamName} season={season} eventCode={eventCode} />
              {t.surrogate && <span className="text-red-600 text-[10px]">*</span>}
            </div>
          ))}
        </div>
      </td>
      <td className="py-2.5 px-3">
        <div className="grid grid-cols-2 gap-x-4">
          {blue.map(t => (
            <div key={t.teamNumber} className="text-blue-400 min-w-0">
              <TeamLink teamNumber={t.teamNumber} teamName={t.teamName} season={season} eventCode={eventCode} />
              {t.surrogate && <span className="text-blue-600 text-[10px]">*</span>}
            </div>
          ))}
        </div>
      </td>
      <td className="py-2.5 px-3 text-xs text-zinc-600 hidden sm:table-cell whitespace-nowrap">
        {match.startTime
          ? new Date(match.startTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—'}
      </td>
      <td className="py-2.5 px-3 text-right whitespace-nowrap">
        {done ? (
          <span className="font-mono text-xs">
            <span className={redWon ? 'text-red-400 font-bold' : 'text-zinc-400'}>
              {match.scoreRedFinal}
            </span>
            <span className="text-zinc-700 mx-1">–</span>
            <span className={blueWon ? 'text-blue-400 font-bold' : 'text-zinc-400'}>
              {match.scoreBlueFinal}
            </span>
          </span>
        ) : hasPred ? (
          <div className="text-right">
            <div className="font-mono text-xs italic">
              <span className={predRedFavored ? 'text-red-400/40 font-medium' : 'text-zinc-700'}>
                {Math.round(predRed!)}
              </span>
              <span className="text-zinc-800 mx-1">–</span>
              <span className={predBlueFavored ? 'text-blue-400/40 font-medium' : 'text-zinc-700'}>
                {Math.round(predBlue!)}
              </span>
            </div>
            <div className="text-[10px] text-sky-500/70 mt-0.5">predicted</div>
          </div>
        ) : (
          <Badge className="text-xs bg-zinc-800/50 text-zinc-500 border-zinc-700 font-normal">
            Pending
          </Badge>
        )}
      </td>
    </tr>
  )
}

export default function SchedulePage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const searchParams = useSearchParams()
  const highlightTeam = searchParams.get('team') ? Number(searchParams.get('team')) : null

  const { data, isLoading, error } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  if (isLoading) return <Spinner text="Loading schedule…" />
  if (error) return <ErrorMsg text="Failed to load schedule." />
  if (!data?.schedule?.length)
    return <Empty text="No matches scheduled yet." />

  const schedule = data.schedule
  const played = schedule.filter(m => m.scoreRedFinal !== null).length
  const nextMatchNumber =
    schedule.find(m => m.scoreRedFinal === null)?.matchNumber ?? null
  const opr = calculateOPR(schedule)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm text-zinc-300">Qualification Schedule</h2>
        <span className="text-xs text-zinc-500">
          {played} / {schedule.length} played
        </span>
      </div>
      <div className="rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Match</th>
              <th className="text-left py-2 px-3 text-xs text-red-500 font-medium">Red</th>
              <th className="text-left py-2 px-3 text-xs text-blue-500 font-medium">Blue</th>
              <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">
                Time
              </th>
              <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(m => (
              <MatchRow key={m.matchNumber} match={m} nextMatchNumber={nextMatchNumber} season={season} eventCode={eventCode} highlightTeam={highlightTeam} opr={opr} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-700 mt-2">* surrogate · predicted scores use nOPR once enough matches are played · auto-refreshes every 30s</p>
    </div>
  )
}

function Spinner({ text }: { text: string }) {
  return <p className="text-zinc-500 text-sm py-12 text-center">{text}</p>
}
function ErrorMsg({ text }: { text: string }) {
  return <p className="text-red-400 text-sm py-12 text-center">{text}</p>
}
function Empty({ text }: { text: string }) {
  return <p className="text-zinc-500 text-sm py-12 text-center">{text}</p>
}
