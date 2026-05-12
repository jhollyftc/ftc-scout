'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR, type TeamOPR } from '@/lib/opr'
import { getSeasonConfig } from '@/lib/season-config'
import type { HybridScheduleResponse, HybridMatch, RankingsResponse } from '@/lib/ftc-client'
import type { MatchScoutEntry } from '@/app/api/match-scout/[season]/[eventCode]/[matchNumber]/[teamNumber]/route'
import type { MatchScoutEntryWithMatch } from '@/app/api/match-scout/[season]/[eventCode]/route'
import type { PickEntry, PickColumn } from '@/app/api/picklist/[season]/[eventCode]/[listId]/route'
import type { PicklistVisibility } from '@/app/api/picklist/[season]/[eventCode]/visibility/route'
import type { AlliancePick } from '@/app/api/alliance/[season]/[eventCode]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const EMPTY_ENTRY: MatchScoutEntry = {
  autoRating: null,
  teleopRating: null,
  endgame: '',
  notes: '',
  scoutedAt: '',
}

function RatingButtons({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${
            value === n
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function TeamScoutCard({
  team, season, eventCode, matchNumber, color, endgameOptions,
}: {
  team: HybridMatch['teams'][number]
  season: string
  eventCode: string
  matchNumber: number
  color: 'red' | 'blue'
  endgameOptions: string[]
}) {
  const { scoutName } = useScoutMode()
  const { data: saved, mutate } = useSWR<MatchScoutEntry | null>(
    `/api/match-scout/${season}/${eventCode}/${matchNumber}/${team.teamNumber}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const [form, setForm] = useState<MatchScoutEntry>(saved ?? EMPTY_ENTRY)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => { if (saved) setForm(saved) }, [saved])

  function set<K extends keyof MatchScoutEntry>(key: K, value: MatchScoutEntry[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setSavedOk(false)
  }

  async function handleSave() {
    setSaving(true)
    const entry: MatchScoutEntry = {
      ...form,
      scoutedAt: new Date().toISOString(),
      scoutedBy: scoutName ?? 'unknown',
    }
    mutate(entry, { revalidate: false })
    try {
      await fetch(`/api/match-scout/${season}/${eventCode}/${matchNumber}/${team.teamNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      setSavedOk(true)
    } finally {
      setSaving(false)
    }
  }

  const borderColor = color === 'red' ? 'border-red-500/20' : 'border-blue-500/20'
  const headerColor = color === 'red' ? 'text-red-400' : 'text-blue-400'

  return (
    <div className={`rounded-lg border ${borderColor} bg-zinc-900/50 p-3 flex flex-col gap-3`}>
      <div>
        <Link
          href={`/events/${season}/${eventCode}/teams/${team.teamNumber}`}
          className={`text-sm font-bold ${headerColor} hover:underline`}
        >
          {team.teamNumber}
        </Link>
        <p className="text-[10px] text-zinc-500 truncate">{team.teamName}</p>
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Auto (1–5)</p>
        <RatingButtons value={form.autoRating} onChange={v => set('autoRating', v)} />
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Teleop (1–5)</p>
        <RatingButtons value={form.teleopRating} onChange={v => set('teleopRating', v)} />
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Endgame</p>
        <select
          value={form.endgame}
          onChange={e => set('endgame', e.target.value)}
          className="w-full h-7 px-2 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-sky-500 appearance-none"
        >
          <option value="">— select —</option>
          {endgameOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Notes</p>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Observations…"
          rows={2}
          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-7 px-3 text-xs rounded border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {savedOk && <span className="text-[10px] text-green-400">Saved ✓</span>}
        {saved?.scoutedAt && !savedOk && (
          <span className="text-[10px] text-zinc-600">
            {new Date(saved.scoutedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Scout Board ──────────────────────────────────────────────────────────────

type BoardSortKey = 'team' | 'avgAuto' | 'avgTeleop' | 'avgRating' | 'nopr' | 'scouted'

interface BoardRow {
  teamNumber: number
  teamName: string
  avgAuto: number | null
  avgTeleop: number | null
  avgRating: number | null
  nopr: number | null
  topEndgame: string | null
  scouted: number
  latestNote: string | null
}

interface PanelRow {
  label: string
  a: string
  b: string
  winner?: 'a' | 'b' | null
  divider?: boolean
  isNote?: boolean
}

function winSide(a: number | null, b: number | null, lowerBetter = false): 'a' | 'b' | null {
  if (a === null || b === null || a === b) return null
  return lowerBetter ? (a < b ? 'a' : 'b') : (a > b ? 'a' : 'b')
}

function InlineCompare({
  rowA,
  rowB,
  rankData,
  opr,
  season,
  eventCode,
  onClear,
}: {
  rowA: BoardRow
  rowB: BoardRow
  rankData: RankingsResponse | undefined
  opr: Record<number, TeamOPR>
  season: string
  eventCode: string
  onClear: () => void
}) {
  const rankA = rankData?.rankings.find(r => r.teamNumber === rowA.teamNumber)
  const rankB = rankData?.rankings.find(r => r.teamNumber === rowB.teamNumber)
  const oprA = opr[rowA.teamNumber]
  const oprB = opr[rowB.teamNumber]

  const panelRows: PanelRow[] = [
    {
      label: 'Rank',
      a: rankA ? `#${rankA.rank}` : '—',
      b: rankB ? `#${rankB.rank}` : '—',
      winner: winSide(rankA?.rank ?? null, rankB?.rank ?? null, true),
    },
    {
      label: 'Record',
      a: rankA ? `${rankA.wins}–${rankA.losses}–${rankA.ties}` : '—',
      b: rankB ? `${rankB.wins}–${rankB.losses}–${rankB.ties}` : '—',
      winner: winSide(rankA?.wins ?? null, rankB?.wins ?? null),
    },
    {
      label: 'nOPR',
      a: oprA ? oprA.nopr.toFixed(1) : '—',
      b: oprB ? oprB.nopr.toFixed(1) : '—',
      winner: winSide(oprA?.nopr ?? null, oprB?.nopr ?? null),
      divider: true,
    },
    {
      label: 'OPR',
      a: oprA ? oprA.total.toFixed(1) : '—',
      b: oprB ? oprB.total.toFixed(1) : '—',
      winner: winSide(oprA?.total ?? null, oprB?.total ?? null),
    },
    {
      label: 'Auto OPR',
      a: oprA ? oprA.auto.toFixed(1) : '—',
      b: oprB ? oprB.auto.toFixed(1) : '—',
      winner: winSide(oprA?.auto ?? null, oprB?.auto ?? null),
    },
    {
      label: 'Teleop OPR',
      a: oprA ? oprA.teleop.toFixed(1) : '—',
      b: oprB ? oprB.teleop.toFixed(1) : '—',
      winner: winSide(oprA?.teleop ?? null, oprB?.teleop ?? null),
    },
    {
      label: 'Scout Auto',
      a: rowA.avgAuto?.toFixed(1) ?? '—',
      b: rowB.avgAuto?.toFixed(1) ?? '—',
      winner: winSide(rowA.avgAuto, rowB.avgAuto),
      divider: true,
    },
    {
      label: 'Scout Teleop',
      a: rowA.avgTeleop?.toFixed(1) ?? '—',
      b: rowB.avgTeleop?.toFixed(1) ?? '—',
      winner: winSide(rowA.avgTeleop, rowB.avgTeleop),
    },
    {
      label: 'Avg Rating',
      a: rowA.avgRating?.toFixed(2) ?? '—',
      b: rowB.avgRating?.toFixed(2) ?? '—',
      winner: winSide(rowA.avgRating, rowB.avgRating),
    },
    {
      label: 'Endgame',
      a: rowA.topEndgame ?? '—',
      b: rowB.topEndgame ?? '—',
    },
    {
      label: 'Scouted',
      a: String(rowA.scouted),
      b: String(rowB.scouted),
      winner: winSide(rowA.scouted, rowB.scouted),
    },
    {
      label: 'Note',
      a: rowA.latestNote ?? '—',
      b: rowB.latestNote ?? '—',
      isNote: true,
      divider: true,
    },
  ]

  const teamHeaders = [
    { row: rowA, sideLabel: 'A', labelColor: 'text-sky-400' },
    { row: rowB, sideLabel: 'B', labelColor: 'text-amber-400' },
  ]

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-medium">Compare</span>
        <button
          onClick={onClear}
          className="text-zinc-600 hover:text-zinc-300 text-xs px-1 transition-colors"
          aria-label="Clear comparison"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-[76px_1fr_1fr] bg-zinc-900/50 border-b border-zinc-800">
        <div />
        {teamHeaders.map(({ row, sideLabel, labelColor }) => (
          <div key={row.teamNumber} className="py-2 px-2 border-l border-zinc-800 text-center">
            <span className={`text-[9px] font-bold uppercase tracking-wide ${labelColor}`}>{sideLabel}</span>
            <Link
              href={`/events/${season}/${eventCode}/teams/${row.teamNumber}`}
              className="block text-sm font-bold text-zinc-200 hover:text-sky-300 hover:underline transition-colors leading-tight"
            >
              {row.teamNumber}
            </Link>
            <p className="text-[9px] text-zinc-600 truncate">{row.teamName}</p>
          </div>
        ))}
      </div>

      {panelRows.map((row, i) => (
        <div
          key={row.label}
          className={[
            'grid grid-cols-[76px_1fr_1fr]',
            row.divider ? 'border-t-2 border-zinc-700' : 'border-b border-zinc-800',
            i % 2 === 1 ? 'bg-zinc-900/30' : '',
          ].join(' ')}
        >
          <div className="py-2 px-3 flex items-center">
            <span className="text-[10px] text-zinc-600">{row.label}</span>
          </div>
          {(['a', 'b'] as const).map(side => {
            const val = row[side]
            const isWinner = row.winner === side
            return (
              <div key={side} className="py-2 px-2 border-l border-zinc-800 text-center flex items-center justify-center">
                <span
                  className={[
                    row.isNote ? 'text-[10px] text-left block truncate max-w-[90px]' : 'text-xs font-mono',
                    isWinner ? 'text-sky-300 font-bold' : 'text-zinc-400',
                    val === '—' ? 'text-zinc-700' : '',
                  ].join(' ')}
                  title={row.isNote ? val : undefined}
                >
                  {row.isNote && val !== '—'
                    ? val.length > 30 ? val.slice(0, 30) + '…' : val
                    : val}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ScoutBoard({
  season,
  eventCode,
  schedule,
  allMatchScout,
}: {
  season: string
  eventCode: string
  schedule: HybridMatch[]
  allMatchScout: Record<string, MatchScoutEntryWithMatch[]> | undefined
}) {
  const { data: rankData } = useSWR<RankingsResponse>(
    `/api/ftc/${season}/rankings/${eventCode}`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const opr = useMemo(() => calculateOPR(schedule), [schedule])

  const [sortKey, setSortKey] = useState<BoardSortKey>('avgRating')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [compareTeams, setCompareTeams] = useState<string[]>([])
  const [notesTeam, setNotesTeam] = useState<string | null>(null)

  function toggleSort(key: BoardSortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function toggleCompare(key: string) {
    setCompareTeams(prev => {
      if (prev.includes(key)) return prev.filter(t => t !== key)
      if (prev.length < 2) return [...prev, key]
      return [prev[1], key]
    })
  }

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

  const rows = useMemo((): BoardRow[] => {
    return teams.map(team => {
      const key = String(team.teamNumber)
      const entries = allMatchScout?.[key] ?? []

      const autoRatings = entries.map(e => e.autoRating).filter((r): r is number => r !== null)
      const teleopRatings = entries.map(e => e.teleopRating).filter((r): r is number => r !== null)

      const avgAuto = autoRatings.length
        ? autoRatings.reduce((a, b) => a + b, 0) / autoRatings.length
        : null
      const avgTeleop = teleopRatings.length
        ? teleopRatings.reduce((a, b) => a + b, 0) / teleopRatings.length
        : null
      const ratingCount = (avgAuto !== null ? 1 : 0) + (avgTeleop !== null ? 1 : 0)
      const avgRating = ratingCount > 0
        ? ((avgAuto ?? 0) + (avgTeleop ?? 0)) / ratingCount
        : null

      const endgameCounts: Record<string, number> = {}
      for (const e of entries) {
        if (e.endgame && e.endgame !== 'None') {
          endgameCounts[e.endgame] = (endgameCounts[e.endgame] ?? 0) + 1
        }
      }
      const topEndgame = Object.entries(endgameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const nopr = opr[team.teamNumber]?.nopr ?? null
      const latestNote = [...entries]
        .filter(e => e.notes?.trim())
        .sort((a, b) => new Date(b.scoutedAt).getTime() - new Date(a.scoutedAt).getTime())[0]?.notes ?? null

      return {
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        avgAuto,
        avgTeleop,
        avgRating,
        nopr,
        topEndgame,
        scouted: entries.length,
        latestNote,
      }
    })
  }, [teams, allMatchScout, opr])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number, bv: number
      switch (sortKey) {
        case 'team': av = a.teamNumber; bv = b.teamNumber; break
        case 'avgAuto': av = a.avgAuto ?? -1; bv = b.avgAuto ?? -1; break
        case 'avgTeleop': av = a.avgTeleop ?? -1; bv = b.avgTeleop ?? -1; break
        case 'nopr': av = a.nopr ?? -1; bv = b.nopr ?? -1; break
        case 'scouted': av = a.scouted; bv = b.scouted; break
        case 'avgRating': default: av = a.avgRating ?? -1; bv = b.avgRating ?? -1; break
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [rows, sortKey, sortDir])

  const calibration = useMemo(() => {
    const withBoth = rows.filter(r => r.nopr !== null && r.avgRating !== null)
    if (withBoth.length < 4) return {} as Record<number, string | null>
    const threshold = Math.max(3, Math.round(withBoth.length * 0.2))
    const byNopr = [...withBoth].sort((a, b) => (b.nopr ?? 0) - (a.nopr ?? 0))
    const byScout = [...withBoth].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))
    const noprRank = new Map(byNopr.map((r, i) => [r.teamNumber, i + 1]))
    const scoutRank = new Map(byScout.map((r, i) => [r.teamNumber, i + 1]))
    const result: Record<number, string | null> = {}
    for (const row of withBoth) {
      const nr = noprRank.get(row.teamNumber) ?? 0
      const sr = scoutRank.get(row.teamNumber) ?? 0
      result[row.teamNumber] = Math.abs(nr - sr) >= threshold
        ? `Scout avg ranks #${sr}, nOPR ranks #${nr} — consider re-scouting`
        : null
    }
    return result
  }, [rows])

  const compareRowA = compareTeams[0]
    ? rows.find(r => String(r.teamNumber) === compareTeams[0]) ?? null
    : null
  const compareRowB = compareTeams[1]
    ? rows.find(r => String(r.teamNumber) === compareTeams[1]) ?? null
    : null
  const showPanel = compareRowA !== null && compareRowB !== null

  function SortTh({ label, col, className }: { label: string; col: BoardSortKey; className?: string }) {
    const active = sortKey === col
    return (
      <th
        className={`py-2 px-3 text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap ${className ?? ''}`}
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-0.5">
          {label}
          <ArrowUpDown className={`w-3 h-3 shrink-0 ${active ? 'text-sky-400' : 'text-zinc-700'}`} />
        </span>
      </th>
    )
  }

  function Rating({ value }: { value: number | null }) {
    if (value === null) return <span className="text-zinc-700">—</span>
    const color = value >= 4 ? 'text-green-400' : value >= 3 ? 'text-sky-300' : 'text-zinc-400'
    return <span className={`font-mono font-semibold ${color}`}>{value.toFixed(1)}</span>
  }

  if (!allMatchScout) {
    return <p className="text-zinc-500 text-sm py-12 text-center">Loading scout data…</p>
  }

  return (
    <div className={showPanel ? 'lg:flex lg:items-start lg:gap-4' : ''}>
      <div className={showPanel ? 'min-w-0 flex-1' : ''}>
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="py-2 px-2 w-8" />
                <SortTh label="Team" col="team" className="text-left" />
                <SortTh label="Scouted" col="scouted" className="text-right" />
                <SortTh label="Avg Auto" col="avgAuto" className="text-right" />
                <SortTh label="Avg Teleop" col="avgTeleop" className="text-right" />
                <th className="py-2 px-3 text-xs font-medium text-zinc-500 text-left whitespace-nowrap">Endgame</th>
                <SortTh label="Avg Rating" col="avgRating" className="text-right" />
                <SortTh label="nOPR" col="nopr" className="text-right" />
                <th className="py-2 px-3 text-xs font-medium text-zinc-500 text-left">Latest Note</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const key = String(row.teamNumber)
                const isA = compareTeams[0] === key
                const isB = compareTeams[1] === key
                return (
                  <tr
                    key={row.teamNumber}
                    className={[
                      'border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors',
                      isA || isB ? 'bg-zinc-800/40' : '',
                    ].join(' ')}
                  >
                    <td className="py-2.5 px-2 w-8 text-center">
                      <button
                        onClick={() => toggleCompare(key)}
                        aria-label={isA ? 'Remove A from compare' : isB ? 'Remove B from compare' : 'Add to compare'}
                        className={[
                          'w-5 h-5 rounded text-[10px] font-bold border transition-colors',
                          isA
                            ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                            : isB
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'border-zinc-700 text-zinc-700 hover:border-zinc-500 hover:text-zinc-500',
                        ].join(' ')}
                      >
                        {isA ? 'A' : isB ? 'B' : '+'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/events/${season}/${eventCode}/teams/${row.teamNumber}`}
                        className="text-xs font-bold text-sky-400 hover:underline block"
                      >
                        {row.teamNumber}
                      </Link>
                      <span className="text-[10px] text-zinc-600 truncate max-w-[120px] block">{row.teamName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-right font-mono text-zinc-400">
                      {row.scouted > 0 ? row.scouted : <span className="text-zinc-700">0</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <Rating value={row.avgAuto} />
                    </td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <Rating value={row.avgTeleop} />
                    </td>
                    <td className="py-2.5 px-3 text-xs text-zinc-400">
                      {row.topEndgame || <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Rating value={row.avgRating} />
                        {calibration[row.teamNumber] && (
                          <span
                            title={calibration[row.teamNumber]!}
                            className="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-0.5 cursor-help leading-none"
                          >~</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-right font-mono text-zinc-400">
                      {row.nopr !== null ? row.nopr.toFixed(1) : <span className="text-zinc-700">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-zinc-500 max-w-[200px]">
                      {row.latestNote ? (
                        <button
                          onClick={() => setNotesTeam(key)}
                          className="truncate block text-left hover:text-sky-400 transition-colors w-full"
                          title="Click to see all notes"
                        >
                          {row.latestNote.length > 60 ? row.latestNote.slice(0, 60) + '…' : row.latestNote}
                        </button>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-600 text-xs">No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {compareTeams.length === 1 && (
          <p className="text-xs text-zinc-600 mt-2 pl-1">Select one more team to compare.</p>
        )}
      </div>

      {showPanel && (
        <div className="mt-4 lg:mt-0 lg:w-72 shrink-0">
          <InlineCompare
            rowA={compareRowA}
            rowB={compareRowB}
            rankData={rankData}
            opr={opr}
            season={season}
            eventCode={eventCode}
            onClear={() => setCompareTeams([])}
          />
        </div>
      )}

      {notesTeam && (() => {
        const entries = (allMatchScout?.[notesTeam] ?? [])
          .filter(e => e.notes?.trim())
          .sort((a, b) => a.matchNumber - b.matchNumber)
        const teamRow = rows.find(r => String(r.teamNumber) === notesTeam)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setNotesTeam(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div>
                  <span className="text-sm font-bold text-zinc-200">Team {notesTeam}</span>
                  {teamRow && <span className="text-xs text-zinc-500 ml-2">{teamRow.teamName}</span>}
                </div>
                <button
                  onClick={() => setNotesTeam(null)}
                  className="text-zinc-600 hover:text-zinc-300 text-sm px-1 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="px-4 py-3 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
                {entries.length === 0 ? (
                  <p className="text-zinc-600 text-sm text-center py-4">No match notes yet.</p>
                ) : entries.map(e => (
                  <div key={e.matchNumber} className="flex gap-3">
                    <span className="text-[10px] font-mono text-sky-500 shrink-0 mt-0.5 w-8">Q{e.matchNumber}</span>
                    <p className="text-xs text-zinc-300 leading-relaxed">{e.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Pick List Alliance View ────────────────────────────────────────────────────

const PICK_SECTIONS: { col: PickColumn; label: string; border: string; header: string; dot: string }[] = [
  { col: 'tier1', label: 'Tier 1',      border: 'border-sky-500/40',    header: 'bg-sky-500/10 text-sky-300',      dot: 'bg-sky-400' },
  { col: 'tier2', label: 'Tier 2',      border: 'border-purple-500/40', header: 'bg-purple-500/10 text-purple-300', dot: 'bg-purple-400' },
  { col: 'dnp',   label: 'Do Not Pick', border: 'border-red-500/40',    header: 'bg-red-500/10 text-red-400',      dot: 'bg-red-400' },
]

function PickListView({
  season,
  eventCode,
  schedule,
}: {
  season: string
  eventCode: string
  schedule: HybridMatch[]
}) {
  const { isAdmin } = useScoutMode()

  const { data: pickList } = useSWR<PickEntry[] | null>(
    `/api/picklist/${season}/${eventCode}/_primary`,
    fetcher
  )
  const { data: visData, mutate: mutateVis } = useSWR<PicklistVisibility | null>(
    `/api/picklist/${season}/${eventCode}/visibility`,
    fetcher,
    { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const { data: savedStatuses } = useSWR<AlliancePick[] | null>(
    `/api/alliance/${season}/${eventCode}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const teamNames = useMemo((): Record<number, string> => {
    const map: Record<number, string> = {}
    for (const m of schedule) for (const t of m.teams) map[t.teamNumber] = t.teamName
    return map
  }, [schedule])

  const groups = useMemo(() => {
    if (!pickList) return null
    const sorted = [...pickList].sort((a, b) => a.order - b.order)
    return {
      tier1: sorted.filter(e => e.column === 'tier1'),
      tier2: sorted.filter(e => e.column === 'tier2'),
      dnp:   sorted.filter(e => e.column === 'dnp'),
    }
  }, [pickList])

  const [statuses, setStatuses] = useState<Record<number, AlliancePick['status']>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!savedStatuses) return
    const map: Record<number, AlliancePick['status']> = {}
    for (const p of savedStatuses) map[p.teamNumber] = p.status
    setStatuses(map)
  }, [savedStatuses])

  function setStatus(teamNumber: number, status: AlliancePick['status']) {
    const next = { ...statuses, [teamNumber]: status }
    setStatuses(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const payload: AlliancePick[] = Object.entries(next).map(([tn, s], i) => ({
        teamNumber: Number(tn),
        status: s,
        priority: i,
      }))
      fetch(`/api/alliance/${season}/${eventCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }, 600)
  }

  const visible = visData?.visible ?? false

  async function toggleVisibility() {
    const next = !visible
    // revalidate:false keeps the optimistic value even when the component
    // remounts (tab switch). Blob has eventual consistency so we never
    // refetch after this write — the cache is authoritative until page reload.
    mutateVis({ visible: next }, { revalidate: false })
    await fetch(`/api/picklist/${season}/${eventCode}/visibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: next }),
    })
  }

  if (!isAdmin && !visible) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-400 text-sm">Pick list not yet shared.</p>
        <p className="text-zinc-600 text-xs mt-1">Admin will reveal it before alliance selection.</p>
      </div>
    )
  }

  if (pickList === undefined || groups === null) {
    return <p className="text-zinc-500 text-sm py-12 text-center">Loading…</p>
  }

  const isEmpty = groups.tier1.length === 0 && groups.tier2.length === 0 && groups.dnp.length === 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Alliance Pick List</h2>
        {isAdmin && (
          <button
            onClick={toggleVisibility}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              visible
                ? 'bg-green-900/40 border-green-600/50 text-green-400 hover:bg-green-900/60'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            {visible ? 'Visible to scouts' : 'Hidden from scouts'}
          </button>
        )}
      </div>

      {isEmpty ? (
        <p className="text-zinc-500 text-sm text-center py-8">
          Pick list is empty — assign teams in the Pick List tab first.
        </p>
      ) : (
        <div className="space-y-4">
          {PICK_SECTIONS.map(({ col, label, border, header, dot }) => {
            const entries = groups[col as 'tier1' | 'tier2' | 'dnp']
            if (entries.length === 0) return null
            return (
              <div key={col} className={`rounded-lg border ${border} overflow-hidden`}>
                <div className={`px-3 py-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${header}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  {label}
                </div>
                {entries.map((entry, idx) => {
                  const status = statuses[entry.teamNumber] ?? 'available'
                  const inactive = status !== 'available'
                  return (
                    <div
                      key={entry.teamNumber}
                      className={`flex items-center gap-3 px-3 py-2 border-t border-zinc-800/60 transition-opacity ${inactive ? 'opacity-40' : ''}`}
                    >
                      <span className="text-[10px] font-mono text-zinc-600 w-5 text-right shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Link
                          href={`/events/${season}/${eventCode}/teams/${entry.teamNumber}`}
                          className="text-xs font-bold text-zinc-100 hover:text-sky-400 transition-colors shrink-0"
                        >
                          {entry.teamNumber}
                        </Link>
                        <span className="text-[10px] text-zinc-500 truncate">{teamNames[entry.teamNumber]}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {inactive ? (
                          <>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                              status === 'taken'
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            }`}>
                              {status === 'taken' ? 'Taken' : 'Declined'}
                            </span>
                            <button
                              onClick={() => setStatus(entry.teamNumber, 'available')}
                              className="h-6 px-2 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Restore
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setStatus(entry.teamNumber, 'taken')}
                              className="h-6 px-2 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            >
                              Taken
                            </button>
                            <button
                              onClick={() => setStatus(entry.teamNumber, 'declined')}
                              className="h-6 px-2 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                            >
                              Declined
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ScoutPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const { isScout } = useScoutMode()
  const searchParams = useSearchParams()
  const matchParam = searchParams.get('match') ? Number(searchParams.get('match')) : null

  const { data, isLoading } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const { data: allMatchScout } = useSWR<Record<string, MatchScoutEntryWithMatch[]>>(
    `/api/match-scout/${season}/${eventCode}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const config = getSeasonConfig(season)
  const schedule = data?.schedule ?? []
  const nextMatchNumber = schedule.find(m => m.scoreRedFinal === null)?.matchNumber ?? schedule[0]?.matchNumber ?? 1
  const [selectedMatch, setSelectedMatch] = useState<number | null>(matchParam)
  const [view, setView] = useState<'match' | 'board' | 'alliance'>('match')

  useEffect(() => {
    if (selectedMatch === null && nextMatchNumber) setSelectedMatch(nextMatchNumber)
  }, [nextMatchNumber, selectedMatch])

  if (!isScout) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-500 text-sm">Scout mode required.</p>
        <p className="text-zinc-600 text-xs mt-1">Log in on the main page to unlock.</p>
      </div>
    )
  }

  if (isLoading) return <p className="text-zinc-500 text-sm py-12 text-center">Loading schedule…</p>
  if (!schedule.length) return <p className="text-zinc-500 text-sm py-12 text-center">No matches scheduled yet.</p>

  return (
    <div className={view === 'board' ? '' : 'max-w-4xl'}>
      {/* View toggle */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        {(['match', 'board', 'alliance'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {v === 'match' ? 'Match Scout' : v === 'board' ? 'Scout Board' : 'Alliance'}
          </button>
        ))}
      </div>

      {view === 'alliance' ? (
        <PickListView season={season} eventCode={eventCode} schedule={schedule} />
      ) : view === 'board' ? (
        <ScoutBoard season={season} eventCode={eventCode} schedule={schedule} allMatchScout={allMatchScout} />
      ) : (
        <>
          {/* Match picker */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => {
                const currentIdx = schedule.findIndex(m => m.matchNumber === selectedMatch)
                const prev = currentIdx > 0 ? schedule[currentIdx - 1] : null
                if (prev) setSelectedMatch(prev.matchNumber)
              }}
              disabled={schedule.findIndex(m => m.matchNumber === selectedMatch) <= 0}
              className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex-1">
              <select
                value={selectedMatch ?? ''}
                onChange={e => setSelectedMatch(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-sky-500 appearance-none"
              >
                {schedule.map(m => {
                  const done = m.scoreRedFinal !== null
                  const isNext = m.matchNumber === nextMatchNumber && !done
                  const scoutedInMatch = allMatchScout
                    ? m.teams.filter(t =>
                        (allMatchScout[String(t.teamNumber)] ?? []).some(e => e.matchNumber === m.matchNumber)
                      ).length
                    : null
                  const countLabel = scoutedInMatch !== null ? ` · ${scoutedInMatch}/${m.teams.length}` : ''
                  return (
                    <option key={m.matchNumber} value={m.matchNumber}>
                      Q{m.matchNumber}{isNext ? ' — Next' : done ? ' ✓' : ''}{countLabel}
                    </option>
                  )
                })}
              </select>
            </div>

            <button
              onClick={() => {
                const currentIdx = schedule.findIndex(m => m.matchNumber === selectedMatch)
                const next = currentIdx < schedule.length - 1 ? schedule[currentIdx + 1] : null
                if (next) setSelectedMatch(next.matchNumber)
              }}
              disabled={schedule.findIndex(m => m.matchNumber === selectedMatch) >= schedule.length - 1}
              className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Completeness strip */}
          {(() => {
            const match = schedule.find(m => m.matchNumber === selectedMatch)
            if (!match || !allMatchScout) return null
            const red = match.teams.filter(t => t.station.startsWith('Red'))
            const blue = match.teams.filter(t => t.station.startsWith('Blue'))
            const allTeams = [...red, ...blue]
            const scoutedCount = allTeams.filter(t =>
              (allMatchScout[String(t.teamNumber)] ?? []).some(e => e.matchNumber === selectedMatch)
            ).length
            return (
              <div className="flex items-center gap-1.5 mb-4">
                {red.map(t => {
                  const scouted = (allMatchScout[String(t.teamNumber)] ?? []).some(e => e.matchNumber === selectedMatch)
                  return (
                    <span
                      key={t.teamNumber}
                      title={`${t.teamNumber} · ${t.teamName}${scouted ? ' — scouted ✓' : ' — not yet scouted'}`}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                        scouted
                          ? 'bg-red-500/20 border-red-500/30 text-red-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-600'
                      }`}
                    >
                      {t.teamNumber}
                    </span>
                  )
                })}
                <span className="text-zinc-700 text-xs mx-0.5">·</span>
                {blue.map(t => {
                  const scouted = (allMatchScout[String(t.teamNumber)] ?? []).some(e => e.matchNumber === selectedMatch)
                  return (
                    <span
                      key={t.teamNumber}
                      title={`${t.teamNumber} · ${t.teamName}${scouted ? ' — scouted ✓' : ' — not yet scouted'}`}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                        scouted
                          ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-600'
                      }`}
                    >
                      {t.teamNumber}
                    </span>
                  )
                })}
                <span className="text-[10px] text-zinc-600 ml-1">{scoutedCount}/{allTeams.length}</span>
              </div>
            )
          })()}

          {/* Match status */}
          {(() => {
            const match = schedule.find(m => m.matchNumber === selectedMatch)
            const isDone = match?.scoreRedFinal !== null
            const red = match?.teams.filter(t => t.station.startsWith('Red')) ?? []
            const blue = match?.teams.filter(t => t.station.startsWith('Blue')) ?? []

            return (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <span className="text-xs text-zinc-500">
                        Final: <span className="text-red-400 font-mono font-bold">{match?.scoreRedFinal}</span>
                        <span className="text-zinc-700 mx-1">–</span>
                        <span className="text-blue-400 font-mono font-bold">{match?.scoreBlueFinal}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500">Pending</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-700 italic">Fields will update for BioBuzz season</span>
                </div>

                {match && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-red-500">Red Alliance</p>
                      {red.map(t => (
                        <TeamScoutCard
                          key={t.teamNumber}
                          team={t}
                          season={season}
                          eventCode={eventCode}
                          matchNumber={match.matchNumber}
                          color="red"
                          endgameOptions={config.endgameOptions}
                        />
                      ))}
                    </div>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-semibold text-blue-500">Blue Alliance</p>
                      {blue.map(t => (
                        <TeamScoutCard
                          key={t.teamNumber}
                          team={t}
                          season={season}
                          eventCode={eventCode}
                          matchNumber={match.matchNumber}
                          color="blue"
                          endgameOptions={config.endgameOptions}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}
