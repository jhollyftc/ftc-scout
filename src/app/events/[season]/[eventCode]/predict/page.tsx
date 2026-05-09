'use client'

import { use, useState, useMemo } from 'react'
import useSWR from 'swr'
import { calculateOPR } from '@/lib/opr'
import { predictMatch } from '@/lib/predict'
import { Input } from '@/components/ui/input'
import type { RankingsResponse, HybridScheduleResponse } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function TeamPicker({
  label,
  color,
  value,
  onChange,
  teams,
}: {
  label: string
  color: 'red' | 'blue'
  value: [string, string]
  onChange: (v: [string, string]) => void
  teams: { teamNumber: number; teamName: string }[]
}) {
  const borderColor = color === 'red' ? 'border-red-500/30' : 'border-blue-500/30'
  const labelColor = color === 'red' ? 'text-red-400' : 'text-blue-400'
  const accentClass =
    color === 'red'
      ? 'bg-red-500/10 border-red-500/30 text-red-300 placeholder:text-red-700'
      : 'bg-blue-500/10 border-blue-500/30 text-blue-300 placeholder:text-blue-700'

  return (
    <div className={`rounded-lg border ${borderColor} p-4`}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelColor}`}>
        {label}
      </p>
      <div className="space-y-2">
        {(['0', '1'] as const).map(i => (
          <div key={i}>
            <Input
              placeholder={`Team ${Number(i) + 1}`}
              value={value[Number(i)]}
              onChange={e => {
                const next: [string, string] = [...value] as [string, string]
                next[Number(i)] = e.target.value
                onChange(next)
              }}
              list={`${color}-${i}-teams`}
              className={`${accentClass} border h-9 text-sm`}
            />
            <datalist id={`${color}-${i}-teams`}>
              {teams.map(t => (
                <option key={t.teamNumber} value={String(t.teamNumber)}>
                  {t.teamName}
                </option>
              ))}
            </datalist>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PredictPage({
  params,
}: {
  params: Promise<{ season: string; eventCode: string }>
}) {
  const { season, eventCode } = use(params)

  const [redTeams, setRedTeams] = useState<[string, string]>(['', ''])
  const [blueTeams, setBlueTeams] = useState<[string, string]>(['', ''])

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

  const opr = useMemo(
    () => (schedData?.schedule ? calculateOPR(schedData.schedule) : {}),
    [schedData]
  )

  const teams = rankData?.rankings ?? []

  const redNums = redTeams.map(Number).filter(n => n > 0)
  const blueNums = blueTeams.map(Number).filter(n => n > 0)
  const canPredict = redNums.length > 0 && blueNums.length > 0

  const prediction = useMemo(() => {
    if (!canPredict) return null
    const avgOpr =
      Object.values(opr).reduce((s, o) => s + o.total, 0) /
        Math.max(Object.keys(opr).length, 1) /
        2
    return predictMatch(redNums, blueNums, opr, avgOpr)
  }, [redNums, blueNums, opr, canPredict])

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-sm text-zinc-300">Match Predictor</h2>
        {Object.keys(opr).length === 0 && (
          <span className="text-xs text-yellow-500/80">
            OPR unavailable — predictions use avg score
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <TeamPicker
          label="Red Alliance"
          color="red"
          value={redTeams}
          onChange={setRedTeams}
          teams={teams}
        />
        <TeamPicker
          label="Blue Alliance"
          color="blue"
          value={blueTeams}
          onChange={setBlueTeams}
          teams={teams}
        />
      </div>

      {prediction && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Prediction</p>

          {/* Score bar */}
          <div className="flex items-end justify-between mb-2">
            <span className="text-3xl font-bold font-mono text-red-400">
              {prediction.redScore}
            </span>
            <span className="text-zinc-600 text-sm mb-1">predicted</span>
            <span className="text-3xl font-bold font-mono text-blue-400">
              {prediction.blueScore}
            </span>
          </div>

          {/* Win probability bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-3">
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${prediction.redWinPct}%` }}
            />
            <div
              className="bg-blue-500 transition-all duration-500"
              style={{ width: `${prediction.blueWinPct}%` }}
            />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-red-400 font-medium">{prediction.redWinPct}% Red wins</span>
            <span className="text-zinc-600">margin: ~{prediction.margin} pts</span>
            <span className="text-blue-400 font-medium">{prediction.blueWinPct}% Blue wins</span>
          </div>

          {/* OPR per team */}
          {Object.keys(opr).length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
              <div>
                {redNums.map(n => (
                  <div key={n} className="flex justify-between text-xs py-0.5">
                    <span className="text-red-400">{n}</span>
                    <span className="font-mono text-zinc-400">
                      {opr[n] ? `${opr[n].total.toFixed(1)} OPR` : 'no data'}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                {blueNums.map(n => (
                  <div key={n} className="flex justify-between text-xs py-0.5">
                    <span className="text-blue-400">{n}</span>
                    <span className="font-mono text-zinc-400">
                      {opr[n] ? `${opr[n].total.toFixed(1)} OPR` : 'no data'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!canPredict && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-zinc-600 text-sm">
            Enter at least one team on each side to see a prediction.
          </p>
        </div>
      )}

      <p className="text-xs text-zinc-700 mt-4">
        Prediction = sum of alliance OPRs · win % uses logistic model (σ=25 pts)
      </p>
    </div>
  )
}
