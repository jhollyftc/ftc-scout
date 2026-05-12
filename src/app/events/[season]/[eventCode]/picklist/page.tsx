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
import { Shield, Download, GripVertical, ChevronDown } from 'lucide-react'
import { useScoutMode } from '@/lib/scout-mode'
import { calculateOPR } from '@/lib/opr'
import type { HybridScheduleResponse, RankingsResponse } from '@/lib/ftc-client'
import type { PickEntry, PickColumn } from '@/app/api/picklist/[season]/[eventCode]/[listId]/route'
import type { MatchScoutEntryWithMatch } from '@/app/api/match-scout/[season]/[eventCode]/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())


const COLUMN_IDS: PickColumn[] = ['tier1', 'tier2', 'dnp', 'uncategorized']

const COLUMN_META: Record<PickColumn, { label: string; mobileLabel: string; border: string; header: string }> = {
  tier1:         { label: 'Tier 1',        mobileLabel: 'Tier 1', border: 'border-sky-500/40',    header: 'bg-sky-500/10 text-sky-300' },
  tier2:         { label: 'Tier 2',        mobileLabel: 'Tier 2', border: 'border-purple-500/40', header: 'bg-purple-500/10 text-purple-300' },
  dnp:           { label: 'Do Not Pick',   mobileLabel: 'DNP',    border: 'border-red-500/40',    header: 'bg-red-500/10 text-red-400' },
  uncategorized: { label: 'Uncategorized', mobileLabel: 'Uncat',  border: 'border-zinc-700',      header: 'bg-zinc-800 text-zinc-400' },
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v !== null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

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
  autoOpr?: number
  teleopOpr?: number
  avgRating?: number | null
  hasPit?: boolean
  notesCount: number
}

function ratingColor(rating: number): string {
  if (rating >= 4.5) return 'text-emerald-400'
  if (rating >= 3.5) return 'text-green-400'
  if (rating >= 2.5) return 'text-yellow-400'
  if (rating >= 1.5) return 'text-orange-400'
  return 'text-red-400'
}

