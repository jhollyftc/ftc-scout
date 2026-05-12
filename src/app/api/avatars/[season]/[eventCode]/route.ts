import type { NextRequest } from 'next/server'

const BASE = process.env.FTC_API_BASE!

function authHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${process.env.FTC_API_USER}:${process.env.FTC_API_TOKEN}`).toString('base64')}`,
    Accept: 'application/json',
  }
}

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { season, eventCode } = await ctx.params

  // Step 1: get team numbers for this event
  // Note: no pageSize param — use default pagination (FTC events rarely exceed 25 teams)
  let teamNumbers: number[] = []
  try {
    const url = new URL(`${BASE}/${season}/teams`)
    url.searchParams.set('eventCode', eventCode)
    const res = await fetch(url.toString(), { headers: authHeaders() })
    if (res.ok) {
      const json = await res.json()
      teamNumbers = (json.teams ?? []).map((t: { teamNumber: number }) => t.teamNumber)
    }
  } catch {}

  if (!teamNumbers.length) {
    return Response.json({})
  }

  // Step 2: fetch avatar for each team in parallel
  // FTC API supports ?teamNumber filter on the avatars list endpoint.
  // Also handle the direct single-team response format just in case.
  const result: Record<string, string> = {}
  await Promise.allSettled(
    teamNumbers.map(async n => {
      try {
        const url = new URL(`${BASE}/${season}/avatars`)
        url.searchParams.set('teamNumber', String(n))
        const res = await fetch(url.toString(), { headers: authHeaders() })
        if (!res.ok) return
        const json = await res.json()
        // List format: { teams: [{ teamNumber, encodedAvatar }] }
        // Direct format: { teamNumber, encodedAvatar }
        const encoded: string | null =
          json.teams?.[0]?.encodedAvatar ??
          (typeof json.encodedAvatar === 'string' ? json.encodedAvatar : null)
        if (encoded) result[String(n)] = encoded
      } catch {}
    })
  )

  return Response.json(result, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200' },
  })
}
