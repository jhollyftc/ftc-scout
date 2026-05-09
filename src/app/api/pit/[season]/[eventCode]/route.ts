import { list } from '@vercel/blob'
import type { NextRequest } from 'next/server'

type PitScoutingData = Record<string, string | number | null>

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({})
  const { season, eventCode } = await ctx.params
  const { blobs } = await list({ prefix: `pit/${season}/${eventCode}/` })

  const entries: Record<string, PitScoutingData> = {}

  await Promise.all(
    blobs.map(async blob => {
      const parts = blob.pathname.split('/')
      // path: pit/{season}/{eventCode}/{teamNumber}.json
      const teamNumber = parts[parts.length - 1].replace('.json', '')
      const entry: PitScoutingData = await fetch(blob.url).then(r => r.json())
      entries[teamNumber] = entry
    })
  )

  return Response.json(entries)
}
