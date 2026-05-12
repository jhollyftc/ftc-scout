'use client'

import { useRef, useState, useEffect, type CSSProperties } from 'react'
import Link from 'next/link'
import { ExternalLink, Shield, X } from 'lucide-react'

export interface TeamPopoverData {
  teamName?: string
  rank?: number
  record?: string
  nopr?: number
  avgAuto?: number | null
  avgTeleop?: number | null
  topEndgame?: string | null
  matchCount?: number
  hasPit?: boolean
  latestNote?: string | null
}

interface TeamPopoverProps extends TeamPopoverData {
  season: string
  eventCode: string
  teamNumber: number
  className?: string
}

export function TeamPopover({
  season,
  eventCode,
  teamNumber,
  teamName,
  rank,
  record,
  nopr,
  avgAuto,
  avgTeleop,
  topEndgame,
  matchCount,
  hasPit,
  latestNote,
  className,
}: TeamPopoverProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 240 - 8)
    const spaceBelow = window.innerHeight - rect.bottom
    const computed: CSSProperties = { position: 'fixed', left, zIndex: 9999 }
    if (spaceBelow >= 300) {
      computed.top = rect.bottom + 4
    } else {
      computed.bottom = window.innerHeight - rect.top + 4
    }
    setStyle(computed)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        !popoverRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [open])

  const avgRating =
    avgAuto != null && avgTeleop != null ? (avgAuto + avgTeleop) / 2 : null

  const hasScoutData =
    matchCount !== undefined ||
    hasPit !== undefined ||
    avgRating !== null ||
    topEndgame ||
    latestNote

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={className ?? 'text-sky-400 hover:text-sky-300 font-mono text-sm hover:underline transition-colors'}
      >
        {teamNumber}
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={style}
          className="w-56 rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl p-3 text-xs"
        >
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div>
              <span className="text-base font-bold text-zinc-100 font-mono">{teamNumber}</span>
              {teamName && (
                <p className="text-zinc-400 text-[11px] mt-0.5 leading-tight">{teamName}</p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 shrink-0">
              {rank != null && (
                <span className="text-zinc-300 font-mono text-xs">#{rank}</span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {(record || nopr !== undefined) && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-2">
              {record && (
                <div>
                  <div className="text-[10px] text-zinc-600">Record</div>
                  <div className="text-zinc-300 font-mono">{record}</div>
                </div>
              )}
              {nopr !== undefined && (
                <div>
                  <div className="text-[10px] text-zinc-600">nOPR</div>
                  <div className="text-zinc-300 font-mono">{nopr.toFixed(1)}</div>
                </div>
              )}
            </div>
          )}

          {hasScoutData && (
            <div className="border-t border-zinc-800 pt-2 mt-1">
              <div className="flex items-center gap-1 text-[10px] text-green-600 mb-1.5">
                <Shield className="w-2.5 h-2.5" /> Scout Data
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {hasPit !== undefined && (
                  <div>
                    <div className="text-[10px] text-zinc-600">Pit Scout</div>
                    <div className={hasPit ? 'text-green-400' : 'text-amber-400'}>
                      {hasPit ? '✓ Done' : 'Pending'}
                    </div>
                  </div>
                )}
                {matchCount !== undefined && (
                  <div>
                    <div className="text-[10px] text-zinc-600">Matches</div>
                    <div className="text-zinc-300 font-mono">{matchCount}</div>
                  </div>
                )}
                {avgAuto != null && (
                  <div>
                    <div className="text-[10px] text-zinc-600">Avg Auto</div>
                    <div className="text-zinc-300 font-mono">{avgAuto.toFixed(1)}</div>
                  </div>
                )}
                {avgTeleop != null && (
                  <div>
                    <div className="text-[10px] text-zinc-600">Avg Teleop</div>
                    <div className="text-zinc-300 font-mono">{avgTeleop.toFixed(1)}</div>
                  </div>
                )}
                {topEndgame && (
                  <div className="col-span-2">
                    <div className="text-[10px] text-zinc-600">Top Endgame</div>
                    <div className="text-zinc-300">{topEndgame}</div>
                  </div>
                )}
              </div>
              {latestNote && (
                <div className="mt-1.5">
                  <div className="text-[10px] text-zinc-600 mb-0.5">Latest Note</div>
                  <p className="text-zinc-400 italic text-[10px] line-clamp-2">
                    &ldquo;{latestNote}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          <Link
            href={`/events/${season}/${eventCode}/teams/${teamNumber}`}
            className="flex items-center gap-1 mt-2.5 text-sky-500 hover:text-sky-300 text-[11px] font-medium transition-colors"
            onClick={() => setOpen(false)}
          >
            Open full profile <ExternalLink className="w-2.5 h-2.5" />
          </Link>
        </div>
      )}
    </>
  )
}
