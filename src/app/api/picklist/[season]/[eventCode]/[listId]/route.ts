import { list, put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export type PickColumn = 'tier1' | 'tier2' | 'dnp' | 'uncategorized'

export interface PickEntry {
  teamNumber: number
  column: PickColumn
  order: number
}

type Ctx = { params: Promise<{ season: string; eventCode: string; listId: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json(null)
  const { season, eventCode, listId } = await ctx.params
  const { blobs } = await list({ prefix: `picklist/${season}/${eventCode}/${listId}.json` })
  if (!blobs.length) return Response.json(null)
  const res = await fetch(blobs[0].url)
  return Response.json(await res.json(), {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode, listId } = await ctx.params
  const data: PickEntry[] = await req.json()
  await put(
    `picklist/${season}/${eventCode}/${listId}.json`,
    JSON.stringify(data),
    { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }
  )
  return Response.json({ ok: true })
}
