'use client'

import { use, useMemo } from 'react'
import useSWR from 'swr'
import { Shield } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
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
  const { data: allPitData } = useSWR<Record<string, unknown>>(
    isScout ? `/api/pit/${season}/${eventCode}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

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

  const pitLoaded = !!allPitData
  const matchLoaded = !!allMatchScout

  // scout summary counts
  const pitCount = isScout && pitLoaded ? Object.keys(allPitData!).length : null
  const scoutedCount =
    isScout && matchLoaded
      ? Object.values(allMatchScout!).filter(e => e.length > 0).length
      : null

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
        {scoutedCount !== null && (
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-green-700" />
            {scoutedCount}/{teams.length} match scouted
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

              {rankInfo ? (
                <span className="text-xs text-zinc-500 font-mono shrink-0">#{rankInfo.rank}</span>
              ) : (
                <span className="text-xs text-zinc-700 font-mono shrink-0">—</span>
              )}

              {isScout && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasPit !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        hasPit
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-zinc-800 text-zinc-600'
                      }`}
                    >
                      Pit{hasPit ? ' ✓' : ''}
                    </span>
                  )}
                  {entries.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-900/30 text-sky-400 font-medium flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" />
                      {entries.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
