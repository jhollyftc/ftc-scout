'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Shield, Download } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
import type { HybridScheduleResponse, RankingsResponse } from '@/lib/ftc-client'
import type { PickEntry, PickColumn } from '@/app/api/picklist/[season]/[eventCode]/[listId]/route'
import type { MatchScoutEntryWithMatch } from '@/app/api/match-scout/[season]/[eventCode]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const COLUMN_IDS: PickColumn[] = ['tier1', 'tier2', 'dnp', 'uncategorized']

const COLUMN_META: Record<PickColumn, { label: string; border: string; header: string }> = {
  tier1:         { label: 'Tier 1',        border: 'border-sky-500/40',    header: 'bg-sky-500/10 text-sky-300' },
  tier2:         { label: 'Tier 2',        border: 'border-purple-500/40', header: 'bg-purple-500/10 text-purple-300' },
  dnp:           { label: 'Do Not Pick',   border: 'border-red-500/40',    header: 'bg-red-500/10 text-red-400' },
  uncategorized: { label: 'Uncategorized', border: 'border-zinc-700',      header: 'bg-zinc-800 text-zinc-400' },
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

// Merge all scouts' lists into a primary list by majority vote
function mergeLists(allLists: Record<string, PickEntry[]>, teamNumbers: number[]): PickEntry[] {
  const TIE_PRIORITY: PickColumn[] = ['tier1', 'tier2', 'uncategorized', 'dnp']
  const result: PickEntry[] = []

  for (const teamNumber of teamNumbers) {
    const votes: Record<PickColumn, number> = { tier1: 0, tier2: 0, dnp: 0, uncategorized: 0 }
    const orders: Partial<Record<PickColumn, number[]>> = {}

    for (const list of Object.values(allLists)) {
      const entry = list.find(e => e.teamNumber === teamNumber)
      if (!entry) continue
      votes[entry.column]++
      orders[entry.column] = [...(orders[entry.column] ?? []), entry.order]
    }

    let winner: PickColumn = 'uncategorized'
    let winnerVotes = 0
    for (const col of TIE_PRIORITY) {
      if (votes[col] > winnerVotes) { winner = col; winnerVotes = votes[col] }
    }

    const avgOrder =
      orders[winner]?.length
        ? orders[winner]!.reduce((a, b) => a + b, 0) / orders[winner]!.length
        : 999

    result.push({ teamNumber, column: winner, order: avgOrder })
  }

  const byCol: Partial<Record<PickColumn, PickEntry[]>> = {}
  for (const entry of result) {
    byCol[entry.column] = [...(byCol[entry.column] ?? []), entry]
  }
  const final: PickEntry[] = []
  for (const col of COLUMN_IDS) {
    const sorted = (byCol[col] ?? []).sort((a, b) => a.order - b.order)
    sorted.forEach((e, i) => final.push({ ...e, order: i }))
  }
  return final
}

function entriesToColumns(entries: PickEntry[]): Record<PickColumn, number[]> {
  const cols: Record<PickColumn, number[]> = { tier1: [], tier2: [], dnp: [], uncategorized: [] }
  const sorted = [...entries].sort((a, b) => a.order - b.order)
  for (const e of sorted) cols[e.column].push(e.teamNumber)
  return cols
}

function columnsToEntries(cols: Record<PickColumn, number[]>): PickEntry[] {
  const entries: PickEntry[] = []
  for (const col of COLUMN_IDS) {
    cols[col].forEach((teamNumber, order) => entries.push({ teamNumber, column: col, order }))
  }
  return entries
}

function findColumnForTeam(cols: Record<PickColumn, number[]>, teamNumber: number): PickColumn | null {
  for (const col of COLUMN_IDS) {
    if (cols[col].includes(teamNumber)) return col
  }
  return null
}

// ── Team Card ──────────────────────────────────────────────────────────────────

interface TeamInfo {
  teamNumber: number
  teamName: string
  rank?: number
  nopr?: number
  avgRating?: number | null
  hasPit?: boolean
}

function TeamCard({
  info,
  isDragging,
  dragAttributes,
  dragListeners,
}: {
  info: TeamInfo
  isDragging?: boolean
  dragAttributes?: ReturnType<typeof useSortable>['attributes']
  dragListeners?: ReturnType<typeof useSortable>['listeners']
}) {
  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      className={`rounded-lg border bg-zinc-900 p-3 select-none cursor-grab active:cursor-grabbing touch-none transition-shadow ${
        isDragging
          ? 'border-sky-500/60 shadow-lg shadow-sky-500/10 opacity-50'
          : 'border-zinc-700 hover:border-zinc-500'
      }`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono font-bold text-sm text-zinc-100">{info.teamNumber}</span>
        <div className="flex items-center gap-2 shrink-0">
          {info.hasPit !== undefined && (
            <span className={`text-xs ${info.hasPit ? 'text-green-400' : 'text-amber-500'}`}>
              {info.hasPit ? '●' : '○'}
            </span>
          )}
          {info.rank != null && (
            <span className="text-[10px] text-zinc-400 font-medium">Rank {info.rank}</span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 truncate leading-tight mb-1.5">{info.teamName}</p>

      <div className="flex items-center gap-3 flex-wrap">
        {info.avgRating != null && (
          <span className="text-[10px] text-zinc-300 font-mono">
            ★ {info.avgRating.toFixed(1)}
          </span>
        )}
        {info.nopr != null && (
          <span className="text-[10px] text-zinc-300 font-mono">
            {info.nopr.toFixed(1)} nOPR
          </span>
        )}
      </div>
    </div>
  )
}

function SortableTeamCard({ info }: { info: TeamInfo }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: info.teamNumber,
  })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <TeamCard
        info={info}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  teamNumbers,
  teamInfoMap,
}: {
  col: PickColumn
  teamNumbers: number[]
  teamInfoMap: Map<number, TeamInfo>
}) {
  const meta = COLUMN_META[col]
  const { setNodeRef } = useDroppable({ id: col })

  return (
    <div ref={setNodeRef} className={`rounded-xl border ${meta.border} flex flex-col min-h-[220px]`}>
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${meta.header}`}>
        <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
        <span className="text-xs opacity-60">{teamNumbers.length}</span>
      </div>
      <SortableContext items={teamNumbers} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5 p-2 flex-1">
          {teamNumbers.map(tn => {
            const info = teamInfoMap.get(tn) ?? { teamNumber: tn, teamName: String(tn) }
            return <SortableTeamCard key={tn} info={info} />
          })}
          {teamNumbers.length === 0 && (
            <p className="text-[11px] text-zinc-700 text-center py-8 italic">Drop here</p>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ── Pick List Page ─────────────────────────────────────────────────────────────

export default function PickListPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)
  const { isScout, isAdmin, scoutName } = useScoutMode()

  const [view, setView] = useState<'personal' | 'primary'>('personal')
  const listId = view === 'primary' ? '_primary' : (scoutName ?? '')

  const [columns, setColumns] = useState<Record<PickColumn, number[]>>({
    tier1: [], tier2: [], dnp: [], uncategorized: [],
  })
  const [activeId, setActiveId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const initialized = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const { data: schedData } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { refreshInterval: 60_000 }
  )
  const { data: rankData } = useSWR<RankingsResponse>(
    `/api/ftc/${season}/rankings/${eventCode}`,
    fetcher,
    { refreshInterval: 60_000 }
  )
  const { data: pitData } = useSWR<Record<string, unknown>>(
    isScout ? `/api/pit/${season}/${eventCode}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const { data: allMatchScout } = useSWR<Record<string, MatchScoutEntryWithMatch[]>>(
    isScout ? `/api/match-scout/${season}/${eventCode}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  const { data: savedList, mutate: mutateList } = useSWR<PickEntry[] | null>(
    listId ? `/api/picklist/${season}/${eventCode}/${listId}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  const schedule = schedData?.schedule ?? []
  const opr = useMemo(() => calculateOPR(schedule), [schedule])

  const allTeams = useMemo(() => {
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

  const teamInfoMap = useMemo(() => {
    const m = new Map<number, TeamInfo>()
    for (const { teamNumber, teamName } of allTeams) {
      const rankInfo = rankData?.rankings.find(r => r.teamNumber === teamNumber)
      const entries = allMatchScout?.[String(teamNumber)] ?? []
      const autoAvg = avg(entries.map(e => e.autoRating))
      const teleopAvg = avg(entries.map(e => e.teleopRating))
      const avgRat = avg([autoAvg, teleopAvg])
      m.set(teamNumber, {
        teamNumber,
        teamName,
        rank: rankInfo?.rank,
        nopr: opr[teamNumber]?.nopr,
        avgRating: avgRat,
        hasPit: pitData ? String(teamNumber) in pitData : undefined,
      })
    }
    return m
  }, [allTeams, rankData, opr, pitData, allMatchScout])

  // Initialize columns from saved list (or default all to uncategorized)
  useEffect(() => {
    if (!allTeams.length) return
    if (initialized.current && savedList !== undefined) return

    if (savedList && savedList.length > 0) {
      const savedNums = new Set(savedList.map(e => e.teamNumber))
      const missing = allTeams
        .filter(t => !savedNums.has(t.teamNumber))
        .map((t, i) => ({ teamNumber: t.teamNumber, column: 'uncategorized' as PickColumn, order: savedList.length + i }))
      setColumns(entriesToColumns([...savedList, ...missing]))
    } else if (savedList === null && allTeams.length > 0) {
      const initial: Record<PickColumn, number[]> = {
        tier1: [], tier2: [], dnp: [],
        uncategorized: allTeams.map(t => t.teamNumber),
      }
      setColumns(initial)
      if (listId) {
        const entries = columnsToEntries(initial)
        fetch(`/api/picklist/${season}/${eventCode}/${listId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        })
        mutateList(entries, { revalidate: false })
      }
    }
    initialized.current = true
  }, [savedList, allTeams, listId, season, eventCode, mutateList])

  useEffect(() => { initialized.current = false }, [listId])

  const scheduleSave = useCallback(
    (newCols: Record<PickColumn, number[]>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        if (!listId) return
        setSaving(true)
        const entries = columnsToEntries(newCols)
        mutateList(entries, { revalidate: false })
        await fetch(`/api/picklist/${season}/${eventCode}/${listId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        })
        setSaving(false)
      }, 600)
    },
    [listId, season, eventCode, mutateList]
  )

  // ── DnD handlers ───────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as number)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const activeNum = active.id as number
    const overId = over.id

    const activeCol = findColumnForTeam(columns, activeNum)
    const overCol = COLUMN_IDS.includes(overId as PickColumn)
      ? (overId as PickColumn)
      : findColumnForTeam(columns, overId as number)

    if (!activeCol || !overCol || activeCol === overCol) return

    setColumns(prev => {
      const overItems = prev[overCol]
      const overIndex = COLUMN_IDS.includes(overId as PickColumn)
        ? overItems.length
        : overItems.indexOf(overId as number)

      return {
        ...prev,
        [activeCol]: prev[activeCol].filter(n => n !== activeNum),
        [overCol]: [
          ...overItems.slice(0, overIndex),
          activeNum,
          ...overItems.slice(overIndex),
        ],
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const activeNum = active.id as number
    const overId = over.id as UniqueIdentifier
    const activeCol = findColumnForTeam(columns, activeNum)
    if (!activeCol) return

    if (!COLUMN_IDS.includes(overId as PickColumn)) {
      const overNum = overId as number
      const overCol = findColumnForTeam(columns, overNum)
      if (overCol === activeCol) {
        const items = columns[activeCol]
        const oldIdx = items.indexOf(activeNum)
        const newIdx = items.indexOf(overNum)
        if (oldIdx !== newIdx) {
          const newCols = { ...columns, [activeCol]: arrayMove(items, oldIdx, newIdx) }
          setColumns(newCols)
          scheduleSave(newCols)
          return
        }
      }
    }

    scheduleSave(columns)
  }

  // ── Admin import merge ──────────────────────────────────────────────────────

  async function handleImport() {
    if (!isAdmin || allTeams.length === 0) return
    setImportBusy(true)
    try {
      const allLists: Record<string, PickEntry[]> = await fetch(
        `/api/picklist/${season}/${eventCode}`
      ).then(r => r.json())

      const scoutLists = Object.fromEntries(
        Object.entries(allLists).filter(([k]) => k !== '_primary')
      )
      if (!Object.keys(scoutLists).length) return

      const merged = mergeLists(scoutLists, allTeams.map(t => t.teamNumber))
      const newCols = entriesToColumns(merged)
      setColumns(newCols)

      await fetch(`/api/picklist/${season}/${eventCode}/_primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      mutateList(merged, { revalidate: false })
    } finally {
      setImportBusy(false)
    }
  }

  // ── Guard ───────────────────────────────────────────────────────────────────

  if (!isScout) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <Shield className="w-8 h-8 text-zinc-700" />
        <p className="text-zinc-500 text-sm">Log in on the main page to unlock.</p>
      </div>
    )
  }

  const activeInfo = activeId != null ? teamInfoMap.get(activeId) : null

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {isAdmin && (
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden shrink-0">
            {(['personal', 'primary'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === v ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v === 'personal' ? 'My List' : 'Primary'}
              </button>
            ))}
          </div>
        )}

        {isAdmin && view === 'primary' && (
          <button
            onClick={handleImport}
            disabled={importBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {importBusy ? 'Importing…' : 'Import All Scouts'}
          </button>
        )}

        <span className="ml-auto text-[11px] text-zinc-600">{saving ? 'Saving…' : ''}</span>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={args => {
          const hits = pointerWithin(args)
          return hits.length > 0 ? hits : rectIntersection(args)
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMN_IDS.map(col => (
            <KanbanColumn
              key={col}
              col={col}
              teamNumbers={columns[col]}
              teamInfoMap={teamInfoMap}
            />
          ))}
        </div>

        <DragOverlay>
          {activeInfo && (
            <div className="opacity-90 rotate-1 shadow-2xl">
              <TeamCard info={activeInfo} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
