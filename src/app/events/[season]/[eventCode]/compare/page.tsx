'use client'

import { use, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import useSWR from 'swr'
import { Shield } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
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
  return [...entries]
    .filter(e => e.notes?.trim())
    .sort((a, b) => new Date(b.scoutedAt).getTime() - new Date(a.scoutedAt).getTime())[0]?.notes ?? null
}

type Winner = 'a' | 'b' | null

function win(a: number | null, b: number | null, lowerBetter = false): Winner {
  if (a === null || b === null || a === b) return null
  return lowerBetter ? (a < b ? 'a' : 'b') : (a > b ? 'a' : 'b')
}

interface CompareRow {
  label: string
  a: string
  b: string
  winner?: Winner
  scoutOnly?: boolean
  isNote?: boolean
  dividerBefore?: boolean
}

export default function ComparePage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const { isScout } = useScoutMode()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamA = searchParams.get('a') ?? ''
  const teamB = searchParams.get('b') ?? ''

  function setTeam(side: 'a' | 'b', value: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(side, value)
    else p.delete(side)
    router.replace(`?${p.toString()}`, { scroll: false })
  }

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
    fetcher
  )

  const schedule = schedData?.schedule ?? []
  const opr = useMemo(() => calculateOPR(schedule), [schedule])

  const teams = useMemo(() => {
    const seen = new Set<string>()
    const result: { number: string; name: string }[] = []
    for (const match of schedule) {
      for (const t of match.teams) {
        const key = String(t.teamNumber)
        if (!seen.has(key)) {
          seen.add(key)
          result.push({ number: key, name: t.teamName })
        }
      }
    }
    return result.sort((a, b) => Number(a.number) - Number(b.number))
  }, [schedule])

  const numA = Number(teamA)
  const numB = Number(teamB)
  const bothSelected = !!teamA && !!teamB

  const oprA = opr[numA]
  const oprB = opr[numB]
  const rankA = rankData?.rankings.find(r => r.teamNumber === numA)
  const rankB = rankData?.rankings.find(r => r.teamNumber === numB)
  const nameA = teams.find(t => t.number === teamA)?.name ?? ''
  const nameB = teams.find(t => t.number === teamB)?.name ?? ''

  const entriesA = allMatchScout?.[teamA] ?? []
  const entriesB = allMatchScout?.[teamB] ?? []
  const avgAutoA = avg(entriesA.map(e => e.autoRating))
  const avgAutoB = avg(entriesB.map(e => e.autoRating))
  const avgTeleopA = avg(entriesA.map(e => e.teleopRating))
  const avgTeleopB = avg(entriesB.map(e => e.teleopRating))
  const avgRatingA = avg([avgAutoA, avgTeleopA])
  const avgRatingB = avg([avgAutoB, avgTeleopB])
  const noteA = latestNote(entriesA)
  const noteB = latestNote(entriesB)

  const rows: CompareRow[] = [
    {
      label: 'Rank',
      a: rankA ? `#${rankA.rank}` : '—',
      b: rankB ? `#${rankB.rank}` : '—',
      winner: win(rankA?.rank ?? null, rankB?.rank ?? null, true),
    },
    {
      label: 'Record',
      a: rankA ? `${rankA.wins}–${rankA.losses}–${rankA.ties}` : '—',
      b: rankB ? `${rankB.wins}–${rankB.losses}–${rankB.ties}` : '—',
      winner: win(rankA?.wins ?? null, rankB?.wins ?? null),
    },
    {
      label: 'nOPR',
      a: oprA ? oprA.nopr.toFixed(1) : '—',
      b: oprB ? oprB.nopr.toFixed(1) : '—',
      winner: win(oprA?.nopr ?? null, oprB?.nopr ?? null),
      dividerBefore: true,
    },
    {
      label: 'OPR',
      a: oprA ? oprA.total.toFixed(1) : '—',
      b: oprB ? oprB.total.toFixed(1) : '—',
      winner: win(oprA?.total ?? null, oprB?.total ?? null),
    },
    {
      label: 'Auto OPR',
      a: oprA ? oprA.auto.toFixed(1) : '—',
      b: oprB ? oprB.auto.toFixed(1) : '—',
      winner: win(oprA?.auto ?? null, oprB?.auto ?? null),
    },
    {
      label: 'Teleop OPR',
      a: oprA ? oprA.teleop.toFixed(1) : '—',
      b: oprB ? oprB.teleop.toFixed(1) : '—',
      winner: win(oprA?.teleop ?? null, oprB?.teleop ?? null),
    },
  ]

  if (isScout) {
    rows.push(
      {
        label: 'Scout Auto',
        a: avgAutoA?.toFixed(1) ?? '—',
        b: avgAutoB?.toFixed(1) ?? '—',
        winner: win(avgAutoA, avgAutoB),
        scoutOnly: true,
        dividerBefore: true,
      },
      {
        label: 'Scout Teleop',
        a: avgTeleopA?.toFixed(1) ?? '—',
        b: avgTeleopB?.toFixed(1) ?? '—',
        winner: win(avgTeleopA, avgTeleopB),
        scoutOnly: true,
      },
      {
        label: 'Avg Rating',
        a: avgRatingA?.toFixed(2) ?? '—',
        b: avgRatingB?.toFixed(2) ?? '—',
        winner: win(avgRatingA, avgRatingB),
        scoutOnly: true,
      },
      {
        label: 'Top Endgame',
        a: topEndgame(entriesA) ?? '—',
        b: topEndgame(entriesB) ?? '—',
        scoutOnly: true,
      },
      {
        label: 'Matches Scouted',
        a: String(entriesA.length),
        b: String(entriesB.length),
        winner: win(entriesA.length, entriesB.length),
        scoutOnly: true,
      },
      {
        label: 'Latest Note',
        a: noteA ?? '—',
        b: noteB ?? '—',
        scoutOnly: true,
        isNote: true,
      },
    )
  }

  // Option text: "#3 · 12345 · Team Name" if rank known, else "12345 · Team Name"
  function optionLabel(t: { number: string; name: string }, side: 'a' | 'b') {
    const rank = rankData?.rankings.find(r => String(r.teamNumber) === t.number)
    const other = side === 'a' ? teamB : teamA
    if (t.number === other) return null // exclude the other selected team
    const prefix = rank ? `#${rank.rank} · ` : ''
    return `${prefix}${t.number} · ${t.name}`
  }

  const selectClass =
    'w-full h-9 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-sky-500 appearance-none'

  return (
    <div className="max-w-2xl">
      {/* Team selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {(['a', 'b'] as const).map(side => (
          <div key={side}>
            <label className="block text-xs text-zinc-500 mb-1">
              Team {side.toUpperCase()}
            </label>
            <select
              value={side === 'a' ? teamA : teamB}
              onChange={e => setTeam(side, e.target.value)}
              className={selectClass}
            >
              <option value="">— select team —</option>
              {teams.map(t => {
                const label = optionLabel(t, side)
                if (!label) return null
                return <option key={t.number} value={t.number}>{label}</option>
              })}
            </select>
          </div>
        ))}
      </div>

      {!bothSelected && (
        <p className="text-center text-zinc-600 text-sm py-16">Select two teams above to compare.</p>
      )}

      {bothSelected && (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <div className="min-w-[420px]">
          {/* Header row */}
          <div className="grid grid-cols-[140px_1fr_1fr] bg-zinc-900 border-b border-zinc-800">
            <div />
            {[
              { num: teamA, name: nameA },
              { num: teamB, name: nameB },
            ].map(({ num, name }) => (
              <div key={num} className="py-3 px-4 border-l border-zinc-800 text-center">
                <Link
                  href={`/events/${season}/${eventCode}/teams/${num}`}
                  className="text-base font-bold text-sky-400 hover:underline"
                >
                  {num}
                </Link>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{name}</p>
              </div>
            ))}
          </div>

          {/* Comparison rows */}
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={[
                'grid grid-cols-[140px_1fr_1fr]',
                row.dividerBefore ? 'border-t-2 border-zinc-700' : 'border-b border-zinc-800',
                row.scoutOnly ? 'bg-green-950/20' : i % 2 === 1 ? 'bg-zinc-900/30' : '',
              ].join(' ')}
            >
              <div className="py-2.5 px-4 flex items-center gap-1.5">
                <span className="text-xs text-zinc-500">{row.label}</span>
                {row.scoutOnly && <Shield className="w-2.5 h-2.5 text-green-600 shrink-0" />}
              </div>
              {(['a', 'b'] as const).map(side => {
                const val = row[side]
                const isWinner = row.winner === side
                return (
                  <div key={side} className="py-2.5 px-4 border-l border-zinc-800 text-center flex items-center justify-center">
                    <span
                      className={[
                        row.isNote ? 'text-xs text-left block truncate max-w-[140px]' : 'text-sm font-mono',
                        isWinner ? 'text-sky-300 font-bold' : 'text-zinc-400',
                        val === '—' ? 'text-zinc-700' : '',
                      ].join(' ')}
                      title={row.isNote ? val : undefined}
                    >
                      {row.isNote && val !== '—'
                        ? val.length > 55 ? val.slice(0, 55) + '…' : val
                        : val}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  )
}
