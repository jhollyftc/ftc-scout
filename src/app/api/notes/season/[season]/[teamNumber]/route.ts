import { list } from '@vercel/blob'
import type { NextRequest } from 'next/server'
import type { Note } from '@/app/api/notes/[season]/[eventCode]/[teamNumber]/route'

type Ctx = { params: Promise<{ season: string; teamNumber: string }> }

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json([])
  const { season, teamNumber } = await ctx.params

  const { blobs } = await list({ prefix: `notes/${season}/` })
  const teamBlobs = blobs.filter(b => b.pathname.endsWith(`/${teamNumber}.json`))

  const results = await Promise.all(
    teamBlobs.map(async blob => {
      const parts = blob.pathname.split('/')
      const eventCode = parts[2]
      const res = await fetch(blob.url)
      const notes: Note[] = await res.json()
      return { eventCode, notes }
    })
  )

  return Response.json(results.filter(r => r.notes.length > 0))
}
