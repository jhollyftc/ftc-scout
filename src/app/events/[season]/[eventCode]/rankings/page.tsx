'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { calculateOPR } from '@/lib/opr'
import type { RankingsResponse, HybridScheduleResponse } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type SortKey = 'rank' | 'rp' | 'opr' | 'nopr' | 'auto' | 'teleop'

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="w-3 h-3 inline ml-0.5 text-zinc-600" />
  return dir === 'desc'
    ? <ChevronDown className="w-3 h-3 inline ml-0.5 text-sky-400" />
    : <ChevronUp className="w-3 h-3 inline ml-0.5 text-sky-400" />
}

function SortableHeader({
  label,
  col,
  sortKey,
  dir,
  onSort,
  className = '',
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  dir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  className?: string
}) {
  const active = sortKey === col
  return (
    <th
      className={`py-2 px-3 text-xs font-medium cursor-pointer select-none hover:text-zinc-200 transition-colors ${
        active ? 'text-sky-400' : 'text-zinc-500'
      } ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} active={active} dir={dir} />
    </th>
  )
}

export default function RankingsPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const searchParams = useSearchParams()
  const highlightTeam = searchParams.get('team') ? Number(searchParams.get('team')) : null
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: rankData, isLoading: rankLoading } = useSWR<RankingsResponse>(
    `/api/ftc/${season}/rankings/${eventCode}`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const { data: schedData, isLoading: schedLoading } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const isLoading = rankLoading || schedLoading

  if (isLoading)
    return <p className="text-zinc-500 text-sm py-12 text-center">Loading rankings…</p>
  if (!rankData?.rankings?.length)
    return <p className="text-zinc-500 text-sm py-12 text-center">Rankings not available yet.</p>

  const opr = schedData?.schedule ? calculateOPR(schedData.schedule) : {}
  const rankings = rankData.rankings

  const maxNopr = Math.max(...Object.values(opr).map(o => o.nopr), 1)

  function handleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  const sorted = [...rankings].sort((a, b) => {
    let diff = 0
    if (sortKey === 'rank') {
      diff = a.rank - b.rank
    } else if (sortKey === 'rp') {
      diff = a.sortOrder1 - b.sortOrder1
    } else if (sortKey === 'opr') {
      diff = (opr[a.teamNumber]?.total ?? -Infinity) - (opr[b.teamNumber]?.total ?? -Infinity)
    } else if (sortKey === 'nopr') {
      diff = (opr[a.teamNumber]?.nopr ?? -Infinity) - (opr[b.teamNumber]?.nopr ?? -Infinity)
    } else if (sortKey === 'auto') {
      diff = (opr[a.teamNumber]?.auto ?? -Infinity) - (opr[b.teamNumber]?.auto ?? -Infinity)
    } else if (sortKey === 'teleop') {
      diff = (opr[a.teamNumber]?.teleop ?? -Infinity) - (opr[b.teamNumber]?.teleop ?? -Infinity)
    }
    return sortDir === 'asc' ? diff : -diff
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-sm text-zinc-300">Rankings</h2>
        <span className="text-xs text-zinc-500">{rankings.length} teams</span>
      </div>

      <div className="rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <SortableHeader
                label="Rank"
                col="rank"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-left w-16"
              />
              <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Team</th>
              <SortableHeader
                label="RP"
                col="rp"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right"
              />
              <th className="text-center py-2 px-3 text-xs text-zinc-500 font-medium">W-L-T</th>
              <SortableHeader
                label="nOPR"
                col="nopr"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="OPR"
                col="opr"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right hidden sm:table-cell"
              />
              <SortableHeader
                label="Auto OPR"
                col="auto"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right hidden md:table-cell"
              />
              <SortableHeader
                label="Teleop OPR"
                col="teleop"
                sortKey={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right hidden lg:table-cell"
              />
              <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium hidden sm:table-cell">
                Played
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const teamOpr = opr[r.teamNumber]
              const noprBar = teamOpr ? Math.round((teamOpr.nopr / maxNopr) * 100) : 0
              const isHighlighted = highlightTeam !== null && r.teamNumber === highlightTeam
              const isDimmed = highlightTeam !== null && !isHighlighted

              return (
                <tr
                  key={r.teamNumber}
                  className={`border-b border-zinc-800 transition-colors ${
                    isDimmed
                      ? 'opacity-25'
                      : isHighlighted
                      ? 'bg-sky-500/10 border-l-2 border-l-sky-500'
                      : 'hover:bg-zinc-900/60'
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-xs font-bold ${
                        r.rank <= 3 ? 'text-sky-400' : 'text-zinc-400'
                      }`}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Link
                      href={`/events/${season}/${eventCode}/teams/${r.teamNumber}`}
                      className="text-sm font-medium text-zinc-100 hover:text-sky-300 transition-colors"
                    >
                      {r.teamNumber}
                    </Link>
                    <span className="text-xs text-zinc-500 ml-2 hidden sm:inline truncate max-w-32">
                      {r.teamName}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-xs font-mono text-zinc-300">{r.sortOrder1.toFixed(2)}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-xs font-mono text-zinc-400">
                    <span className="text-green-400">{r.wins}</span>
                    <span className="text-zinc-600">-</span>
                    <span className="text-red-400">{r.losses}</span>
                    <span className="text-zinc-600">-</span>
                    <span className="text-zinc-400">{r.ties}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {teamOpr ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 hidden sm:block">
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500/70 rounded-full"
                              style={{ width: `${noprBar}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-mono text-sky-300 w-10 text-right">
                          {teamOpr.nopr.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                    <span className="text-xs font-mono text-zinc-400">
                      {teamOpr ? teamOpr.total.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right hidden md:table-cell">
                    <span className="text-xs font-mono text-zinc-400">
                      {teamOpr ? teamOpr.auto.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right hidden lg:table-cell">
                    <span className="text-xs font-mono text-zinc-400">
                      {teamOpr ? teamOpr.teleop.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                    <span className="text-xs text-zinc-500">{r.matchesPlayed}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-700 mt-2">
        OPR = includes foul pts · nOPR = foul pts removed · Teleop OPR = total − auto − endgame − fouls · RP = sortOrder1 from FTC API · click headers to sort · auto-refreshes every 30s
      </p>
    </div>
  )
}
