'use client'

import { use, useMemo, useState } from 'react'
import useSWR from 'swr'
import { Shield } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
import { getSeasonConfig } from '@/lib/season-config'
import { TeamPopover } from '@/components/TeamPopover'
import type { HybridScheduleResponse, RankingsResponse } from '@/lib/ftc-client'
import type { MatchScoutEntryWithMatch } from '@/app/api/match-scout/[season]/[eventCode]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())


function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

function topEndgame(entries: MatchScoutEntryWithMatch[]): string | null {
  const counts: Record<string, number> = {}
  for (const e of entries) {
    if (e.endgame && e.endgame !== 'None') counts[e.endgame] = (counts[e.endgame] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function latestNote(entries: MatchScoutEntryWithMatch[]): string | null {
  return (
    [...entries]
      .filter(e => e.notes?.trim())
      .sort((a, b) => new Date(b.scoutedAt).getTime() - new Date(a.scoutedAt).getTime())[0]
      ?.notes ?? null
  )
}

export default function TeamsPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const { isScout } = useScoutMode()

  const { data: schedData } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )
  const { data: rankData } = useSWR<RankingsResponse>(
    `/api/ftc/${season}/rankings/${eventCode}`,
    fetcher,
    { refreshInterval: 30_000 }
  )
  const { data: allMatchScout } = useSWR<Record<string, MatchScoutEntryWithMatch[]>>(
    isScout ? `/api/match-scout/${season}/${eventCode}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const { data: allPitData } = useSWR<Record<string, Record<string, string | number | null>>>(
    isScout ? `/api/pit/${season}/${eventCode}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const [pitTeam, setPitTeam] = useState<number | null>(null)
  const [scoutTeam, setScoutTeam] = useState<number | null>(null)

  const schedule = schedData?.schedule ?? []
  const opr = useMemo(() => calculateOPR(schedule), [schedule])

  const teams = useMemo(() => {
    const seen = new Set<number>()
    const result: { teamNumber: number; teamName: string }[] = []
    for (const match of schedule) {
      for (const t of match.teams) {
        if (!seen.has(t.teamNumber)) {
          seen.add(t.teamNumber)
          result.push({ teamNumber: t.teamNumber, teamName: t.teamName })
        }
      }
    }
    return result.sort((a, b) => a.teamNumber - b.teamNumber)
  }, [schedule])

  if (!schedData) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
        Loading teams…
      </div>
    )
  }

  const pitCount = isScout && allPitData ? Object.keys(allPitData).length : null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-3 text-xs text-zinc-500">
        <span>{teams.length} teams</span>
        {pitCount !== null && (
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-700" />
            {pitCount}/{teams.length} pit scouted
          </span>
        )}
      </div>

      <div className="space-y-1">
        {teams.map(({ teamNumber, teamName }) => {
          const key = String(teamNumber)
          const rankInfo = rankData?.rankings.find(r => r.teamNumber === teamNumber)
          const oprInfo = opr[teamNumber]
          const entries: MatchScoutEntryWithMatch[] = allMatchScout?.[key] ?? []
          const hasPit: boolean | undefined = allPitData ? key in allPitData : undefined

          return (
            <div
              key={teamNumber}
              className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
            >
              <TeamPopover
                season={season}
                eventCode={eventCode}
                teamNumber={teamNumber}
                teamName={teamName}
                rank={rankInfo?.rank}
                record={
                  rankInfo
                    ? `${rankInfo.wins}–${rankInfo.losses}–${rankInfo.ties}`
                    : undefined
                }
                nopr={oprInfo?.nopr}
                avgAuto={avg(entries.map(e => e.autoRating))}
                avgTeleop={avg(entries.map(e => e.teleopRating))}
                topEndgame={isScout ? topEndgame(entries) : null}
                matchCount={isScout ? entries.length : undefined}
                hasPit={hasPit}
                latestNote={isScout ? latestNote(entries) : null}
              />

              <p className="flex-1 min-w-0 text-xs text-zinc-400 truncate">{teamName}</p>

              {isScout && (allPitData !== undefined || allMatchScout !== undefined) && (
                <div className="flex items-center gap-1.5 shrink-0 w-[84px] justify-end">
                  {allPitData !== undefined && (
                    <button
                      onClick={() => hasPit ? setPitTeam(teamNumber) : undefined}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${
                        hasPit
                          ? 'bg-green-900/50 text-green-400 hover:bg-green-900/80 cursor-pointer'
                          : 'bg-zinc-800 text-zinc-600 cursor-default'
                      }`}
                    >
                      {hasPit ? 'Pit ✓' : 'Pit'}
                    </button>
                  )}
                  {allMatchScout !== undefined && (
                    <button
                      onClick={() => entries.length > 0 ? setScoutTeam(teamNumber) : undefined}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 transition-colors ${
                        entries.length > 0
                          ? 'bg-sky-900/30 text-sky-400 hover:bg-sky-900/60 cursor-pointer'
                          : 'text-zinc-700 cursor-default'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {entries.length}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pit Scouting Modal */}
      {pitTeam !== null && (() => {
        const pitInfo = allPitData?.[String(pitTeam)]
        const teamName = teams.find(t => t.teamNumber === pitTeam)?.teamName
        const config = getSeasonConfig(season)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setPitTeam(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div>
                  <span className="text-sm font-bold text-zinc-200">Team {pitTeam}</span>
                  {teamName && <span className="text-xs text-zinc-500 ml-2">{teamName}</span>}
                </div>
                <button
                  onClick={() => setPitTeam(null)}
                  className="text-zinc-600 hover:text-zinc-300 text-sm px-1 transition-colors"
                >✕</button>
              </div>
              <div className="px-4 py-3 flex flex-col gap-3">
                {pitInfo ? (
                  <>
                    {config.pitFields.map(field => {
                      const value = pitInfo[field.key]
                      if (value === null || value === undefined || value === '') return null
                      return (
                        <div key={field.key} className="flex items-start gap-3">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-20 shrink-0 mt-0.5">{field.label}</span>
                          {field.type === 'rating' ? (
                            <span className="text-xs text-zinc-300">
                              {'★'.repeat(Number(value))}{'☆'.repeat(5 - Number(value))}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-300">{String(value)}</span>
                          )}
                        </div>
                      )
                    })}
                    {pitInfo._scoutedBy && (
                      <p className="text-[10px] text-zinc-600 mt-1">Scouted by {String(pitInfo._scoutedBy)}</p>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-600 text-sm text-center py-4">No pit data.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Match Scout Summary Modal */}
      {scoutTeam !== null && (() => {
        const entries = allMatchScout?.[String(scoutTeam)] ?? []
        const teamName = teams.find(t => t.teamNumber === scoutTeam)?.teamName
        const autoAvg = avg(entries.map(e => e.autoRating))
        const teleopAvg = avg(entries.map(e => e.teleopRating))
        const endgameCounts: Record<string, number> = {}
        for (const e of entries) {
          if (e.endgame) endgameCounts[e.endgame] = (endgameCounts[e.endgame] ?? 0) + 1
        }
        const noteEntries = entries.filter(e => e.notes?.trim())
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setScoutTeam(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm mx-4 overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div>
                  <span className="text-sm font-bold text-zinc-200">Team {scoutTeam}</span>
                  {teamName && <span className="text-xs text-zinc-500 ml-2">{teamName}</span>}
                  <span className="text-xs text-zinc-600 ml-2">{entries.length} match{entries.length !== 1 ? 'es' : ''}</span>
                </div>
                <button
                  onClick={() => setScoutTeam(null)}
                  className="text-zinc-600 hover:text-zinc-300 text-sm px-1 transition-colors"
                >✕</button>
              </div>
              <div className="px-4 py-3 max-h-[70vh] overflow-y-auto flex flex-col gap-4">
                {(autoAvg !== null || teleopAvg !== null) && (
                  <div className="flex gap-6">
                    {autoAvg !== null && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Auto</span>
                        <span className="text-sm font-mono text-sky-400">
                          {autoAvg.toFixed(1)}<span className="text-zinc-600">/5</span>
                        </span>
                      </div>
                    )}
                    {teleopAvg !== null && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Teleop</span>
                        <span className="text-sm font-mono text-purple-400">
                          {teleopAvg.toFixed(1)}<span className="text-zinc-600">/5</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {Object.keys(endgameCounts).length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Endgame</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(endgameCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([eg, count]) => (
                          <span key={eg} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {eg} ×{count}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
                {noteEntries.length > 0 && (
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Notes</span>
                    <div className="flex flex-col gap-3">
                      {noteEntries.map(e => (
                        <div key={e.matchNumber} className="flex gap-3">
                          <span className="text-[10px] font-mono text-sky-500 shrink-0 mt-0.5 w-8">Q{e.matchNumber}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300 leading-relaxed">{e.notes}</p>
                            {e.scoutedBy && <p className="text-[10px] text-zinc-600 mt-0.5">— {e.scoutedBy}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {noteEntries.length === 0 && autoAvg === null && (
                  <p className="text-zinc-600 text-sm text-center py-4">No scouting data yet.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