function TeamCard({
  info,
  isDragging,
  dragAttributes,
  dragListeners,
  currentCol,
  moveOpen,
  onToggleMove,
  onMove,
  onShowNotes,
}: {
  info: TeamInfo
  isDragging?: boolean
  dragAttributes?: ReturnType<typeof useSortable>['attributes']
  dragListeners?: ReturnType<typeof useSortable>['listeners']
  currentCol?: PickColumn
  moveOpen?: boolean
  onToggleMove?: () => void
  onMove?: (targetCol: PickColumn) => void
  onShowNotes?: () => void
}) {
  return (
    <div
      className={`rounded-lg border bg-zinc-900 select-none transition-shadow ${
        isDragging
          ? 'border-sky-500/60 shadow-lg shadow-sky-500/10 opacity-50'
          : 'border-zinc-700 hover:border-zinc-500'
      }`}
    >
      <div className="flex items-stretch">
        {/* Grip handle — only this zone initiates drag */}
        <div
          {...dragAttributes}
          {...dragListeners}
          className="flex items-center px-2 cursor-grab active:cursor-grabbing touch-none text-zinc-600 hover:text-zinc-400 border-r border-zinc-800 shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Card content */}
        <div className="flex-1 p-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono font-bold text-base text-zinc-100">{info.teamNumber}</span>
                {info.avgRating != null && (
                  <span className={`text-sm font-semibold ${ratingColor(info.avgRating)}`}>
                    ★ {info.avgRating.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate leading-tight">{info.teamName}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {info.hasPit !== undefined && (
                  <span className={`text-[10px] ${info.hasPit ? 'text-green-400' : 'text-amber-500'}`}>
                    {info.hasPit ? '● Pit ✓' : '○ Pit'}
                  </span>
                )}
                {info.notesCount > 0 && onShowNotes && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onShowNotes() }}
                    className="text-[10px] text-sky-600 hover:text-sky-400 transition-colors"
                  >
                    ✎ {info.notesCount} {info.notesCount === 1 ? 'note' : 'notes'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0 gap-0.5">
              {info.rank != null && (
                <span className="text-xs text-zinc-300 font-medium">Rank {info.rank}</span>
              )}
              {info.nopr != null && (
                <span className="text-xs text-zinc-300 font-mono">{info.nopr.toFixed(1)} nOPR</span>
              )}
              {(info.autoOpr != null || info.teleopOpr != null) && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  {info.autoOpr?.toFixed(1) ?? '—'}a · {info.teleopOpr?.toFixed(1) ?? '—'}t
                </span>
              )}
              {onToggleMove && currentCol && (
                <button
                  type="button"
                  className="sm:hidden mt-1 text-[10px] text-zinc-500 active:text-zinc-200 transition-colors"
                  onClick={e => { e.stopPropagation(); onToggleMove() }}
                >
                  {moveOpen ? 'Cancel' : 'Move →'}
                </button>
              )}
            </div>
          </div>

          {/* Move target chips — mobile only, shown when moveOpen */}
          {moveOpen && onMove && currentCol && (
            <div className="sm:hidden mt-2 pt-2 border-t border-zinc-800 flex gap-1.5 flex-wrap">
              {COLUMN_IDS.filter(c => c !== currentCol).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={e => { e.stopPropagation(); onMove(c) }}
                  className={`px-2.5 py-1 text-[10px] rounded-md font-medium border transition-colors ${COLUMN_META[c].header} ${COLUMN_META[c].border}`}
                >
                  {COLUMN_META[c].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SortableTeamCard({
  info,
  currentCol,
  onMove,
  onShowNotes,
}: {
  info: TeamInfo
  currentCol: PickColumn
  onMove: (teamNumber: number, targetCol: PickColumn) => void
  onShowNotes: (teamNumber: number) => void
}) {
  const [moveOpen, setMoveOpen] = useState(false)
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
        currentCol={currentCol}
        moveOpen={moveOpen}
        onToggleMove={() => setMoveOpen(s => !s)}
        onMove={targetCol => { onMove(info.teamNumber, targetCol); setMoveOpen(false) }}
        onShowNotes={info.notesCount > 0 ? () => onShowNotes(info.teamNumber) : undefined}
      />
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  teamNumbers,
  teamInfoMap,
  onMove,
  onShowNotes,
  collapsed,
  onToggleCollapse,
}: {
  col: PickColumn
  teamNumbers: number[]
  teamInfoMap: Map<number, TeamInfo>
  onMove: (teamNumber: number, targetCol: PickColumn) => void
  onShowNotes: (teamNumber: number) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const meta = COLUMN_META[col]
  const { setNodeRef } = useDroppable({ id: col })

  return (
    <div ref={setNodeRef} className={`rounded-xl border ${meta.border} flex flex-col ${collapsed ? '' : 'min-h-[220px]'}`}>
      <div className={`flex items-center justify-between px-3 py-2 ${collapsed ? 'rounded-xl' : 'rounded-t-xl'} ${meta.header}`}>
        <span className="text-xs font-semibold tracking-wide">{meta.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60">{teamNumbers.length}</span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden sm:flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              aria-label={collapsed ? 'Expand column' : 'Collapse column'}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
            </button>
          )}
        </div>
      </div>
      {!collapsed && (
        <SortableContext items={teamNumbers} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5 p-2 flex-1">
            {teamNumbers.map(tn => {
              const info = teamInfoMap.get(tn) ?? { teamNumber: tn, teamName: String(tn), notesCount: 0 }
              return <SortableTeamCard key={tn} info={info} currentCol={col} onMove={onMove} onShowNotes={onShowNotes} />
            })}
            {teamNumbers.length === 0 && (
              <p className="text-[11px] text-zinc-700 text-center py-8 italic">Drop here</p>
            )}
          </div>
        </SortableContext>
      )}
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
  const listId = view === 'primary' ? '_primary' : (isAdmin ? '_admin' : (scoutName ?? ''))

  const [columns, setColumns] = useState<Record<PickColumn, number[]>>({
    tier1: [], tier2: [], dnp: [], uncategorized: [],
  })
  const [mobileTab, setMobileTab] = useState<PickColumn>('uncategorized')
  const [collapsedCols, setCollapsedCols] = useState<Set<PickColumn>>(new Set())
  const [notesTeam, setNotesTeam] = useState<number | null>(null)

  const toggleCollapse = useCallback((col: PickColumn) => {
    setCollapsedCols(prev => {
      const next = new Set(prev)
      if (next.has(col)) next.delete(col); else next.add(col)
      return next
    })
  }, [])
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
        autoOpr: opr[teamNumber]?.auto,
        teleopOpr: opr[teamNumber]?.teleop,
        avgRating: avgRat,
        hasPit: pitData ? String(teamNumber) in pitData : undefined,
        notesCount: entries.filter(e => e.notes?.trim()).length,
      })
    }
    return m
  }, [allTeams, rankData, opr, pitData, allMatchScout])

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

  const moveTeam = useCallback(
    (teamNumber: number, targetCol: PickColumn) => {
      setColumns(prev => {
        const sourceCol = findColumnForTeam(prev, teamNumber)
        if (!sourceCol || sourceCol === targetCol) return prev
        const newCols = {
          ...prev,
          [sourceCol]: prev[sourceCol].filter(n => n !== teamNumber),
          [targetCol]: [...prev[targetCol], teamNumber],
        }
        scheduleSave(newCols)
        return newCols
      })
    },
    [scheduleSave]
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

  const collisionDetection = useCallback(
    (args: Parameters<typeof pointerWithin>[0]) => {
      const hits = pointerWithin(args)
      return hits.length > 0 ? hits : rectIntersection(args)
    },
    []
  )

  // ── Admin import merge ──────────────────────────────────────────────────────

  async function handleImport() {
    if (!isAdmin || allTeams.length === 0) return
    setImportBusy(true)
    try {
      const allLists: Record<string, PickEntry[]> = await fetch(
        `/api/picklist/${season}/${eventCode}`
      ).then(r => r.json())

      const scoutLists = Object.fromEntries(
        Object.entries(allLists).filter(([k]) => k !== '_primary' && k !== '_admin')
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
                {v === 'personal' ? 'My List' : 'Merged'}
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

        <span className={`ml-auto text-[11px] text-zinc-600 ${saving ? 'visible' : 'invisible'}`}>Saving…</span>
      </div>

      {/* ── Mobile: tab bar + single active column ── */}
      <div className="sm:hidden">
        <div className="flex gap-1 mb-3">
          {COLUMN_IDS.map(col => {
            const meta = COLUMN_META[col]
            const active = mobileTab === col
            return (
              <button
                key={col}
                type="button"
                onClick={() => setMobileTab(col)}
                className={`flex-1 py-2 text-[10px] font-semibold rounded-lg border transition-colors leading-tight ${
                  active ? `${meta.header} ${meta.border}` : 'border-zinc-700 text-zinc-500'
                }`}
              >
                {meta.mobileLabel}
                <br />
                <span className="opacity-60 font-normal">{columns[col].length}</span>
              </button>
            )
          })}
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <KanbanColumn
            col={mobileTab}
            teamNumbers={columns[mobileTab]}
            teamInfoMap={teamInfoMap}
            onMove={moveTeam}
            onShowNotes={setNotesTeam}
          />
          <DragOverlay>
            {activeInfo && (
              <div className="opacity-90 rotate-1 shadow-2xl">
                <TeamCard info={activeInfo} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Desktop: 4-column grid ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMN_IDS.map(col => (
            <KanbanColumn
              key={col}
              col={col}
              teamNumbers={columns[col]}
              teamInfoMap={teamInfoMap}
              onMove={moveTeam}
              onShowNotes={setNotesTeam}
              collapsed={collapsedCols.has(col)}
              onToggleCollapse={() => toggleCollapse(col)}
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

      {/* ── Scout notes modal ── */}
      {notesTeam !== null && (() => {
        const entries = (allMatchScout?.[String(notesTeam)] ?? [])
          .filter(e => e.notes?.trim())
          .sort((a, b) => a.matchNumber - b.matchNumber)
        const teamInfo = teamInfoMap.get(notesTeam)
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
                  {teamInfo && <span className="text-xs text-zinc-500 ml-2">{teamInfo.teamName}</span>}
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
