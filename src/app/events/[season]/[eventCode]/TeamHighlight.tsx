'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import type { HybridScheduleResponse } from '@/lib/ftc-client'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function TeamHighlight({
  season,
  eventCode,
}: {
  season: string
  eventCode: string
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const highlightTeam = searchParams.get('team') ?? ''

  const { data: schedData } = useSWR<HybridScheduleResponse>(
    `/api/ftc/${season}/schedule/${eventCode}/qual/hybrid`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const teams = useMemo(() => {
    const seen = new Set<number>()
    const result: number[] = []
    for (const match of schedData?.schedule ?? []) {
      for (const t of match.teams) {
        if (!seen.has(t.teamNumber)) {
          seen.add(t.teamNumber)
          result.push(t.teamNumber)
        }
      }
    }
    return result.sort((a, b) => a - b)
  }, [schedData])

  const setHighlight = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('team', value)
      else params.delete('team')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  if (!teams.length) return null

  return (
    <select
      value={highlightTeam}
      onChange={e => setHighlight(e.target.value)}
      className="h-7 px-2 text-xs rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 focus:outline-none focus:border-sky-500 shrink-0"
    >
      <option value="">— Highlight —</option>
      {teams.map(n => (
        <option key={n} value={String(n)}>{n}</option>
      ))}
    </select>
  )
}
