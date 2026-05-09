import { list } from '@vercel/blob'
import type { NextRequest } from 'next/server'

interface Note {
  id: string
  text: string
  timestamp: string
}

type Ctx = { params: Promise<{ season: string; eventCode: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({})
  const { season, eventCode } = await ctx.params
  const { blobs } = await list({ prefix: `notes/${season}/${eventCode}/` })

  const entries: Record<string, Note[]> = {}

  await Promise.all(
    blobs.map(async blob => {
      const parts = blob.pathname.split('/')
      // path: notes/{season}/{eventCode}/{teamNumber}.json
      const teamNumber = parts[parts.length - 1].replace('.json', '')
      const notes: Note[] = await fetch(blob.url).then(r => r.json())
      entries[teamNumber] = notes
    })
  )

  return Response.json(entries)
}
