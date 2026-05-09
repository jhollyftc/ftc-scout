'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import type { HybridScheduleResponse, HybridMatch } from '@/lib/ftc-client'
import type { MatchScoutEntry } from '@/app/api/match-scout/[season]/[eventCode]/[matchNumber]/[teamNumber]/route'
import type { PitScoutingData } from '@/app/api/pit/[season]/[eventCode]/[teamNumber]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const EMPTY_ENTRY: MatchScoutEntry = {
  autoRating: null,
  teleopRating: null,
  endgame: '',
  notes: '',
  scoutedAt: '',
}

const ENDGAME_OPTIONS = ['None', 'Park', 'Low Hang', 'High Hang']

function RatingButtons({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${
            value === n
              ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
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
  team, season, eventCode, matchNumber, color,
}: {
  team: HybridMatch['teams'][number]
  season: string
  eventCode: string
  matchNumber: number
  color: 'red' | 'blue'
}) {
  const { data: saved, mutate } = useSWR<MatchScoutEntry | null>(
    `/api/match-scout/${season}/${eventCode}/${matchNumber}/${team.teamNumber}`,
    fetcher,
    { fallbackData: null }
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
    const entry: MatchScoutEntry = { ...form, scoutedAt: new Date().toISOString() }
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
      {/* Team header */}
      <div>
        <Link
          href={`/events/${season}/${eventCode}/teams/${team.teamNumber}`}
          className={`text-sm font-bold ${headerColor} hover:underline`}
        >
          {team.teamNumber}
        </Link>
        <p className="text-[10px] text-zinc-500 truncate">{team.teamName}</p>
      </div>

      {/* Auto */}
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Auto (1–5)</p>
        <RatingButtons value={form.autoRating} onChange={v => set('autoRating', v)} />
      </div>

      {/* Teleop */}
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Teleop (1–5)</p>
        <RatingButtons value={form.teleopRating} onChange={v => set('teleopRating', v)} />
      </div>

      {/* Endgame */}
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Endgame</p>
        <select
          value={form.endgame}
          onChange={e => set('endgame', e.target.value)}
          className="w-full h-7 px-2 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-orange-500 appearance-none"
        >
          <option value="">— select —</option>
          {ENDGAME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <p className="text-[10px] text-zinc-500 mb-1">Notes</p>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Observations…"
          rows={2}
          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-7 px-3 text-xs rounded border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-40"
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

type BoardSortKey = 'team' | 'avgAuto' | 'avgTeleop' | 'avgRating' | 'scouted'

function ScoutBoard({
  season,
  eventCode,
  schedule,
}: {
  season: string
  eventCode: string
  schedule: HybridMatch[]
}) {
  const { data: allMatchScout } = useSWR<Record<string, MatchScoutEntry[]>>(
    `/api/match-scout/${season}/${eventCode}`,
    fetcher
  )
  const { data: allPitData } = useSWR<Record<string, PitScoutingData>>(
    `/api/pit/${season}/${eventCode}`,
    fetcher
  )

  const [sortKey, setSortKey] = useState<BoardSortKey>('avgRating')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: BoardSortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
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

  const rows = useMemo(() => {
    return teams.map(team => {
      const key = String(team.teamNumber)
      const entries = allMatchScout?.[key] ?? []
      const pit = allPitData?.[key] ?? null

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

      const latestNote = entries
        .filter(e => e.notes?.trim())
        .sort((a, b) => new Date(b.scoutedAt).getTime() - new Date(a.scoutedAt).getTime())[0]?.notes ?? null

      return {
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        drivetrain: pit?.drivetrain ?? null,
        avgAuto,
        avgTeleop,
        avgRating,
        topEndgame,
        scouted: entries.length,
        latestNote,
      }
    })
  }, [teams, allMatchScout, allPitData])

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: number, bv: number
      switch (sortKey) {
        case 'team': av = a.teamNumber; bv = b.teamNumber; break
        case 'avgAuto': av = a.avgAuto ?? -1; bv = b.avgAuto ?? -1; break
        case 'avgTeleop': av = a.avgTeleop ?? -1; bv = b.avgTeleop ?? -1; break
        case 'scouted': av = a.scouted; bv = b.scouted; break
        case 'avgRating': default: av = a.avgRating ?? -1; bv = b.avgRating ?? -1; break
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [rows, sortKey, sortDir])

  function SortTh({ label, col, className }: { label: string; col: BoardSortKey; className?: string }) {
    const active = sortKey === col
    return (
      <th
        className={`py-2 px-3 text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300 select-none whitespace-nowrap ${className ?? ''}`}
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-0.5">
          {label}
          <ArrowUpDown className={`w-3 h-3 shrink-0 ${active ? 'text-orange-400' : 'text-zinc-700'}`} />
        </span>
      </th>
    )
  }

  function Rating({ value }: { value: number | null }) {
    if (value === null) return <span className="text-zinc-700">—</span>
    const color = value >= 4 ? 'text-green-400' : value >= 3 ? 'text-orange-300' : 'text-zinc-400'
    return <span className={`font-mono font-semibold ${color}`}>{value.toFixed(1)}</span>
  }

  if (!allMatchScout) {
    return <p className="text-zinc-500 text-sm py-12 text-center">Loading scout data…</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
            <SortTh label="Team" col="team" className="text-left" />
            <th className="py-2 px-3 text-xs font-medium text-zinc-500 text-left whitespace-nowrap">Drivetrain</th>
            <SortTh label="Avg Auto" col="avgAuto" className="text-right" />
            <SortTh label="Avg Teleop" col="avgTeleop" className="text-right" />
            <th className="py-2 px-3 text-xs font-medium text-zinc-500 text-left whitespace-nowrap">Endgame</th>
            <SortTh label="Scouted" col="scouted" className="text-right" />
            <SortTh label="Avg Rating" col="avgRating" className="text-right" />
            <th className="py-2 px-3 text-xs font-medium text-zinc-500 text-left">Latest Note</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.teamNumber} className="border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors">
              <td className="py-2.5 px-3">
                <Link
                  href={`/events/${season}/${eventCode}/teams/${row.teamNumber}`}
                  className="text-xs font-bold text-orange-400 hover:underline block"
                >
                  {row.teamNumber}
                </Link>
                <span className="text-[10px] text-zinc-600 truncate max-w-[120px] block">{row.teamName}</span>
              </td>
              <td className="py-2.5 px-3 text-xs text-zinc-400">
                {row.drivetrain || <span className="text-zinc-700">—</span>}
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
              <td className="py-2.5 px-3 text-xs text-right font-mono text-zinc-400">
                {row.scouted || <span className="text-zinc-700">0</span>}
              </td>
              <td className="py-2.5 px-3 text-xs text-right">
                <Rating value={row.avgRating} />
              </td>
              <td className="py-2.5 px-3 text-xs text-zinc-500 max-w-[200px]">
                {row.latestNote ? (
                  <span className="truncate block" title={row.latestNote}>
                    {row.latestNote.length > 60 ? row.latestNote.slice(0, 60) + '…' : row.latestNote}
                  </span>
                ) : (
                  <span className="text-zinc-700">—</span>
                )}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="py-12 text-center text-zinc-600 text-xs">No teams found.</td>
            </tr>
          )}
        </tbody>
      </table>
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

  const { data, isLoading } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const schedule = data?.schedule ?? []
  const nextMatchNumber = schedule.find(m => m.scoreRedFinal === null)?.matchNumber ?? schedule[0]?.matchNumber ?? 1
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null)
  const [view, setView] = useState<'match' | 'board'>('match')

  useEffect(() => {
    if (selectedMatch === null && nextMatchNumber) setSelectedMatch(nextMatchNumber)
  }, [nextMatchNumber, selectedMatch])

  if (!isScout) {
    return (
      <div className="py-16 text-center">
        <p className="text-zinc-500 text-sm">Scout mode required.</p>
        <p className="text-zinc-600 text-xs mt-1">Enter your PIN on the main page to unlock.</p>
      </div>
    )
  }

  if (isLoading) return <p className="text-zinc-500 text-sm py-12 text-center">Loading schedule…</p>
  if (!schedule.length) return <p className="text-zinc-500 text-sm py-12 text-center">No matches scheduled yet.</p>

  return (
    <div className="max-w-4xl">
      {/* View toggle */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setView('match')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === 'match'
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Match Scout
        </button>
        <button
          onClick={() => setView('board')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === 'board'
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Scout Board
        </button>
      </div>

      {view === 'board' ? (
        <ScoutBoard season={season} eventCode={eventCode} schedule={schedule} />
      ) : (
        <>
          {/* Match picker */}
          <div className="flex items-center gap-3 mb-6">
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
                className="w-full h-9 px-3 text-sm rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-orange-500 appearance-none"
              >
                {schedule.map(m => {
                  const done = m.scoreRedFinal !== null
                  const isNext = m.matchNumber === nextMatchNumber && !done
                  return (
                    <option key={m.matchNumber} value={m.matchNumber}>
                      Q{m.matchNumber}{isNext ? ' — Next' : done ? ' ✓' : ''}
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
