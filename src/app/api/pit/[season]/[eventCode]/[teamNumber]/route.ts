import { list, put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export type PitScoutingData = Record<string, string | number | null>

type Ctx = { params: Promise<{ season: string; eventCode: string; teamNumber: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json(null)
  const { season, eventCode, teamNumber } = await ctx.params
  const { blobs } = await list({ prefix: `pit/${season}/${eventCode}/${teamNumber}.json` })
  if (!blobs.length) return Response.json(null)
  const res = await fetch(blobs[0].url)
  return Response.json(await res.json())
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode, teamNumber } = await ctx.params
  const data: PitScoutingData = await req.json()
  await put(
    `pit/${season}/${eventCode}/${teamNumber}.json`,
    JSON.stringify(data),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
  )
  return Response.json({ ok: true })
}
