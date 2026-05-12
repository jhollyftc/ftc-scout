import { list } from '@vercel/blob'
import type { NextRequest } from 'next/server'
import type { PickEntry } from './[listId]/route'

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({})
  const { season, eventCode } = await ctx.params
  const { blobs } = await list({ prefix: `picklist/${season}/${eventCode}/` })

  const all: Record<string, PickEntry[]> = {}
  await Promise.all(
    blobs.map(async blob => {
      const parts = blob.pathname.split('/')
      const listId = parts[parts.length - 1].replace('.json', '')
      const data: PickEntry[] = await fetch(blob.url).then(r => r.json())
      all[listId] = data
    })
  )
  return Response.json(all)
}
