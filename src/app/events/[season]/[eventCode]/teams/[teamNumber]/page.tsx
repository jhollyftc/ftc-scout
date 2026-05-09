'use client'

import { use, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, Upload, ExternalLink, X, ZoomIn, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
import { getSeasonConfig } from '@/lib/season-config'
import type { PitField } from '@/lib/season-config'
import type { TeamsResponse, HybridScheduleResponse, EventsResponse } from '@/lib/ftc-client'
import type { Note } from '@/app/api/notes/[season]/[eventCode]/[teamNumber]/route'
import type { PitScoutingData } from '@/app/api/pit/[season]/[eventCode]/[teamNumber]/route'
import type { PhotosResponse } from '@/app/api/photos/[season]/[eventCode]/[teamNumber]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function TeamProfilePage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string; teamNumber: string }>
}) {
  const { season, eventCode, teamNumber } = use(params)
  const teamNum = Number(teamNumber)
  const { isScout } = useScoutMode()

  const { data: teamData } = useSWR<TeamsResponse>(
    `/api/ftc/${season}/teams?teamNumber=${teamNumber}`,
    fetcher
  )

  const { data: schedData } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 30_000 }
  )

  const { data: photoData, mutate: mutatePhoto } = useSWR<PhotosResponse>(
    `/api/photos/${season}/${eventCode}/${teamNumber}`,
    fetcher
  )

  const { data: eventsData } = useSWR<EventsResponse>(
    `/api/ftc/${season}/events?teamNumber=${teamNumber}`,
    fetcher
  )

  const [showAllNotes, setShowAllNotes] = useState(false)

  const { data: pitData, mutate: mutatePit } = useSWR<PitScoutingData | null>(
    isScout ? `/api/pit/${season}/${eventCode}/${teamNumber}` : null,
    fetcher,
    { fallbackData: null }
  )

  const { data: eventNotes, mutate: mutateNotes } = useSWR<Note[]>(
    isScout ? `/api/notes/${season}/${eventCode}/${teamNumber}` : null,
    fetcher,
    { fallbackData: [] }
  )

  const { data: allSeasonNotes } = useSWR<{ eventCode: string; notes: Note[] }[]>(
    isScout && showAllNotes ? `/api/notes/season/${season}/${teamNumber}` : null,
    fetcher,
    { fallbackData: [] }
  )

  const team = teamData?.teams[0]
  const schedule = schedData?.schedule ?? []
  const opr = calculateOPR(schedule)
  const teamOpr = opr[teamNum]

  const myMatches = schedule
    .filter(m => m.teams.some(t => t.teamNumber === teamNum))
    .sort((a, b) => a.matchNumber - b.matchNumber)

  const wlt = myMatches.reduce(
    (acc, m) => {
      const onRed = m.teams.find(t => t.teamNumber === teamNum)?.station.startsWith('Red')
      const done = m.scoreRedFinal !== null
      if (!done) return acc
      const won = onRed ? m.redWins : m.blueWins
      const lost = onRed ? m.blueWins : m.redWins
      return {
        w: acc.w + (won ? 1 : 0),
        l: acc.l + (lost ? 1 : 0),
        t: acc.t + (!won && !lost ? 1 : 0),
      }
    },
    { w: 0, l: 0, t: 0 }
  )

  return (
    <div className="max-w-4xl">
      {/* Team header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-zinc-100">{teamNumber}</h2>
          {team && <span className="text-zinc-400 text-lg">{team.nameShort}</span>}
        </div>
        {team && (
          <p className="text-zinc-500 text-sm mt-1">
            {[team.schoolName, team.city, team.stateProv, team.country !== 'US' ? team.country : null]
              .filter(Boolean)
              .join(' · ')}
            {team.rookieYear ? ` · Rookie ${team.rookieYear}` : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Left column: photo */}
        <div className="flex flex-col gap-3">
          <RobotPhoto
            url={photoData?.url ?? null}
            history={photoData?.history ?? []}
            currentEventCode={eventCode}
            season={season}
            eventCode={eventCode}
            teamNumber={teamNumber}
            onUploaded={() => mutatePhoto()}
            isScout={isScout}
            getEventName={(code) => eventsData?.events.find(e => e.code === code)?.name ?? code}
          />
          <a
            href={`https://ftcscout.org/teams/${teamNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
          >
            <ExternalLink className="w-3 h-3" />
            View on FTC Scout
          </a>
        </div>

        {/* Right column: stats + match history */}
        <div className="flex flex-col gap-5">
          {/* OPR stats */}
          {teamOpr && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="nOPR" value={teamOpr.nopr.toFixed(1)} accent />
              <Stat label="OPR" value={teamOpr.total.toFixed(1)} />
              <Stat label="Auto OPR" value={teamOpr.auto.toFixed(1)} />
              <Stat label="Teleop OPR" value={teamOpr.teleop.toFixed(1)} />
            </div>
          )}

          {/* W-L-T */}
          {myMatches.some(m => m.scoreRedFinal !== null) && (
            <div className="flex gap-4">
              <Stat label="Wins" value={String(wlt.w)} accent />
              <Stat label="Losses" value={String(wlt.l)} />
              <Stat label="Ties" value={String(wlt.t)} />
            </div>
          )}

          {/* Pit scouting */}
          {isScout && (
            <PitScoutingForm
              season={season}
              eventCode={eventCode}
              teamNumber={teamNumber}
              saved={pitData ?? null}
              onSave={(data) => mutatePit(data, { revalidate: false })}
            />
          )}

          {/* Scout notes */}
          {isScout && (
            <ScoutNotes
              season={season}
              eventCode={eventCode}
              teamNumber={teamNumber}
              notes={eventNotes ?? []}
              allSeasonNotes={allSeasonNotes ?? []}
              showAllNotes={showAllNotes}
              onToggleAll={() => setShowAllNotes(v => !v)}
              eventsData={eventsData}
              onMutate={(data?: Note[]) => mutateNotes(data, { revalidate: false })}
            />
          )}

          {/* Match history */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Match History
            </h3>
            {myMatches.length === 0 ? (
              <p className="text-zinc-600 text-sm">No matches scheduled yet.</p>
            ) : (
              <div className="rounded-lg border border-zinc-800 overflow-hidden overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium w-14">Match</th>
                      <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium w-12">Side</th>
                      <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Partners</th>
                      <th className="text-left py-2 px-3 text-xs text-zinc-500 font-medium">Opponents</th>
                      <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium whitespace-nowrap">Score</th>
                      <th className="text-right py-2 px-3 text-xs text-zinc-500 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {myMatches.map(m => {
                      const myTeam = m.teams.find(t => t.teamNumber === teamNum)!
                      const onRed = myTeam.station.startsWith('Red')
                      const partners = m.teams.filter(
                        t => t.teamNumber !== teamNum && t.station.startsWith(onRed ? 'Red' : 'Blue')
                      )
                      const opponents = m.teams.filter(
                        t => t.station.startsWith(onRed ? 'Blue' : 'Red')
                      )
                      const done = m.scoreRedFinal !== null
                      const myScore = done ? (onRed ? m.scoreRedFinal : m.scoreBlueFinal) : null
                      const oppScore = done ? (onRed ? m.scoreBlueFinal : m.scoreRedFinal) : null
                      const won = done && (onRed ? m.redWins : m.blueWins)
                      const lost = done && (onRed ? m.blueWins : m.redWins)
                      const allyColor = onRed ? 'text-red-400' : 'text-blue-400'
                      const oppColor = onRed ? 'text-blue-400' : 'text-red-400'

                      return (
                        <tr key={m.matchNumber} className="border-b border-zinc-800 hover:bg-zinc-900/60 transition-colors">
                          <td className="py-2.5 px-3 text-xs font-mono text-zinc-500">
                            {isScout ? (
                              <Link
                                href={`/events/${season}/${eventCode}/scout?match=${m.matchNumber}`}
                                className="hover:text-sky-400 transition-colors"
                              >
                                Q{m.matchNumber}
                              </Link>
                            ) : (
                              <>Q{m.matchNumber}</>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-xs font-medium ${allyColor}`}>
                              {onRed ? 'Red' : 'Blue'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="grid grid-cols-2 gap-x-4">
                              {partners.map(t => (
                                <Link
                                  key={t.teamNumber}
                                  href={`/events/${season}/${eventCode}/teams/${t.teamNumber}`}
                                  className={`group min-w-0 ${allyColor}`}
                                >
                                  <span className="text-xs font-medium group-hover:underline block">{t.teamNumber}</span>
                                  <span className="text-[10px] text-zinc-600 block truncate">{t.teamName}</span>
                                </Link>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="grid grid-cols-2 gap-x-4">
                              {opponents.map(t => (
                                <Link
                                  key={t.teamNumber}
                                  href={`/events/${season}/${eventCode}/teams/${t.teamNumber}`}
                                  className={`group min-w-0 ${oppColor}`}
                                >
                                  <span className="text-xs font-medium group-hover:underline block">{t.teamNumber}</span>
                                  <span className="text-[10px] text-zinc-600 block truncate">{t.teamName}</span>
                                </Link>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {done ? (
                              <span className="text-xs font-mono">
                                <span className={won ? `font-bold ${allyColor}` : 'text-zinc-400'}>{myScore}</span>
                                <span className="text-zinc-700 mx-1">–</span>
                                <span className={lost ? `font-bold ${oppColor}` : 'text-zinc-400'}>{oppScore}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-700">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {done ? (
                              <span className={`text-xs font-semibold ${
                                won ? 'text-green-400' : lost ? 'text-red-400' : 'text-zinc-500'
                              }`}>
                                {won ? 'W' : lost ? 'L' : 'T'}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-700">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Season events */}
          {eventsData?.events && eventsData.events.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Events This Season
              </h3>
              <div className="flex flex-col gap-1.5">
                {eventsData.events
                  .filter(e => e.published)
                  .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())
                  .map(e => {
                    const isCurrent = e.code === eventCode
                    return (
                      <Link
                        key={e.code}
                        href={`/events/${season}/${e.code}/teams/${teamNumber}`}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition-colors ${
                          isCurrent
                            ? 'border-sky-500/30 bg-sky-500/5 text-zinc-300'
                            : 'border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="text-zinc-600 font-mono shrink-0">
                          {new Date(e.dateStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </Link>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Pit Scouting Form ────────────────────────────────────────────────────────

function PitScoutingForm({
  season, eventCode, teamNumber, saved, onSave,
}: {
  season: string
  eventCode: string
  teamNumber: string
  saved: PitScoutingData | null
  onSave: (data: PitScoutingData) => void
}) {
  const config = getSeasonConfig(season)
  const { pitFields } = config

  function emptyForm(): PitScoutingData {
    return Object.fromEntries(pitFields.map(f => [f.key, f.type === 'rating' ? null : '']))
  }

  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState<PitScoutingData>(saved ?? emptyForm())
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => { if (saved) setForm(saved) }, [saved])

  function setField(key: string, value: string | number | null) {
    setForm(f => ({ ...f, [key]: value }))
    setSavedOk(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/pit/${season}/${eventCode}/${teamNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      onSave(form)
      setSavedOk(true)
      setExpanded(false)
    } finally {
      setSaving(false)
    }
  }

  const hasSavedData = saved && Object.values(saved).some(v => v !== null && v !== '')

  const selectClass = 'w-full h-8 px-2 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-sky-500 appearance-none'
  const textareaClass = 'w-full px-2.5 py-2 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500 resize-none'
  const numberClass = 'w-full h-8 px-2.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pit Scouting</h3>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsed summary */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-left hover:border-zinc-600 transition-colors"
        >
          {hasSavedData ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              {pitFields.map(field => {
                const value = form[field.key]
                if (value === null || value === '') return null
                const display = field.key === 'notes'
                  ? String(value).slice(0, 50) + (String(value).length > 50 ? '…' : '')
                  : field.type === 'rating'
                  ? `${field.label}: ${value}/5`
                  : String(value)
                return (
                  <span
                    key={field.key}
                    className={`text-[10px] rounded px-1.5 py-0.5 ${
                      field.key === 'notes'
                        ? 'text-zinc-500'
                        : field.type === 'rating'
                        ? 'bg-sky-500/10 text-sky-300'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {display}
                  </span>
                )
              })}
            </div>
          ) : (
            <span className="text-xs text-zinc-600 italic">Not yet scouted — click to fill in</span>
          )}
        </button>
      )}

      {/* Expanded form */}
      {expanded && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 flex flex-col gap-3">
          {pitFields.map(field => (
            <PitFormField
              key={field.key}
              field={field}
              value={form[field.key] ?? (field.type === 'rating' ? null : '')}
              onChange={v => setField(field.key, v)}
              selectClass={selectClass}
              textareaClass={textareaClass}
              numberClass={numberClass}
            />
          ))}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-4 text-xs rounded-md border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setExpanded(false); setSavedOk(false) }}
              className="h-8 px-3 text-xs rounded-md border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            {savedOk && <span className="text-xs text-green-400">Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function PitFormField({
  field, value, onChange, selectClass, textareaClass, numberClass,
}: {
  field: PitField
  value: string | number | null
  onChange: (v: string | number | null) => void
  selectClass: string
  textareaClass: string
  numberClass: string
}) {
  return (
    <div>
      <label className="block text-[10px] text-zinc-500 mb-1">{field.label}</label>

      {field.type === 'select' && (
        <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={selectClass}>
          <option value="">— select —</option>
          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {field.type === 'text' && (
        <textarea
          value={String(value ?? '')}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={textareaClass}
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={value === null || value === '' ? '' : String(value)}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={numberClass}
        />
      )}

      {field.type === 'rating' && (
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => onChange(value === n ? null : n)}
              className={`w-8 h-8 rounded-md text-xs font-semibold border transition-colors ${
                value === n
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scout Notes ──────────────────────────────────────────────────────────────

function ScoutNotes({
  season, eventCode, teamNumber, notes, allSeasonNotes, showAllNotes, onToggleAll, eventsData, onMutate,
}: {
  season: string
  eventCode: string
  teamNumber: string
  notes: Note[]
  allSeasonNotes: { eventCode: string; notes: Note[] }[]
  showAllNotes: boolean
  onToggleAll: () => void
  eventsData: EventsResponse | undefined
  onMutate: (data?: Note[]) => void
}) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function eventName(code: string) {
    return eventsData?.events.find(e => e.code === code)?.name ?? code
  }

  async function saveNotes(updated: Note[]) {
    setSaving(true)
    onMutate(updated)
    try {
      await fetch(`/api/notes/${season}/${eventCode}/${teamNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
    } finally {
      setSaving(false)
    }
  }

  async function addNote() {
    const text = input.trim()
    if (!text) return
    const note: Note = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString() }
    setInput('')
    await saveNotes([...notes, note])
  }

  async function confirmDelete(id: string) {
    setConfirmDeleteId(null)
    await saveNotes(notes.filter(n => n.id !== id))
  }

  const otherEventNotes = allSeasonNotes.filter(g => g.eventCode !== eventCode)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Scout Notes</h3>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input type="checkbox" checked={showAllNotes} onChange={onToggleAll} className="accent-sky-500" />
          Show all season
        </label>
      </div>

      <div className="flex flex-col gap-1.5 mb-2">
        {notes.length === 0 && (
          <p className="text-xs text-zinc-700 italic">No notes for this event yet.</p>
        )}
        {notes.map(n => (
          <div key={n.id} className="flex gap-2 items-start rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-200 whitespace-pre-wrap">{n.text}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {new Date(n.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {confirmDeleteId === n.id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-zinc-400">Delete?</span>
                <button onClick={() => confirmDelete(n.id)} className="text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors">Yes</button>
                <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors">No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(n.id)}
                disabled={saving}
                className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-0.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote() } }}
          placeholder="Add a note…"
          className="flex-1 h-8 px-2.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={addNote}
          disabled={!input.trim() || saving}
          className="h-8 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-40"
        >
          {saving ? '…' : 'Add'}
        </button>
      </div>

      {showAllNotes && otherEventNotes.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {otherEventNotes.map(group => (
            <div key={group.eventCode}>
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">
                {eventName(group.eventCode)}
              </p>
              <div className="flex flex-col gap-1.5">
                {group.notes.map(n => (
                  <div key={n.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap">{n.text}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {new Date(n.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAllNotes && otherEventNotes.length === 0 && notes.length > 0 && (
        <p className="text-xs text-zinc-700 italic mt-3">No notes from other events this season.</p>
      )}
    </div>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold font-mono ${accent ? 'text-sky-300' : 'text-zinc-200'}`}>{value}</p>
    </div>
  )
}

function RobotPhoto({
  url,
  history,
  currentEventCode,
  season,
  eventCode,
  teamNumber,
  onUploaded,
  isScout,
  getEventName,
}: {
  url: string | null
  history: { url: string; eventCode: string; uploadedAt: string }[]
  currentEventCode: string
  season: string
  eventCode: string
  teamNumber: string
  onUploaded: () => void
  isScout: boolean
  getEventName: (code: string) => string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('season', season)
      form.append('eventCode', eventCode)
      form.append('teamNumber', teamNumber)

      const res = await fetch('/api/photos/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Photos from earlier events this season — exclude current event and anything
  // uploaded after the current event's photo (e.g. a future championship)
  const primaryPhoto = history.find(h => h.eventCode === currentEventCode) ?? history[0] ?? null
  const pastPhotos = history.filter(h =>
    h.eventCode !== currentEventCode &&
    primaryPhoto !== null &&
    new Date(h.uploadedAt) < new Date(primaryPhoto.uploadedAt)
  )

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Main photo */}
        <div
          className="relative w-full aspect-square rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden group"
          onClick={() => url && setLightboxUrl(url)}
          style={{ cursor: url ? 'zoom-in' : 'default' }}
        >
          {url ? (
            <>
              <Image src={url} alt="Robot photo" fill className="object-contain" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
              <Camera className="w-10 h-10" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}
        </div>

        {/* Upload button — scout only */}
        {isScout && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded-md border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading…' : url ? 'Replace photo' : 'Add robot photo'}
            </button>
            {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
          </>
        )}

        {/* Photo history strip — previous events this season */}
        {pastPhotos.length > 0 && (
          <div>
            <p className="text-[10px] text-zinc-600 mb-1">Earlier this season</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {[...pastPhotos].reverse().map(h => (
                <button
                  key={h.eventCode}
                  onClick={() => setLightboxUrl(h.url)}
                  title={getEventName(h.eventCode)}
                  className="shrink-0"
                >
                  <div className="w-14 h-14 rounded border border-zinc-700 overflow-hidden relative hover:border-zinc-500 transition-colors">
                    <Image src={h.url} alt={getEventName(h.eventCode)} fill className="object-cover" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-zinc-800/80 rounded-full p-2 hover:bg-zinc-700 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="relative w-full h-full max-w-3xl max-h-[90vh] m-8"
            onClick={e => e.stopPropagation()}
          >
            <Image src={lightboxUrl} alt="Robot photo" fill className="object-contain" />
          </div>
        </div>
      )}
    </>
  )
}
