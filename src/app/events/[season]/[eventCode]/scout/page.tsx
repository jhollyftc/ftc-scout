'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import type { HybridScheduleResponse, HybridMatch } from '@/lib/ftc-client'
import type { MatchScoutEntry } from '@/app/api/match-scout/[season]/[eventCode]/[matchNumber]/[teamNumber]/route'

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

  const match = schedule.find(m => m.matchNumber === selectedMatch)
  const red = match?.teams.filter(t => t.station.startsWith('Red')) ?? []
  const blue = match?.teams.filter(t => t.station.startsWith('Blue')) ?? []

  const currentIdx = schedule.findIndex(m => m.matchNumber === selectedMatch)
  const prevMatch = currentIdx > 0 ? schedule[currentIdx - 1] : null
  const nextMatch = currentIdx < schedule.length - 1 ? schedule[currentIdx + 1] : null
  const isDone = match?.scoreRedFinal !== null

  return (
    <div className="max-w-3xl">
      {/* Match picker */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => prevMatch && setSelectedMatch(prevMatch.matchNumber)}
          disabled={!prevMatch}
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
          onClick={() => nextMatch && setSelectedMatch(nextMatch.matchNumber)}
          disabled={!nextMatch}
          className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Status / note */}
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

      {/* Alliance columns */}
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
    </div>
  )
}
