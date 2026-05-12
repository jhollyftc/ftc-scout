import type { NextRequest } from 'next/server'

const BASE = process.env.FTC_API_BASE!

function getAuth() {
  return `Basic ${Buffer.from(`${process.env.FTC_API_USER}:${process.env.FTC_API_TOKEN}`).toString('base64')}`
}

async function ftcGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`)
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: { Authorization: getAuth(), Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`FTC ${res.status}: ${path}`)
  return res.json()
}

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { season, eventCode } = await ctx.params

  // Get teams registered at this event (eventCode filter works on /teams)
  const teamsRes = await ftcGet<{ teams: { teamNumber: number }[]; teamCountTotal: number }>(
    `${season}/teams`,
    { eventCode, pageSize: '200' }
  )
  const teamNumbers = teamsRes.teams.map(t => t.teamNumber)

  // Fetch each team's avatar in parallel (teamNumber filter works on /avatars)
  const entries = await Promise.allSettled(
    teamNumbers.map(async n => {
      const res = await ftcGet<{ teams: { teamNumber: number; encodedAvatar: string | null }[] }>(
        `${season}/avatars`,
        { teamNumber: String(n) }
      )
      const encoded = res.teams[0]?.encodedAvatar ?? null
      return [n, encoded] as [number, string | null]
    })
  )

  const result: Record<number, string> = {}
  for (const r of entries) {
    if (r.status === 'fulfilled' && r.value[1]) {
      result[r.value[0]] = r.value[1]
    }
  }

  return Response.json(result, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200' },
  })
}
