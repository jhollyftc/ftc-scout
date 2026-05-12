import { list, put } from '@vercel/blob'
import type { NextRequest } from 'next/server'

export interface PicklistVisibility {
  visible: boolean
}

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ visible: false })
  const { season, eventCode } = await ctx.params
  const { blobs } = await list({ prefix: `picklist-settings/${season}/${eventCode}.json` })
  if (!blobs.length) return Response.json({ visible: false })
  const res = await fetch(blobs[0].url)
  return Response.json(await res.json())
}

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return Response.json({ error: 'Not configured' }, { status: 503 })
  const { season, eventCode } = await ctx.params
  const data: PicklistVisibility = await req.json()
  await put(
    `picklist-settings/${season}/${eventCode}.json`,
    JSON.stringify(data),
    { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }
  )
  return Response.json({ ok: true })
}
