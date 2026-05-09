'use client'

import { use, useRef, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, Upload, ExternalLink, X, ZoomIn, Trash2 } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
import type { TeamsResponse, HybridScheduleResponse, EventsResponse } from '@/lib/ftc-client'
import type { Note } from '@/app/api/notes/[season]/[eventCode]/[teamNumber]/route'

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

  const { data: photoData, mutate: mutatePhoto } = useSWR<{ url: string | null }>(
    `/api/photos/${season}/${eventCode}/${teamNumber}`,
    fetcher
  )

  const { data: eventsData } = useSWR<EventsResponse>(
    `/api/ftc/${season}/events?teamNumber=${teamNumber}`,
    fetcher
  )

  const [showAllNotes, setShowAllNotes] = useState(false)

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
          {team && (
            <span className="text-zinc-400 text-lg">{team.nameShort}</span>
          )}
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
            season={season}
            eventCode={eventCode}
            teamNumber={teamNumber}
            onUploaded={() => mutatePhoto()}
            isScout={isScout}
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
              <Stat label="OPR" value={teamOpr.total.toFixed(1)} accent />
              <Stat label="nOPR" value={teamOpr.nopr.toFixed(1)} />
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
                          <td className="py-2.5 px-3 text-xs font-mono text-zinc-500">Q{m.matchNumber}</td>
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
              onMutate={mutateNotes}
            />
          )}

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
                            ? 'border-orange-500/30 bg-orange-500/5 text-zinc-300'
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
  onMutate: () => void
}) {
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  function eventName(code: string) {
    return eventsData?.events.find(e => e.code === code)?.name ?? code
  }

  async function saveNotes(updated: Note[]) {
    setSaving(true)
    try {
      await fetch(`/api/notes/${season}/${eventCode}/${teamNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      onMutate()
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

  async function deleteNote(id: string) {
    await saveNotes(notes.filter(n => n.id !== id))
  }

  const otherEventNotes = allSeasonNotes.filter(g => g.eventCode !== eventCode)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Scout Notes</h3>
        <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllNotes}
            onChange={onToggleAll}
            className="accent-orange-500"
          />
          Show all season
        </label>
      </div>

      {/* Current event notes */}
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
            <button
              onClick={() => deleteNote(n.id)}
              className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-0.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote() } }}
          placeholder="Add a note…"
          className="flex-1 h-8 px-2.5 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={addNote}
          disabled={!input.trim() || saving}
          className="h-8 px-3 text-xs rounded-md border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors disabled:opacity-40"
        >
          {saving ? '…' : 'Add'}
        </button>
      </div>

      {/* Other events' notes (read-only) */}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-lg font-bold font-mono ${accent ? 'text-orange-300' : 'text-zinc-200'}`}>
        {value}
      </p>
    </div>
  )
}

function RobotPhoto({
  url,
  season,
  eventCode,
  teamNumber,
  onUploaded,
  isScout,
}: {
  url: string | null
  season: string
  eventCode: string
  teamNumber: string
  onUploaded: () => void
  isScout: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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

  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Photo display */}
        <div
          className="relative w-full aspect-square rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden group"
          onClick={() => url && setLightboxOpen(true)}
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
      </div>

      {/* Lightbox */}
      {lightboxOpen && url && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-zinc-800/80 rounded-full p-2 hover:bg-zinc-700 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="relative w-full h-full max-w-3xl max-h-[90vh] m-8"
            onClick={e => e.stopPropagation()}
          >
            <Image src={url} alt="Robot photo" fill className="object-contain" />
          </div>
        </div>
      )}
    </>
  )
}
