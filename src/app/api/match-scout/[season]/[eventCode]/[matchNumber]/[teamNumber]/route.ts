import { del, list, put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export interface MatchScoutEntry {
  autoRating: number | null
  teleopRating: number | null
  endgame: string
  notes: string
  scoutedAt: string
  scoutedBy?: string
}

type Ctx = { params: Promise<{ season: string; eventCode: string; matchNumber: string; teamNumber: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json(null)
  const { season, eventCode, matchNumber, teamNumber } = await ctx.params
  const { blobs } = await list({ prefix: `match-scout/${season}/${eventCode}/${matchNumber}/${teamNumber}.json` })
  if (!blobs.length) return Response.json(null)
  const res = await fetch(blobs[0].url)
  return Response.json(await res.json())
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode, matchNumber, teamNumber } = await ctx.params
  const data: MatchScoutEntry = await req.json()
  await put(
    `match-scout/${season}/${eventCode}/${matchNumber}/${teamNumber}.json`,
    JSON.stringify(data),
    { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }
  )
  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode, matchNumber, teamNumber } = await ctx.params
  const { blobs } = await list({ prefix: `match-scout/${season}/${eventCode}/${matchNumber}/${teamNumber}.json` })
  if (blobs.length) await del(blobs.map(b => b.url))
  return Response.json({ ok: true })
}
