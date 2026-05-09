'use client'

import { use } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
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

function ResultRow({ match, season, eventCode, highlightTeam, opr }: {
  match: HybridMatch
  season: string
  eventCode: string
  highlightTeam: number | null
  opr: Record<number, TeamOPR>
}) {
  const redWon = match.scoreRedFinal! > match.scoreBlueFinal!
  const blueWon = match.scoreBlueFinal! > match.scoreRedFinal!
  const red = match.teams.filter(t => t.station.startsWith('Red'))
  const blue = match.teams.filter(t => t.station.startsWith('Blue'))

  const predRed = allianceNopr(match.teams, 'Red', opr)
  const predBlue = allianceNopr(match.teams, 'Blue', opr)
  const hasPred = predRed !== null && predBlue !== null
  const predRedWon = hasPred && predRed! > predBlue!
  const predBlueWon = hasPred && predBlue! > predRed!
  const isUpset = hasPred && predRed !== predBlue && (
    (redWon && predBlueWon) || (blueWon && predRedWon)
  )

  const hasHighlight = highlightTeam !== null
  const isHighlighted = hasHighlight && match.teams.some(t => t.teamNumber === highlightTeam)
  const isDimmed = hasHighlight && !isHighlighted

  return (
    <tr className={`border-b border-zinc-800 transition-colors ${
      isDimmed
        ? 'opacity-25'
        : isHighlighted
        ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
        : 'hover:bg-zinc-900/60'
    }`}>
      {/* Match number + upset flag */}
      <td className="py-2.5 px-3 w-16">
        <span className="text-xs font-mono text-zinc-500">Q{match.matchNumber}</span>
        {isUpset && (
          <span className="block text-[10px] font-semibold text-amber-400 leading-tight">UPSET</span>
        )}
      </td>

      {/* Red alliance */}
      <td className="py-2.5 px-3">
        <div className="grid grid-cols-2 gap-x-4">
          {red.map(t => (
            <div key={t.teamNumber} className="text-red-400 min-w-0">
              <TeamLink teamNumber={t.teamNumber} teamName={t.teamName} season={season} eventCode={eventCode} />
            </div>
          ))}
        </div>
      </td>

      {/* Score: actual + predicted stacked */}
      <td className="py-2.5 px-3 text-center whitespace-nowrap">
        <div>
          <span className={`text-sm font-bold font-mono ${redWon ? 'text-red-400' : 'text-zinc-500'}`}>
            {match.scoreRedFinal}
          </span>
          <span className="text-zinc-700 mx-1.5 text-sm">–</span>
          <span className={`text-sm font-bold font-mono ${blueWon ? 'text-blue-400' : 'text-zinc-500'}`}>
            {match.scoreBlueFinal}
          </span>
        </div>
        {hasPred && (
          <div className="text-[10px] font-mono text-zinc-600 mt-0.5">
            <span className={predRedWon ? 'text-red-500/50' : ''}>{Math.round(predRed!)}</span>
            <span className="mx-1 text-zinc-700">–</span>
            <span className={predBlueWon ? 'text-blue-500/50' : ''}>{Math.round(predBlue!)}</span>
          </div>
        )}
      </td>

      {/* Blue alliance */}
      <td className="py-2.5 px-3 text-right">
        <div className="grid grid-cols-2 gap-x-4">
          {blue.map(t => (
            <div key={t.teamNumber} className="text-blue-400 min-w-0">
              <TeamLink teamNumber={t.teamNumber} teamName={t.teamName} season={season} eventCode={eventCode} />
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

export default function ResultsPage({
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

  if (isLoading) return <p className="text-zinc-500 text-sm py-12 text-center">Loading results…</p>
  if (error) return <p className="text-red-400 text-sm py-12 text-center">Failed to load results.</p>

  const schedule = data?.schedule ?? []
  const completed = schedule
    .filter(m => m.scoreRedFinal !== null && m.scoreBlueFinal !== null)
    .sort((a, b) => b.matchNumber - a.matchNumber)

  if (!completed.length)
    return <p className="text-zinc-500 text-sm py-12 text-center">No results yet.</p>

  const opr = calculateOPR(schedule)

  const avgRed = completed.reduce((s, m) => s + m.scoreRedFinal!, 0) / completed.length
  const avgBlue = completed.reduce((s, m) => s + m.scoreBlueFinal!, 0) / completed.length
  const avgScore = Math.round((avgRed + avgBlue) / 2)

  // Prediction accuracy: matches where predicted winner = actual winner
  let predCorrect = 0
  let predTotal = 0
  for (const m of completed) {
    const pRed = allianceNopr(m.teams, 'Red', opr)
    const pBlue = allianceNopr(m.teams, 'Blue', opr)
    if (pRed === null || pBlue === null || pRed === pBlue) continue
    predTotal++
    const actualRedWon = m.scoreRedFinal! > m.scoreBlueFinal!
    if ((pRed > pBlue) === actualRedWon) predCorrect++
  }
  const accuracy = predTotal > 0 ? Math.round((predCorrect / predTotal) * 100) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-sm text-zinc-300">Match Results</h2>
        <span className="text-xs text-zinc-500">
          avg score: <span className="text-zinc-300">{avgScore}</span> · {completed.length} matches
        </span>
      </div>
      {accuracy !== null && (
        <p className="text-xs text-zinc-500 mb-4">
          nOPR prediction accuracy:{' '}
          <span className="text-zinc-300">{predCorrect}/{predTotal}</span>
          {' '}matches{' '}
          <span className={accuracy >= 70 ? 'text-green-400' : accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}>
            ({accuracy}%)
          </span>
        </p>
      )}
      <div className="rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Match</th>
              <th className="text-left py-2 px-3 text-xs text-red-500 font-medium">Red</th>
              <th className="text-center py-2 px-3 text-xs text-zinc-500 font-medium">
                <div>Score</div>
                <div className="text-[10px] text-zinc-700 font-normal">nOPR pred</div>
              </th>
              <th className="text-right py-2 px-3 text-xs text-blue-500 font-medium">Blue</th>
            </tr>
          </thead>
          <tbody>
            {completed.map(m => (
              <ResultRow key={m.matchNumber} match={m} season={season} eventCode={eventCode} highlightTeam={highlightTeam} opr={opr} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-700 mt-2">
        Predicted score = sum of alliance nOPRs · most recent first · auto-refreshes every 30s
      </p>
    </div>
  )
}
